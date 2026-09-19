/**
 * Life — the third time scale (timetable = a day, calendar = a month, life = a
 * whole life): roots (family), the moments lived so far, today, plans ahead and
 * the words to leave behind, on one long line.
 *
 * This module is the data layer: the stored envelope, its strict decode (the
 * same value also travels in the Pro sync blob, so load → save must be
 * byte-stable), date precision and age maths, and the pure timeline model the
 * page and the PNG export both draw from.
 */
import { todayKey } from './calendar-grid';

export const LIFE_KEY = '24h-circle-planner.life';

export const LIFE_CATEGORIES = [
  'birth', 'family', 'education', 'career', 'relationship',
  'health', 'travel', 'achievement', 'home', 'other',
] as const;
export type LifeCategory = (typeof LIFE_CATEGORIES)[number];
/** The categories a person can pick: `birth` comes from the profile alone. */
export const PICKABLE_CATEGORIES = LIFE_CATEGORIES.filter((c) => c !== 'birth') as Exclude<LifeCategory, 'birth'>[];

export const RELATIONS = ['mother', 'father', 'spouse', 'child', 'sibling', 'other'] as const;
export type Relation = (typeof RELATIONS)[number];

export interface FamilyMember {
  id: string;
  relation: Relation;
  name: string;
  birthDate?: string;
  note?: string;
  /** A photo id in this device's picture store (lib/calendar-photos). */
  photo?: string;
}

export interface Milestone {
  id: string;
  /** 'YYYY-MM-DD', or 'YYYY-MM' / 'YYYY' when the day or month is not known. */
  date: string;
  /** The end of a span (school, a job), same forms as `date`. */
  endDate?: string;
  title: string;
  description?: string;
  category: LifeCategory;
  photo?: string;
  /** Marked as a plan; a date after today is a plan whatever this says. */
  isPlan: boolean;
  pinned?: boolean;
}

export interface LifeProfile {
  name?: string;
  /** 'YYYY-MM-DD'; empty until the person has told us (→ onboarding). */
  birthDate: string;
  /** Years, for the length of the future stretch and its decade labels. */
  lifeExpectancy?: number;
}

export interface LifeData {
  version: 1;
  profile: LifeProfile;
  family: FamilyMember[];
  milestones: Milestone[];
  endingNote: { text: string; updatedAt: string } | null;
  updatedAt: string;
}

export const DEFAULT_LIFE_EXPECTANCY = 90;
export const MAX_TITLE = 80;
export const MAX_DESCRIPTION = 1000;
export const MAX_NAME = 40;
export const MAX_NOTE = 200;
export const MAX_ENDING = 10_000;
const MIN_YEAR = 1800;
const MAX_YEAR = 2200;

export const emptyLife = (): LifeData => ({
  version: 1,
  profile: { birthDate: '' },
  family: [],
  milestones: [],
  endingNote: null,
  updatedAt: '',
});

// ── Dates ────────────────────────────────────────────────────────────────────

export type Precision = 'year' | 'month' | 'day';

/** How much of a life date is known, or null when it is not one. */
export function precisionOf(v: unknown): Precision | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(v);
  if (!m) return null;
  const y = Number(m[1]);
  if (y < MIN_YEAR || y > MAX_YEAR) return null;
  if (m[2] === undefined) return 'year';
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  if (m[3] === undefined) return 'month';
  const d = Number(m[3]);
  if (d < 1 || d > new Date(y, mo, 0).getDate()) return null;
  return 'day';
}

export const isLifeDate = (v: unknown): v is string => precisionOf(v) !== null;
export const isFullDate = (v: unknown): v is string => precisionOf(v) === 'day';

/** Sorts a life date among full dates: an unknown month or day sorts first
 *  in its year or month ('2010' → '2010-00-00'). */
export function sortKey(date: string): string {
  const [y, m = '00', d = '00'] = date.split('-');
  return `${y}-${m}-${d}`;
}

/** The pieces of a life date (month and day are null when unknown). */
export function partsOfLife(date: string): { y: number; m: number | null; d: number | null } {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m: m || null, d: d || null };
}

/** Build a life date from its parts; null when the year is missing or bad. */
export function lifeDate(y: number | null, m: number | null, d: number | null): string | null {
  if (!y || !Number.isInteger(y)) return null;
  let out = String(y).padStart(4, '0');
  if (m) {
    out += `-${String(m).padStart(2, '0')}`;
    if (d) out += `-${String(d).padStart(2, '0')}`;
  }
  return isLifeDate(out) ? out : null;
}

