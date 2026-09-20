/**
 * Relation — the fourth tab, and the first that is not a scale of time.
 *
 * The timetable is a day, the calendar a month, the life line a whole life;
 * this is the axis of people. Me in the middle, and everyone who matters drawn
 * around me on rings — family nearest, then friends, work, and the rest.
 *
 * What it is NOT: a social network. There are no accounts but the owner's, no
 * matching, no invitations, no messages, and nobody is ever told they are on
 * someone's map. It is a private note about the people in a life, kept on the
 * device like everything else here.
 *
 * This module is the data layer: the stored envelope and its strict decode
 * (the same value travels in the Pro sync blob, so load → save must be
 * byte-stable), the arithmetic of how long it has been and whose birthday is
 * near, and the backup file.
 */
import { todayKey } from './calendar-grid';

export const RELATION_KEY = '24h-circle-planner.relation';

/** Rings, from the middle outward. The order IS the drawing order. */
export const RELATION_GROUPS = ['family', 'friend', 'work', 'other'] as const;
export type RelationGroup = (typeof RELATION_GROUPS)[number];

/** How near the middle someone sits on their own ring: five rungs, 1 the
 *  furthest and 5 the nearest. (It was three until version 2 — see
 *  migrateRelation, which moves the old middle rung to the new one.) */
export type Closeness = 1 | 2 | 3 | 4 | 5;
export const CLOSENESS: readonly Closeness[] = [1, 2, 3, 4, 5];

export interface Person {
  id: string;
  name: string;
  group: RelationGroup;
  /** Free text: "어머니", "대학 동기", "전 직장 상사". */
  relation?: string;
  closeness: Closeness;
  /** 'YYYY-MM-DD', or 'MM-DD' when the year is not known. */
  birthday?: string;
  /** 'YYYY-MM-DD' — the last time there was any contact. */
  lastContact?: string;
  note?: string;
  /** A photo id in this device's picture store (Pro). */
  photo?: string;
  /** Always show the name, at any zoom. */
  pinned?: boolean;
  /** Put here by hand: turns around the middle (0–1) and how far out (0–1.6).
   *  Without it the ring decides, and the ring never moves anyone again. */
  at?: { a: number; r: number };
  /** The life record's family member this came from (one-way: Life → here). */
  lifeFamilyId?: string;
  createdAt: string;
}

/** A line drawn between two people rather than between me and someone. */
export interface RelationLink {
  source: string;
  target: string;
  label?: string;
}

export interface RelationData {
  version: 2;
  me: { name?: string; photo?: string };
  people: Person[];
  links: RelationLink[];
  updatedAt: string;
}

export const MAX_PERSON_NAME = 40;
export const MAX_RELATION_TEXT = 40;
export const MAX_PERSON_NOTE = 200;
export const MAX_LINK_LABEL = 20;

export const emptyRelation = (): RelationData => ({
  version: 2,
  me: {},
  people: [],
  links: [],
  updatedAt: '',
});

