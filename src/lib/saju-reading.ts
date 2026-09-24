/**
 * The 사주 reading — the browser half.
 *
 * The chart is worked out here (lib/saju), the person's records are gathered
 * here (lib/ai-records), and both go to the writer (worker/readings.ts) only
 * when the reading is asked for. What comes back is kept on the device, with
 * the settings it needs — the hour of birth and the gender the ten-year
 * periods turn on — in a small store of its own that travels with Pro sync.
 */
import {
  ELEMENTS, ELEMENT_KO, STEMS_KO, branchElement, branchTenGod, chartOf, daeunOf, elementCount,
  localOffsetMinutes, pillarHanja, pillarKo, stemElement, tenGod, yearPillar,
  type Chart, type Daeun, type Gender, type Pillar,
} from './saju';
import type { RecordsDigest } from './ai-records';
import type { PersistedCodec } from '@/hooks/usePersistedState';

export const SAJU_KEY = '24h-circle-planner.saju';

/** The planned prices, in cents, shown while the readings are tried out (the
 *  till, when it opens, is Polar's and says its own number). */
export const READING_PRICE = { saju: 300, memoir: 500 } as const;

export interface SajuReading { text: string; createdAt: string }

export interface SajuStore {
  version: 1;
  /** 'HH:MM', or absent when the hour of birth is not known. */
  time?: string;
  /** For the direction of the ten-year periods, and for nothing else. */
  gender?: Gender;
  /** Every reading written, oldest first. */
  readings: SajuReading[];
}

export const MAX_SAJU_READINGS = 30;
const MAX_READING = 20_000;

export const emptySaju = (): SajuStore => ({ version: 1, readings: [] });

/** Strict, byte-stable: fixed order, nothing empty written. */
export function decodeSaju(parsed: unknown): SajuStore | null {
  const p = parsed as Record<string, unknown> | null;
  if (!p || typeof p !== 'object' || p['version'] !== 1) return null;
  const time = typeof p['time'] === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(p['time']) ? p['time'] : undefined;
  const gender = p['gender'] === 'male' || p['gender'] === 'female' ? p['gender'] : undefined;
  const readings = (Array.isArray(p['readings']) ? p['readings'] : []).flatMap((r) => {
    const o = r as Record<string, unknown> | null;
    const text = typeof o?.['text'] === 'string' ? o['text'].slice(0, MAX_READING).trim() : '';
    const createdAt = typeof o?.['createdAt'] === 'string' ? o['createdAt'] : '';
    return text && createdAt ? [{ text, createdAt }] : [];
  }).slice(-MAX_SAJU_READINGS);
  return { version: 1, ...(time ? { time } : {}), ...(gender ? { gender } : {}), readings };
}

export const sajuCodec: PersistedCodec<SajuStore> = {
  decode: decodeSaju,
  encode: (s) => decodeSaju(s) ?? emptySaju(),
  fallback: emptySaju,
};

// ── The chart, said in words the writer and the page can both use ────────────

const GAN_KO = (p: Pillar) => `${pillarKo(p)}(${pillarHanja(p)})`;

export interface ChartView {
  chart: Chart;
  /** Hour, day, month, year — the order a chart is read in. */
  columns: { label: 'hour' | 'day' | 'month' | 'year'; pillar: Pillar | null; stemGod?: string; branchGod?: string }[];
  elements: Record<string, number>;
  dayMaster: string;
  daeun: { forward: boolean; number: number; periods: Daeun[] } | null;
  /** Index into daeun.periods of the one running now; -1 before the first. */
  current: number;
}

/** Everything the dialog draws and the writer is told, from one birth. */
export function viewChart(birthDate: string, time: string | undefined, gender: Gender | undefined, today = new Date()): ChartView {
  const input = { date: birthDate, ...(time ? { time } : {}), offsetMinutes: localOffsetMinutes(birthDate, time) };
  const chart = chartOf(input);
  const ds = chart.day.stem;
  const col = (label: ChartView['columns'][number]['label'], p: Pillar | null, self = false) => ({
    label,
    pillar: p,
    ...(p && !self ? { stemGod: tenGod(ds, p.stem) } : {}),
    ...(p ? { branchGod: branchTenGod(ds, p.branch) } : {}),
  });
  const daeun = gender ? daeunOf(input, gender) : null;
  const age = today.getFullYear() - Number(birthDate.slice(0, 4));
  let current = -1;
  if (daeun) daeun.periods.forEach((d, i) => { if (age >= d.startAge) current = i; });
  const counts = elementCount(chart);
  return {
    chart,
    columns: [col('hour', chart.hour), col('day', chart.day, true), col('month', chart.month), col('year', chart.year)],
    elements: counts,
    dayMaster: `${STEMS_KO[ds]}${ELEMENT_KO[stemElement(ds)].slice(0, 1)}(${pillarHanja(chart.day).slice(0, 1)}) · ${ds % 2 === 0 ? '양' : '음'}`,
    daeun,
    current,
  };
}