/** '2010.05.15', '2010.05', '2010' — the same in every language. */
export function formatLifeDate(date: string): string {
  return date.replace(/-/g, '.');
}

/** Spoken form for screen readers and titles: '2015년 3월', 'March 2015'. */
export function spokenLifeDate(date: string, locale: string): string {
  const { y, m, d } = partsOfLife(date);
  const at = new Date(y, (m ?? 1) - 1, d ?? 1);
  const opts: Intl.DateTimeFormatOptions = m === null
    ? { year: 'numeric' }
    : d === null ? { year: 'numeric', month: 'long' } : { year: 'numeric', month: 'long', day: 'numeric' };
  try {
    return new Intl.DateTimeFormat(locale, opts).format(at);
  } catch {
    return formatLifeDate(date);
  }
}

/**
 * Age (만 나이) on `date` for someone born on `birth`. `approx` when only the
 * year is known — the birthday may or may not have passed. Null before birth.
 */
export function ageAt(birth: string, date: string): { years: number; approx: boolean } | null {
  if (!isFullDate(birth) || !isLifeDate(date)) return null;
  const b = partsOfLife(birth);
  const p = partsOfLife(date);
  let years = p.y - b.y;
  const approx = p.m === null;
  if (!approx && (p.m! < b.m! || (p.m === b.m && p.d !== null && p.d < b.d!))) years -= 1;
  return years < 0 ? null : { years, approx };
}

/** A plan: marked as one, or dated after today. */
export function isPlanned(m: Pick<Milestone, 'date' | 'isPlan'>, today: string = todayKey()): boolean {
  return m.isPlan || sortKey(m.date) > today;
}

/** Oldest first; entries on the same date keep the order they were added in
 *  (the array order), which Array.prototype.sort keeps stable. */
export function sortMilestones(list: readonly Milestone[]): Milestone[] {
  return [...list].sort((a, b) => (sortKey(a.date) < sortKey(b.date) ? -1 : sortKey(a.date) > sortKey(b.date) ? 1 : 0));
}

// ── Stored envelope ──────────────────────────────────────────────────────────

const str = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim() ? v.slice(0, max) : undefined;
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;

function cleanMilestone(v: unknown): Milestone | null {
  const o = v as Record<string, unknown> | null;
  if (!o || !isId(o['id']) || !isLifeDate(o['date'])) return null;
  const title = str(o['title'], MAX_TITLE);
  if (!title) return null;
  const cat = o['category'];
  // A stored 'birth' is not ours to keep — the profile makes that one.
  const category: LifeCategory = typeof cat === 'string' && (PICKABLE_CATEGORIES as readonly string[]).includes(cat)
    ? (cat as LifeCategory) : 'other';
  const description = str(o['description'], MAX_DESCRIPTION);
  // Fixed field order, optional fields only when present: load → save is stable.
  return {
    id: o['id'], date: o['date'],
    ...(isLifeDate(o['endDate']) && sortKey(o['endDate']) >= sortKey(o['date']) ? { endDate: o['endDate'] } : {}),
    title,
    ...(description ? { description } : {}),
    category,
    ...(isId(o['photo']) ? { photo: o['photo'] } : {}),
    isPlan: o['isPlan'] === true,
    ...(o['pinned'] === true ? { pinned: true } : {}),
  };
}

function cleanMember(v: unknown): FamilyMember | null {
  const o = v as Record<string, unknown> | null;
  if (!o || !isId(o['id'])) return null;
  const name = str(o['name'], MAX_NAME);
  const rel = o['relation'];
  if (!name || typeof rel !== 'string' || !(RELATIONS as readonly string[]).includes(rel)) return null;
  const note = str(o['note'], MAX_NOTE);
  return {
    id: o['id'], relation: rel as Relation, name,
    ...(isLifeDate(o['birthDate']) ? { birthDate: o['birthDate'] } : {}),
    ...(note ? { note } : {}),
    ...(isId(o['photo']) ? { photo: o['photo'] } : {}),
  };
}