// ── Dates ────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** A birthday: a whole date, or a month and a day when the year is unknown. */
export function birthdayParts(v: unknown): { m: number; d: number; y: number | null } | null {
  if (typeof v !== 'string') return null;
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const short = /^(\d{2})-(\d{2})$/.exec(v);
  const y = full ? Number(full[1]) : null;
  const m = Number(full ? full[2] : short ? short[1] : NaN);
  const d = Number(full ? full[3] : short ? short[2] : NaN);
  if (!Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (y !== null && (y < 1900 || y > 2200)) return null;
  // A day that month cannot hold (29 February is allowed: it comes round).
  if (d > new Date(2020, m, 0).getDate()) return null;
  return { m, d, y };
}

export const isBirthday = (v: unknown): v is string => birthdayParts(v) !== null;

const isDay = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

const dayNumber = (key: string): number => Math.floor(Date.parse(`${key}T00:00:00Z`) / DAY_MS);

/** Days since the last contact; null when there has never been one recorded. */
export function daysSinceContact(p: Pick<Person, 'lastContact'>, today: string = todayKey()): number | null {
  if (!isDay(p.lastContact) || !isDay(today)) return null;
  return Math.max(0, dayNumber(today) - dayNumber(p.lastContact));
}

/** Out of touch from here on. */
export const STALE_DAYS = 90;
/** Where the fading stops — as faint as anyone gets. */
export const FADED_DAYS = 365;
export const FADED_MIN = 0.3;

/**
 * How brightly someone is drawn. Full until STALE_DAYS, then down to
 * FADED_MIN by FADED_DAYS — a year of silence is as quiet as it gets, and
 * "contacted today" brings them straight back.
 */
export function contactFade(p: Pick<Person, 'lastContact'>, today: string = todayKey()): number {
  const days = daysSinceContact(p, today);
  if (days === null || days <= STALE_DAYS) return 1;
  if (days >= FADED_DAYS) return FADED_MIN;
  return 1 - ((days - STALE_DAYS) / (FADED_DAYS - STALE_DAYS)) * (1 - FADED_MIN);
}

export const isOutOfTouch = (p: Pick<Person, 'lastContact'>, today: string = todayKey()): boolean => {
  const days = daysSinceContact(p, today);
  return days !== null && days >= STALE_DAYS;
};

/** Days until the next birthday, counting today as 0; null without one. */
export function daysToBirthday(p: Pick<Person, 'birthday'>, today: string = todayKey()): number | null {
  const b = birthdayParts(p.birthday);
  if (!b || !isDay(today)) return null;
  const [ty, tm, td] = today.split('-').map(Number);
  for (const year of [ty, ty + 1]) {
    // 29 February in a year that has none comes round on the 1st of March.
    const last = new Date(year, b.m, 0).getDate();
    const day = Math.min(b.d, last);
    if (year > ty || b.m > tm || (b.m === tm && day >= td)) {
      return Math.round((Date.UTC(year, b.m - 1, day) - Date.UTC(ty, tm - 1, td)) / DAY_MS);
    }
  }
  return null;
}

/** A birthday close enough to be worth a ring around the name. */
export const BIRTHDAY_SOON_DAYS = 30;

export const hasBirthdaySoon = (p: Pick<Person, 'birthday'>, today: string = todayKey()): boolean => {
  const days = daysToBirthday(p, today);
  return days !== null && days <= BIRTHDAY_SOON_DAYS;
};

/** Is this birthday in the month `today` falls in? */
export function isBirthdayThisMonth(p: Pick<Person, 'birthday'>, today: string = todayKey()): boolean {
  const b = birthdayParts(p.birthday);
  return !!b && b.m === Number(today.slice(5, 7));
}

/** The age this birthday turns on its next round; null without a year. */
export function turningAge(p: Pick<Person, 'birthday'>, today: string = todayKey()): number | null {
  const b = birthdayParts(p.birthday);
  if (!b || b.y === null) return null;
  const days = daysToBirthday(p, today);
  if (days === null) return null;
  const year = Number(today.slice(0, 4)) + (days > 0 && Number(today.slice(5, 7)) > b.m ? 1 : 0);
  return Math.max(0, year - b.y);
}

// ── Stored envelope ──────────────────────────────────────────────────────────

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const cut = v.slice(0, max);
  return cut.trim() ? cut : undefined;
};
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;
const num01 = (v: unknown, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v * 1e4) / 1e4 : null;