/** What the writer is sent: the chart as words, and the records. */
export function buildSajuRequest(
  lang: string,
  birthDate: string,
  store: SajuStore,
  digest: RecordsDigest,
  today = new Date(),
) {
  const v = viewChart(birthDate, store.time, store.gender, today);
  const labels = { hour: '시주', day: '일주', month: '월주', year: '연주' } as const;
  const pillars = v.columns.map((c) => (c.pillar
    ? `${labels[c.label]} ${GAN_KO(c.pillar)} — ${ELEMENT_KO[stemElement(c.pillar.stem)]}/${ELEMENT_KO[branchElement(c.pillar.branch)]}`
    : `${labels[c.label]} (hour unknown)`));
  const tenGods = v.columns.flatMap((c) => (c.pillar
    ? [`${labels[c.label]}: ${c.stemGod ?? '일간'} / ${c.branchGod ?? ''}`]
    : []));
  const year = today.getFullYear();
  const notes: string[] = [];
  if (!store.time) notes.push('The hour of birth is not known: there is no hour pillar, and the start age of the ten-year periods may be off by a year.');
  if (!store.gender) notes.push('No gender was given, so the ten-year periods are not calculated; leave them out.');
  return {
    lang,
    ...(digest.name ? { name: digest.name } : {}),
    birthDate,
    ...(store.time ? { birthTime: store.time } : {}),
    chart: {
      pillars,
      dayMaster: v.dayMaster,
      elements: ELEMENTS.map((e) => `${ELEMENT_KO[e]} ${v.elements[e]}`).join(', '),
      tenGods,
      daeun: v.daeun
        ? v.daeun.periods.map((d, i) => `${d.startAge}–${d.startAge + 9}세 ${GAN_KO(d.pillar)}${i === v.current ? ' (now)' : ''}`)
        : [],
      ...(v.daeun && v.current >= 0 ? { currentDaeun: `${v.daeun.periods[v.current].startAge}세부터 ${GAN_KO(v.daeun.periods[v.current].pillar)}` } : {}),
      thisYear: `${year} ${GAN_KO(yearPillar(year))}`,
      notes,
    },
    records: digest,
  };
}

// ── The reading, as written ──────────────────────────────────────────────────

export interface SajuParts {
  /** The one line the reading opens with; '' when it did not (older readings). */
  headline: string;
  /** Its three words. */
  keywords: string[];
  /** Everything after them, as written. */
  body: string;
}

/**
 * The reading opens with two small sections — one line, and three words —
 * because those are what a card can carry (worker/readings.ts asks for them).
 * They are told apart by where they are and by how short they are, not by
 * their titles, which are in whatever language the reading is in. A reading
 * from before they were asked for is all body.
 */
export function sajuParts(text: string): SajuParts {
  const sections: { title: string; body: string }[] = [];
  for (const chunk of text.split(/^##[ \t]+/m).slice(1)) {
    const nl = chunk.indexOf('\n');
    sections.push({
      title: (nl < 0 ? chunk : chunk.slice(0, nl)).trim(),
      body: nl < 0 ? '' : chunk.slice(nl + 1).trim(),
    });
  }
  const [line, words] = sections;
  const oneLine = !!line && !!line.body && !line.body.includes('\n') && line.body.length <= 120;
  const list = words?.body.split(/[·・,|/]|\s{2,}/).map((k) => k.trim().replace(/^#/, '').trim()).filter(Boolean) ?? [];
  const threeWords = !!words && !words.body.includes('\n') && list.length >= 2 && list.length <= 4
    && list.every((k) => k.length <= 20);
  if (sections.length < 3 || !oneLine || !threeWords) return { headline: '', keywords: [], body: text.trim() };
  const at = text.indexOf('##', text.indexOf(words.body) + words.body.length);
  return { headline: line.body.replace(/^["“「『]|["”」』]$/g, '').trim(), keywords: list.slice(0, 3), body: at < 0 ? '' : text.slice(at).trim() };
}

/** Where a shared card points, marked so the visits it brings can be counted. */
export const SAJU_SHARE_URL = 'https://24houring.com/?view=life&utm_source=saju_card&utm_medium=share&utm_campaign=saju';

// ── Talking to the server ────────────────────────────────────────────────────

export interface SajuState { enabled: boolean; admin: boolean; missing?: string }

export async function fetchSajuState(): Promise<SajuState> {
  try {
    const res = await fetch('/api/life/saju', { credentials: 'include', headers: { accept: 'application/json' } });
    if (!res.ok) return { enabled: false, admin: false };
    const d = (await res.json()) as Partial<SajuState>;
    return { enabled: Boolean(d.enabled), admin: Boolean(d.admin), ...(d.missing ? { missing: String(d.missing) } : {}) };
  } catch {
    return { enabled: false, admin: false };
  }
}

/** Ask for a reading; `onText` sees it as it arrives. */
export async function writeSaju(body: unknown, onText: (soFar: string) => void, signal?: AbortSignal): Promise<string> {
  const res = await fetch('/api/life/saju', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    let code = `http_${res.status}`;
    try {
      const e = (await res.json()) as { error?: string; detail?: string };
      code = [e.error ?? code, e.detail].filter(Boolean).join(' — ');
    } catch { /* not JSON */ }
    throw new Error(code);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
    if (out.length >= MAX_READING) {
      out = out.slice(0, MAX_READING);
      void reader.cancel();
      break;
    }
    onText(out);
  }
  out = out.trim();
  if (!out) throw new Error('empty');
  onText(out);
  return out;
}
