/**
 * Home-screen widgets for the other tabs — the calendar, the life line, the
 * people and the places — each a picture the app draws and the phone shows.
 *
 * They ride on the same per-phone slot as the timetable ring (publish.ts): one
 * secret token, and one image per kind under it (worker/widget.ts). The phone
 * says which kinds it actually has on its home screen (the launcher passes
 * `?wk=calendar,life`), and only those are drawn and uploaded — a phone with
 * no people widget never sends anybody's name anywhere.
 *
 * A picture cannot count days by itself, so everything that depends on the
 * date is redrawn whenever the app is opened or left, and each picture says in
 * small type which day it was drawn for.
 */
import type { TKey } from '@/i18n/translations';
import { dayEvents, type CalendarEvent } from '@/lib/calendar-events';
import { EVENTS_KEY, eventsCodec } from '@/hooks/useEvents';
import { addDays, todayKey } from '@/lib/calendar-grid';
import { ageAt, isPlanned } from '@/lib/life';
import { readLife } from '@/lib/life-invite';
import { RELATION_KEY, daysSinceContact, daysToBirthday, decodeRelation, STALE_DAYS } from '@/lib/relation';
import { PLACE_KEY, decodePlace, placeSummary } from '@/lib/place';

export const WIDGET_KINDS = ['calendar', 'life', 'people', 'place'] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

/** Which kinds this phone has placed. Device-local, like the token. */
export const WIDGET_KINDS_KEY = '24h-circle-planner.widget-kinds';
/** A fingerprint of the last picture sent per kind, so an unchanged one is not
 *  uploaded again on every open. */
const SENT_KEY = '24h-circle-planner.widget-kinds-sent';

/** The side of each picture, in pixels. The phone shows it at most 800 wide. */
export const KIND_SIZE = 900;

const isKind = (v: string): v is WidgetKind => (WIDGET_KINDS as readonly string[]).includes(v);

export function readWidgetKinds(): WidgetKind[] {
  try {
    const raw = localStorage.getItem(WIDGET_KINDS_KEY) ?? '';
    return raw.split(',').filter(isKind);
  } catch {
    return [];
  }
}

/**
 * Take the list of placed kinds from the launch URL (`?wk=…`, possibly empty),
 * keep it, and strip it from the address. Returns the kinds that were there
 * before and are gone now, so their pictures can be taken off the server; null
 * when the URL said nothing.
 */
export function adoptWidgetKindsFromUrl(
  loc: { search: string; pathname: string; hash: string } = window.location,
): { kinds: WidgetKind[]; removed: WidgetKind[] } | null {
  const params = new URLSearchParams(loc.search);
  const wk = params.get('wk');
  if (wk === null) return null;
  params.delete('wk');
  const rest = params.toString();
  try {
    history.replaceState(history.state, '', `${loc.pathname}${rest ? `?${rest}` : ''}${loc.hash}`);
  } catch { /* history unavailable */ }
  const kinds = [...new Set(wk.split(',').filter(isKind))];
  const before = readWidgetKinds();
  try {
    localStorage.setItem(WIDGET_KINDS_KEY, kinds.join(','));
  } catch { /* storage unavailable */ }
  return { kinds, removed: before.filter((k) => !kinds.includes(k)) };
}

// ── Drawing ──────────────────────────────────────────────────────────────────

export interface KindEnv {
  t: (key: TKey, params?: Record<string, string>) => string;
  lang: string;
  dark: boolean;
  today?: string;
}

interface Ink { card: string; ink: string; muted: string; line: string; accent: string; soft: string }

const inkOf = (dark: boolean): Ink => (dark
  ? { card: 'rgba(24,30,42,0.94)', ink: '#eef1f6', muted: '#9aa3b2', line: '#2c3444', accent: '#ff6b5e', soft: 'rgba(255,255,255,0.06)' }
  : { card: 'rgba(255,253,248,0.96)', ink: '#1f2430', muted: '#6b7280', line: '#e6e2da', accent: '#ff4d4d', soft: 'rgba(31,36,48,0.05)' });