function cleanPerson(v: unknown): Person | null {
  const o = v as Record<string, unknown> | null;
  if (!o || !isId(o['id'])) return null;
  const name = str(o['name'], MAX_PERSON_NAME);
  if (!name) return null;
  const g = o['group'];
  const group: RelationGroup = typeof g === 'string' && (RELATION_GROUPS as readonly string[]).includes(g)
    ? (g as RelationGroup) : 'other';
  const c = Number(o['closeness']);
  const closeness: Closeness = (CLOSENESS as readonly number[]).includes(c) ? (c as Closeness) : 3;
  const relation = str(o['relation'], MAX_RELATION_TEXT);
  const note = str(o['note'], MAX_PERSON_NOTE);
  const at = o['at'] as Record<string, unknown> | undefined;
  const a = at ? num01(at['a'], 1) : null;
  const r = at ? num01(at['r'], 1.6) : null;
  // Fixed field order, optional fields only when present: load → save is stable.
  return {
    id: o['id'],
    name,
    group,
    ...(relation ? { relation } : {}),
    closeness,
    ...(isBirthday(o['birthday']) ? { birthday: o['birthday'] } : {}),
    ...(isDay(o['lastContact']) ? { lastContact: o['lastContact'] } : {}),
    ...(note ? { note } : {}),
    ...(isId(o['photo']) ? { photo: o['photo'] } : {}),
    ...(o['pinned'] === true ? { pinned: true } : {}),
    ...(a !== null && r !== null ? { at: { a, r } } : {}),
    ...(isId(o['lifeFamilyId']) ? { lifeFamilyId: o['lifeFamilyId'] } : {}),
    createdAt: typeof o['createdAt'] === 'string' ? o['createdAt'] : '',
  };
}