function cleanProfile(v: unknown): LifeProfile {
  const o = (v ?? {}) as Record<string, unknown>;
  const name = str(o['name'], MAX_NAME);
  const exp = Number(o['lifeExpectancy']);
  return {
    ...(name ? { name } : {}),
    birthDate: isFullDate(o['birthDate']) ? o['birthDate'] : '',
    ...(Number.isInteger(exp) && exp >= 1 && exp <= 130 ? { lifeExpectancy: exp } : {}),
  };
}

/**
 * Bring an older stored version up to the current shape. Only version 1
 * exists; a later one adds its step here, so a device that updates never
 * loses what it wrote before.
 */
export function migrateLife(parsed: unknown): Record<string, unknown> | null {
  const p = parsed as Record<string, unknown> | null;
  if (!p || typeof p !== 'object') return null;
  if (p['version'] === 1) return p;
  return null;
}

/** Strict decode: anything unknown or broken is dropped, never thrown on. */
export function decodeLife(parsed: unknown): LifeData | null {
  const p = migrateLife(parsed);
  if (!p) return null;
  const seen = new Set<string>();
  const unique = <T extends { id: string }>(x: T | null): x is T => !!x && !seen.has(x.id) && !!seen.add(x.id);
  const milestones = (Array.isArray(p['milestones']) ? p['milestones'] : []).map(cleanMilestone).filter(unique);
  const family = (Array.isArray(p['family']) ? p['family'] : []).map(cleanMember).filter(unique);
  const note = p['endingNote'] as Record<string, unknown> | null | undefined;
  const text = note && typeof note['text'] === 'string' ? note['text'].slice(0, MAX_ENDING) : '';
  return {
    version: 1,
    profile: cleanProfile(p['profile']),
    family,
    milestones,
    endingNote: text ? { text, updatedAt: typeof note!['updatedAt'] === 'string' ? note!['updatedAt'] : '' } : null,
    updatedAt: typeof p['updatedAt'] === 'string' ? p['updatedAt'] : '',
  };
}

/** What is stored (and synced): the same cleaning as a load, so every save
 *  has one canonical shape whatever order an edit built its fields in. */
export const encodeLife = (life: LifeData): LifeData => decodeLife(life) ?? emptyLife();

// ── Free plan ────────────────────────────────────────────────────────────────

/** Free plan: this many moments and family members; Pro has no limit. A
 *  limit only ever stops ADDING — nothing already written is hidden or lost. */
export const FREE_LIFE_MILESTONES = 30;
export const FREE_LIFE_FAMILY = 4;

export const canAddMilestone = (life: LifeData, pro: boolean): boolean =>
  pro || life.milestones.length < FREE_LIFE_MILESTONES;
export const canAddFamily = (life: LifeData, pro: boolean): boolean =>
  pro || life.family.length < FREE_LIFE_FAMILY;

// ── Timeline model ───────────────────────────────────────────────────────────

export type Side = 'left' | 'right';

/** `future`: below today's marker, where the line turns dashed. `tight`: in
 *  the same year as the card above it, so it sits closer. */
export type TimelineItem =
  | { kind: 'decade'; key: string; decade: number; future: boolean }
  | { kind: 'birth'; key: string; date: string; side: Side; tight: boolean; future: false }
  | { kind: 'moment'; key: string; m: Milestone; plan: boolean; side: Side; tight: boolean; future: boolean }
  | { kind: 'today'; key: string; date: string; future: false };

export interface TimelineOptions {
  today?: string;
  /** Categories to show; empty or missing shows all. Birth always shows. */
  only?: ReadonlySet<LifeCategory>;
}

const yearOf = (date: string) => Number(date.slice(0, 4));

/**
 * The whole line from top to bottom: a decade label wherever a new decade
 * starts (every decade up to the end of the expected life, so the future
 * stretch has its length even when empty), the birth card, moments in date
 * order alternating sides, and today's marker where the past ends. A moment
 * dated before the birth (the parents' wedding) sits above the birth card.
 */