const SANS = "Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', system-ui, sans-serif";
const S = KIND_SIZE;
const PAD = 64;

const dayDiff = (a: string, b: string): number =>
  Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86_400_000);

/** "9/26 (Fri)" in the app's language. */
function shortDate(day: string, lang: string, weekday = true): string {
  const d = new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
  try {
    return new Intl.DateTimeFormat(lang, { month: 'numeric', day: 'numeric', ...(weekday ? { weekday: 'short' } : {}) }).format(d);
  } catch {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
}

const dday = (n: number): string => (n === 0 ? 'D-day' : `D-${n}`);

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s}…`;
}

/** The card every kind is drawn on, its title, and the day it was drawn for. */
function frame(ctx: CanvasRenderingContext2D, ink: Ink, title: string, stamp: string) {
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = ink.card;
  ctx.beginPath();
  ctx.roundRect(0, 0, S, S, 72);
  ctx.fill();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = ink.accent;
  ctx.beginPath();
  ctx.arc(PAD + 10, PAD + 22, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ink.ink;
  ctx.font = `700 44px ${SANS}`;
  ctx.fillText(fit(ctx, title, S - PAD * 2 - 180), PAD + 34, PAD + 38);
  ctx.textAlign = 'right';
  ctx.fillStyle = ink.muted;
  ctx.font = `500 26px ${SANS}`;
  ctx.fillText(stamp, S - PAD, PAD + 34);
  ctx.textAlign = 'left';
}

/** A list row: a bold left part and a quiet right part. */
function row(ctx: CanvasRenderingContext2D, ink: Ink, y: number, left: string, right: string, color?: string) {
  ctx.font = `600 38px ${SANS}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = ink.muted;
  const rightW = right ? ctx.measureText(right).width + 24 : 0;
  ctx.fillText(right, S - PAD, y);
  ctx.textAlign = 'left';
  let x = PAD;
  if (color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 9, y - 13, 9, 0, Math.PI * 2);
    ctx.fill();
    x += 32;
  }
  ctx.fillStyle = ink.ink;
  ctx.font = `600 40px ${SANS}`;
  ctx.fillText(fit(ctx, left, S - PAD - x - rightW), x, y);
}