/** A link only survives if both of its ends do, and it is not a loop. */
function cleanLinks(v: unknown, people: readonly Person[]): RelationLink[] {
  const known = new Set(people.map((p) => p.id));
  const seen = new Set<string>();
  const out: RelationLink[] = [];
  for (const item of Array.isArray(v) ? v : []) {
    const o = item as Record<string, unknown> | null;
    if (!o || !isId(o['source']) || !isId(o['target'])) continue;
    const [source, target] = [o['source'], o['target']];
    if (source === target || !known.has(source) || !known.has(target)) continue;
    // One line between two people, whichever way round it was drawn.
    const key = source < target ? `${source}|${target}` : `${target}|${source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = str(o['label'], MAX_LINK_LABEL);
    out.push({ source, target, ...(label ? { label } : {}) });
  }
  return out;
}

/**
 * Bring an older stored version up to the current shape.
 *
 * Version 1 had three rungs of closeness, version 2 has five. The old rungs
 * move to 2, 3 and 4 — the words each one was labelled with are the same
 * words, and the two new rungs are added at the ends rather than in the
 * middle, so nobody's place on the map changes meaning overnight.
 */
export function migrateRelation(parsed: unknown): Record<string, unknown> | null {
  const p = parsed as Record<string, unknown> | null;
  if (!p || typeof p !== 'object') return null;
  if (p['version'] === 2) return p;
  if (p['version'] !== 1) return null;
  const people = (Array.isArray(p['people']) ? p['people'] : []).map((v) => {
    const o = v as Record<string, unknown> | null;
    if (!o || typeof o !== 'object') return v;
    const c = Number(o['closeness']);
    return { ...o, closeness: c === 1 ? 2 : c === 3 ? 4 : 3 };
  });
  return { ...p, version: 2, people };
}

/** Written by a newer version of the app than this one. */
export function isNewerRelation(parsed: unknown): boolean {
  const v = (parsed as Record<string, unknown> | null)?.['version'];
  return typeof v === 'number' && v > 2;
}

/** Strict decode: anything unknown or broken is dropped, never thrown on. */
export function decodeRelation(parsed: unknown): RelationData | null {
  const p = migrateRelation(parsed);
  if (!p) return null;
  const seen = new Set<string>();
  const people = (Array.isArray(p['people']) ? p['people'] : [])
    .map(cleanPerson)
    .filter((x): x is Person => !!x && !seen.has(x.id) && !!seen.add(x.id));
  const me = (p['me'] ?? {}) as Record<string, unknown>;
  const myName = str(me['name'], MAX_PERSON_NAME);
  return {
    version: 2,
    me: {
      ...(myName ? { name: myName } : {}),
      ...(isId(me['photo']) ? { photo: me['photo'] } : {}),
    },
    people,
    links: cleanLinks(p['links'], people),
    updatedAt: typeof p['updatedAt'] === 'string' ? p['updatedAt'] : '',
  };
}

/** What is stored (and synced): the same cleaning as a load, so every save has
 *  one canonical shape whatever order an edit built its fields in. */
export const encodeRelation = (data: RelationData): RelationData => decodeRelation(data) ?? emptyRelation();

// ── Free plan ────────────────────────────────────────────────────────────────

/** Free: this many people and this many person-to-person lines. A limit only
 *  ever stops ADDING — nothing already written is hidden or lost. */
export const FREE_RELATION_PEOPLE = 40;
export const FREE_RELATION_LINKS = 20;

export const canAddPerson = (d: RelationData, pro: boolean): boolean =>
  pro || d.people.length < FREE_RELATION_PEOPLE;
export const canAddLink = (d: RelationData, pro: boolean): boolean =>
  pro || d.links.length < FREE_RELATION_LINKS;

// ── The line under the map ───────────────────────────────────────────────────

export interface RelationSummary {
  people: number;
  byGroup: Record<RelationGroup, number>;
  outOfTouch: number;
  birthdaysThisMonth: number;
}

export function relationSummary(d: RelationData, today: string = todayKey()): RelationSummary {
  const byGroup = { family: 0, friend: 0, work: 0, other: 0 } as Record<RelationGroup, number>;
  let outOfTouch = 0;
  let birthdaysThisMonth = 0;
  for (const p of d.people) {
    byGroup[p.group] += 1;
    if (isOutOfTouch(p, today)) outOfTouch += 1;
    if (isBirthdayThisMonth(p, today)) birthdaysThisMonth += 1;
  }
  return { people: d.people.length, byGroup, outOfTouch, birthdaysThisMonth };
}

/** Name, relation and note, matched loosely — what a search box is for. */
export function findPeople(d: RelationData, query: string): Person[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return d.people.filter((p) =>
    p.name.toLowerCase().includes(q)
    || (p.relation ?? '').toLowerCase().includes(q)
    || (p.note ?? '').toLowerCase().includes(q));
}

// ── Backup file ──────────────────────────────────────────────────────────────

export interface RelationFile {
  app: '24h-circle-planner';
  kind: 'relation';
  version: 1;
  exportedAt: string;
  relation: RelationData;
  /** Photo id → data URL, so a restore brings the faces back too. */
  photos: Record<string, string>;
}

export function relationFile(relation: RelationData, photos: Record<string, string>, now = new Date()): RelationFile {
  return { app: '24h-circle-planner', kind: 'relation', version: 1, exportedAt: now.toISOString(), relation, photos };
}

/** Every photo id the data refers to. */
export function relationPhotoIds(d: RelationData): string[] {
  return [d.me.photo, ...d.people.map((p) => p.photo)].filter((p): p is string => !!p);
}

/**
 * Read a relation backup — ours, or the whole-app backup (which carries the
 * store under its key). Throws on anything else.
 */
export function readRelationFile(text: string): { relation: RelationData; photos: Record<string, string> } {
  const parsed = JSON.parse(text) as Record<string, unknown> | null;
  if (!parsed || parsed['app'] !== '24h-circle-planner') throw new Error('not a 24Houring file');
  let raw: unknown = null;
  if (parsed['kind'] === 'relation') raw = parsed['relation'];
  else if (parsed['data'] && typeof parsed['data'] === 'object') {
    const stored = (parsed['data'] as Record<string, unknown>)[RELATION_KEY];
    raw = typeof stored === 'string' ? JSON.parse(stored) : null;
  }
  const relation = decodeRelation(raw);
  if (!relation) throw new Error('no relation data');
  const photos: Record<string, string> = {};
  const given = parsed['photos'];
  if (given && typeof given === 'object') {
    for (const [id, url] of Object.entries(given as Record<string, unknown>)) {
      if (isId(id) && typeof url === 'string' && url.startsWith('data:image/')) photos[id] = url;
    }
  }
  return { relation, photos };
}