export function buildTimeline(life: LifeData, opts: TimelineOptions = {}): TimelineItem[] {
  const today = opts.today ?? todayKey();
  const birth = life.profile.birthDate;
  if (!isFullDate(birth)) return [];
  const only = opts.only && opts.only.size ? opts.only : null;
  const moments = sortMilestones(life.milestones).filter((m) => !only || only.has(m.category));
  const years = moments.map((m) => yearOf(m.date));
  const lastYear = Math.max(yearOf(birth) + (life.profile.lifeExpectancy ?? DEFAULT_LIFE_EXPECTANCY), yearOf(today), ...years);

  const out: TimelineItem[] = [];
  let decade = Math.floor(Math.min(yearOf(birth), ...years) / 10) * 10;
  let cards = 0;
  let prevYear: number | null = null;
  let past = true;
  let birthPlaced = false;
  const decadesUpTo = (year: number) => {
    for (; decade <= year; decade += 10) {
      out.push({ kind: 'decade', key: `d${decade}`, decade, future: !past });
      prevYear = null; // a decade label resets the "same year" spacing
    }
  };
  const nextSide = (): Side => (cards++ % 2 === 0 ? 'left' : 'right');
  const placeBirth = () => {
    if (birthPlaced) return;
    birthPlaced = true;
    decadesUpTo(yearOf(birth));
    out.push({ kind: 'birth', key: 'birth', date: birth, side: nextSide(), tight: prevYear === yearOf(birth), future: false });
    prevYear = yearOf(birth);
  };
  const placeToday = () => {
    if (!past) return;
    placeBirth();
    decadesUpTo(yearOf(today));
    out.push({ kind: 'today', key: 'today', date: today, future: false });
    past = false;
    prevYear = null;
  };

  for (const m of moments) {
    if (sortKey(m.date) >= sortKey(birth)) placeBirth();
    if (sortKey(m.date) > today) placeToday();
    const y = yearOf(m.date);
    decadesUpTo(y);
    out.push({ kind: 'moment', key: m.id, m, plan: isPlanned(m, today), side: nextSide(), tight: prevYear === y, future: !past });
    prevYear = y;
  }
  placeToday();
  decadesUpTo(lastYear);
  return out;
}

export interface LifeSummary {
  records: number;
  plans: number;
  age: number | null;
  /** Years left of the expected life, rounded down; null without a birthday. */
  remaining: number | null;
}

export function lifeSummary(life: LifeData, today: string = todayKey()): LifeSummary {
  const plans = life.milestones.filter((m) => isPlanned(m, today)).length;
  const age = life.profile.birthDate ? ageAt(life.profile.birthDate, today)?.years ?? null : null;
  const expectancy = life.profile.lifeExpectancy ?? DEFAULT_LIFE_EXPECTANCY;
  return {
    records: life.milestones.length - plans,
    plans,
    age,
    remaining: age === null ? null : Math.max(0, expectancy - age),
  };
}

// ── Backup file ──────────────────────────────────────────────────────────────

export interface LifeFile {
  app: '24h-circle-planner';
  kind: 'life';
  version: 1;
  exportedAt: string;
  life: LifeData;
  /** Photo id → data URL, so a restore brings the pictures back too. */
  photos: Record<string, string>;
}

export function lifeFile(life: LifeData, photos: Record<string, string>, now = new Date()): LifeFile {
  return { app: '24h-circle-planner', kind: 'life', version: 1, exportedAt: now.toISOString(), life, photos };
}

/** Every photo id the data refers to. */
export function photoIds(life: LifeData): string[] {
  return [...life.milestones.map((m) => m.photo), ...life.family.map((f) => f.photo)].filter((p): p is string => !!p);
}

/**
 * Read a life backup — ours, or the whole-app backup (which carries the life
 * store under its key). Throws on anything else.
 */
export function readLifeFile(text: string): { life: LifeData; photos: Record<string, string> } {
  const parsed = JSON.parse(text) as Record<string, unknown> | null;
  if (!parsed || parsed['app'] !== '24h-circle-planner') throw new Error('not a 24Houring file');
  let raw: unknown = null;
  if (parsed['kind'] === 'life') raw = parsed['life'];
  else if (parsed['data'] && typeof parsed['data'] === 'object') {
    const stored = (parsed['data'] as Record<string, unknown>)[LIFE_KEY];
    raw = typeof stored === 'string' ? JSON.parse(stored) : null;
  }
  const life = decodeLife(raw);
  if (!life) throw new Error('no life data');
  const photos: Record<string, string> = {};
  const given = parsed['photos'];
  if (given && typeof given === 'object') {
    for (const [id, url] of Object.entries(given as Record<string, unknown>)) {
      if (isId(id) && typeof url === 'string' && url.startsWith('data:image/')) photos[id] = url;
    }
  }
  return { life, photos };
}