function empty(ctx: CanvasRenderingContext2D, ink: Ink, text: string) {
  ctx.fillStyle = ink.muted;
  ctx.font = `500 38px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText(fit(ctx, text, S - PAD * 2), S / 2, S / 2 + 20);
  ctx.textAlign = 'left';
}

/** The calendar's own store, read through its own strict decoder. */
function readEvents(): Record<string, CalendarEvent[]> {
  try {
    return eventsCodec.decode(JSON.parse(localStorage.getItem(EVENTS_KEY) ?? 'null')) ?? {};
  } catch {
    return {};
  }
}

/** The month, with a dot on every day that has something, and what is next. */
function drawCalendar(ctx: CanvasRenderingContext2D, ink: Ink, env: KindEnv, today: string) {
  const y0 = +today.slice(0, 4);
  const m0 = +today.slice(5, 7) - 1;
  const first = new Date(y0, m0, 1);
  let title = `${y0}-${m0 + 1}`;
  try { title = new Intl.DateTimeFormat(env.lang, { year: 'numeric', month: 'long' }).format(first); } catch { /* keep */ }
  frame(ctx, ink, title, env.t('widget.asOf', { date: shortDate(today, env.lang, false) }));
  const events = readEvents();

  // Weekday names, Sunday first.
  const top = 170;
  const cellW = (S - PAD * 2) / 7;
  ctx.font = `600 26px ${SANS}`;
  ctx.textAlign = 'center';
  for (let i = 0; i < 7; i++) {
    let name: string;
    try { name = new Intl.DateTimeFormat(env.lang, { weekday: 'narrow' }).format(new Date(2023, 0, 1 + i)); } catch { name = 'SMTWTFS'[i]; }
    ctx.fillStyle = i === 0 ? ink.accent : ink.muted;
    ctx.fillText(name, PAD + cellW * (i + 0.5), top);
  }
  const days = new Date(y0, m0 + 1, 0).getDate();
  const lead = first.getDay();
  const rows = Math.ceil((lead + days) / 7);
  const cellH = Math.min(78, 470 / rows);
  for (let d = 1; d <= days; d++) {
    const i = lead + d - 1;
    const cx = PAD + cellW * ((i % 7) + 0.5);
    const cy = top + 40 + cellH * Math.floor(i / 7) + cellH / 2;
    const key = `${y0}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (key === today) {
      ctx.fillStyle = ink.accent;
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = key === today ? '#ffffff' : (i % 7 === 0 ? ink.accent : ink.ink);
    ctx.font = `${key === today ? 700 : 500} 32px ${SANS}`;
    ctx.fillText(String(d), cx, cy + 9);
    const has = dayEvents(events, key);
    if (has.length) {
      ctx.fillStyle = has[0].color ?? ink.accent;
      ctx.beginPath();
      ctx.arc(cx, cy + 30, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.textAlign = 'left';

  // What is next, from today on.
  const listTop = top + 40 + cellH * rows + 30;
  ctx.strokeStyle = ink.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, listTop);
  ctx.lineTo(S - PAD, listTop);
  ctx.stroke();
  const next: { day: string; text: string; color?: string; time?: string | null }[] = [];
  for (let i = 0; i < 60 && next.length < 3; i++) {
    const day = addDays(today, i);
    for (const e of dayEvents(events, day)) {
      if (e.index > 0 && i > 0) continue; // a span is listed once, where it starts
      next.push({ day, text: e.text, color: e.color, time: e.time });
      if (next.length === 3) break;
    }
  }
  const room = Math.max(1, Math.floor((S - PAD - listTop - 20) / 62));
  if (!next.length) {
    ctx.fillStyle = ink.muted;
    ctx.font = `500 34px ${SANS}`;
    ctx.fillText(env.t('widget.calendar.none'), PAD, listTop + 62);
  }
  next.slice(0, room).forEach((e, i) => {
    row(ctx, ink, listTop + 64 + i * 62, e.text, `${shortDate(e.day, env.lang)}${e.time ? ` ${e.time}` : ''}`, e.color ?? ink.accent);
  });
}

/** How old, how many days, what comes next on the line and what came last. */
function drawLife(ctx: CanvasRenderingContext2D, ink: Ink, env: KindEnv, today: string) {
  const life = readLife();
  frame(ctx, ink, env.t('widget.life.title'), env.t('widget.asOf', { date: shortDate(today, env.lang, false) }));
  const birth = life.profile.birthDate;
  const age = birth ? ageAt(birth, today) : null;
  if (!birth || !age) {
    empty(ctx, ink, env.t('widget.life.none'));
    return;
  }
  ctx.fillStyle = ink.ink;
  ctx.font = `800 132px ${SANS}`;
  ctx.fillText(env.t('widget.life.age', { n: String(age.years) }), PAD, 320);
  ctx.fillStyle = ink.muted;
  ctx.font = `500 40px ${SANS}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(birth)) {
    ctx.fillText(env.t('widget.life.days', { n: dayDiff(birth, today).toLocaleString(env.lang) }), PAD, 390);
  }

  // The year so far, as a bar.
  const y = +today.slice(0, 4);
  const into = dayDiff(`${y}-01-01`, today) + 1;
  const length = dayDiff(`${y}-01-01`, `${y + 1}-01-01`);
  const barY = 450;
  ctx.fillStyle = ink.soft;
  ctx.beginPath();
  ctx.roundRect(PAD, barY, S - PAD * 2, 22, 11);
  ctx.fill();
  ctx.fillStyle = ink.accent;
  ctx.beginPath();
  ctx.roundRect(PAD, barY, Math.max(22, ((S - PAD * 2) * into) / length), 22, 11);
  ctx.fill();
  ctx.fillStyle = ink.muted;
  ctx.font = `500 30px ${SANS}`;
  ctx.fillText(env.t('widget.life.year', { y: String(y), n: String(Math.round((into / length) * 100)) }), PAD, barY + 64);

  const moments = [...life.milestones].sort((a, b) => a.date.localeCompare(b.date));
  const ahead = moments.find((m) => isPlanned(m, today));
  const behind = [...moments].reverse().find((m) => !isPlanned(m, today));
  let at = 660;
  if (ahead) {
    const full = /^\d{4}-\d{2}-\d{2}$/.test(ahead.date);
    row(ctx, ink, at, `${env.t('widget.life.next')} · ${ahead.title}`, full ? dday(dayDiff(today, ahead.date)) : ahead.date, ink.accent);
    at += 80;
  }
  if (behind) row(ctx, ink, at, `${env.t('widget.life.last')} · ${behind.title}`, behind.date.slice(0, 7), ink.muted);
}

/** Birthdays coming, and who has not been heard from in a while. */
function drawPeople(ctx: CanvasRenderingContext2D, ink: Ink, env: KindEnv, today: string) {
  frame(ctx, ink, env.t('widget.people.title'), env.t('widget.asOf', { date: shortDate(today, env.lang, false) }));
  let people: ReturnType<typeof decodeRelation> = null;
  try { people = decodeRelation(JSON.parse(localStorage.getItem(RELATION_KEY) ?? 'null')); } catch { /* none */ }
  const list = people?.people ?? [];
  if (!list.length) {
    empty(ctx, ink, env.t('widget.people.none'));
    return;
  }
  const soon = list
    .map((p) => ({ p, d: daysToBirthday(p, today) }))
    .filter((x): x is { p: typeof x.p; d: number } => x.d !== null)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);
  const quiet = list
    .map((p) => ({ p, d: daysSinceContact(p, today) }))
    .filter((x): x is { p: typeof x.p; d: number } => x.d !== null && x.d >= STALE_DAYS)
    .sort((a, b) => b.d - a.d)
    .slice(0, 2);
  let y = 200;
  const heading = (text: string) => {
    ctx.fillStyle = ink.muted;
    ctx.font = `700 28px ${SANS}`;
    ctx.fillText(text, PAD, y);
    y += 70;
  };
  heading(env.t('widget.people.birthdays'));
  if (!soon.length) {
    ctx.fillStyle = ink.muted;
    ctx.font = `500 34px ${SANS}`;
    ctx.fillText(env.t('widget.people.noBirthdays'), PAD, y);
    y += 70;
  }
  for (const { p, d } of soon) {
    row(ctx, ink, y, p.name, `${shortDate(addDays(today, d), env.lang, false)} · ${dday(d)}`, d <= 7 ? ink.accent : undefined);
    y += 68;
  }
  if (quiet.length) {
    y += 30;
    heading(env.t('widget.people.quiet'));
    for (const { p, d } of quiet) {
      row(ctx, ink, y, p.name, env.t('widget.people.days', { n: String(d) }));
      y += 68;
    }
  }
}

/** The globe, facing home, with how much of the world has been walked on. */
async function drawPlaceKind(ctx: CanvasRenderingContext2D, ink: Ink, env: KindEnv, today: string) {
  frame(ctx, ink, env.t('widget.place.title'), env.t('widget.asOf', { date: shortDate(today, env.lang, false) }));
  let data: ReturnType<typeof decodePlace> = null;
  try { data = decodePlace(JSON.parse(localStorage.getItem(PLACE_KEY) ?? 'null')); } catch { /* none */ }
  const [{ loadWorld }, { drawGlobe }] = await Promise.all([import('@/lib/place-world'), import('@/lib/export/placeImage')]);
  const shapes = await loadWorld();
  const home = data?.home?.cityId ? data.cities.find((c) => c.id === data!.home!.cityId) : undefined;
  const globe = document.createElement('canvas');
  const side = 640;
  globe.width = side;
  globe.height = Math.round(side * 1.2);
  const g = globe.getContext('2d');
  if (!g) return;
  drawGlobe(g, {
    shapes,
    countries: data?.countries ?? [],
    cities: data?.cities ?? [],
    ...(home ? { homeCityId: home.id } : {}),
    background: 'rgba(0,0,0,0)',
    ink: ink.ink,
    visited: ink.accent,
    wished: '#4d6f93',
    facing: home ? { lng: home.lng, lat: home.lat } : { lng: 127, lat: 30 },
  }, side);
  ctx.drawImage(globe, 0, 0, side, side, (S - 560) / 2, 120, 560, 560);
  const sum = data ? placeSummary(data, shapes) : null;
  ctx.textAlign = 'center';
  ctx.fillStyle = ink.ink;
  ctx.font = `700 40px ${SANS}`;
  const line = sum
    ? [env.t('place.sum.countries', { n: String(sum.countries) }), env.t('place.sum.cities', { n: String(sum.cities) })].join(' · ')
    : env.t('widget.place.none');
  ctx.fillText(fit(ctx, line, S - PAD * 2), S / 2, 760);
  if (sum) {
    ctx.fillStyle = ink.muted;
    ctx.font = `500 32px ${SANS}`;
    ctx.fillText(fit(ctx, [
      env.t('place.sum.percent', { n: String(sum.percent) }),
      ...(sum.wished ? [env.t('place.sum.wish', { n: String(sum.wished) })] : []),
    ].join(' · '), S - PAD * 2), S / 2, 815);
  }
  ctx.textAlign = 'left';
}

/** One kind, drawn now, as a PNG in base64 (what the slot takes). */
export async function renderKind(kind: WidgetKind, env: KindEnv): Promise<string | null> {
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const ink = inkOf(env.dark);
  const today = env.today ?? todayKey();
  if (kind === 'calendar') drawCalendar(ctx, ink, env, today);
  else if (kind === 'life') drawLife(ctx, ink, env, today);
  else if (kind === 'people') drawPeople(ctx, ink, env, today);
  else await drawPlaceKind(ctx, ink, env, today);
  const url = canvas.toDataURL('image/png');
  const comma = url.indexOf(',');
  return comma > 0 ? url.slice(comma + 1) : null;
}

// ── Sending ──────────────────────────────────────────────────────────────────

/** FNV-1a over the picture: enough to tell "the same" from "changed". */
function fingerprint(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 7) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return `${h.toString(36)}.${s.length}`;
}

function sentOf(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

/** Draw every placed kind and upload whichever has changed since last time. */
export async function publishKinds(token: string, kinds: readonly WidgetKind[], env: KindEnv): Promise<void> {
  const sent = sentOf();
  for (const kind of kinds) {
    try {
      const png = await renderKind(kind, env);
      if (!png) continue;
      const mark = `${token}:${fingerprint(png)}`;
      if (sent[kind] === mark) continue;
      const res = await fetch(`/api/widget/${token}/k/${kind}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ png, meta: { v: 1, kind, day: env.today ?? todayKey(), dark: env.dark } }),
      });
      if (res.ok) sent[kind] = mark;
    } catch { /* offline: the phone keeps the last picture */ }
  }
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(sent));
  } catch { /* storage unavailable */ }
}

/** A kind taken off the home screen: its picture comes off the server too. */
export async function deleteKindSlot(token: string, kind: WidgetKind): Promise<void> {
  try {
    await fetch(`/api/widget/${token}/k/${kind}`, { method: 'DELETE' });
    const sent = sentOf();
    delete sent[kind];
    localStorage.setItem(SENT_KEY, JSON.stringify(sent));
  } catch { /* best effort */ }
}
