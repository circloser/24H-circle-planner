/**
 * Me — the middle of the relation map, written down.
 *
 * The map is about the people around me, and the circle in the middle was a
 * name and a face. This is the rest of that circle: a record of my own, kept
 * the way the rest of the app keeps things — dated, added to, never
 * overwritten — so that it reads, over the years, as a record of who I was
 * at each point, not only who I am today.
 *
 *  · a résumé: schooling, work, qualifications, skills, what I have done;
 *  · my MBTI, each time I took it — types change, and the change is the story;
 *  · a hundred questions, each answer kept with the day it was written, and
 *    the answers before it kept too;
 *  · how I felt, on a five-point scale, day by day.
 *
 * It stays on the device (and in Pro sync, like everything else). Written
 * this way it is ready to be read by the memoir and by a birth chart later,
 * without anyone having to write it twice.
 */

/** Kinds of line on the résumé. */
export const RESUME_KINDS = ['education', 'career', 'award', 'skill', 'activity', 'contact', 'home'] as const;
export type ResumeKind = (typeof RESUME_KINDS)[number];

export interface ResumeEntry {
  k: ResumeKind;
  /** "OO대학교 경영학과", "△△ 주식회사 · 마케팅". */
  v: string;
  /** From and to: 'YYYY' or 'YYYY-MM'. An entry with no end is still going. */
  from?: string;
  to?: string;
}

/** A dated answer: what was said, and the day it was said. */
export interface Dated { v: string; at: string }

export type MoodLevel = 1 | 2 | 3 | 4 | 5;
export const MOOD_LEVELS: readonly MoodLevel[] = [1, 2, 3, 4, 5];

export interface MoodEntry {
  /** 'YYYY-MM-DD'. */
  at: string;
  v: MoodLevel;
  note?: string;
}

export interface RelationMe {
  name?: string;
  photo?: string;
  resume?: ResumeEntry[];
  /** Every type taken, oldest first. */
  mbti?: Dated[];
  /** Question id → every answer given to it, oldest first. */
  answers?: Record<string, Dated[]>;
  moods?: MoodEntry[];
}

export const MAX_RESUME = 80;
export const MAX_RESUME_TEXT = 80;
export const MAX_MBTI = 40;
export const MAX_ANSWER = 500;
/** Answers kept per question: enough for one a year for a very long time. */
export const MAX_ANSWER_VERSIONS = 30;
export const MAX_MOODS = 1500;
export const MAX_MOOD_NOTE = 80;

/** The sixteen types, as four letters. */
export const MBTI_AXES = [['E', 'I'], ['S', 'N'], ['T', 'F'], ['J', 'P']] as const;
export const isMbti = (v: unknown): v is string =>
  typeof v === 'string' && /^[EI][SN][TF][JP]$/.test(v);

const isDay = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isYearMonth = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}(-(0[1-9]|1[0-2]))?$/.test(v) && Number(v.slice(0, 4)) >= 1900
  && Number(v.slice(0, 4)) <= 2200;
const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const cut = v.slice(0, max).trim();
  return cut || undefined;
};

// ── Decoding (strict, byte-stable: fixed field order, empties not written) ──

function cleanResume(v: unknown): ResumeEntry[] {
  const out: ResumeEntry[] = [];
  for (const item of Array.isArray(v) ? v : []) {
    const o = item as Record<string, unknown> | null;
    const k = o?.['k'];
    if (typeof k !== 'string' || !(RESUME_KINDS as readonly string[]).includes(k)) continue;
    const value = text(o?.['v'], MAX_RESUME_TEXT);
    if (!value) continue;
    out.push({
      k: k as ResumeKind,
      v: value,
      ...(isYearMonth(o?.['from']) ? { from: o?.['from'] as string } : {}),
      ...(isYearMonth(o?.['to']) ? { to: o?.['to'] as string } : {}),
    });
  }
  return out.slice(-MAX_RESUME);
}

function cleanDated(v: unknown, max: number, valid: (s: string) => boolean = () => true): Dated[] {
  const out: Dated[] = [];
  for (const item of Array.isArray(v) ? v : []) {
    const o = item as Record<string, unknown> | null;
    const value = text(o?.['v'], max);
    if (!value || !valid(value) || !isDay(o?.['at'])) continue;
    out.push({ v: value, at: o?.['at'] as string });
  }
  return out;
}

function cleanAnswers(v: unknown): Record<string, Dated[]> {
  const out: Record<string, Dated[]> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  // Sorted by id, so the same answers are always written in the same order.
  for (const id of Object.keys(v as Record<string, unknown>).sort()) {
    if (!/^q\d{3}$/.test(id)) continue;
    const list = cleanDated((v as Record<string, unknown>)[id], MAX_ANSWER).slice(-MAX_ANSWER_VERSIONS);
    if (list.length) out[id] = list;
  }
  return out;
}

function cleanMoods(v: unknown): MoodEntry[] {
  const out: MoodEntry[] = [];
  for (const item of Array.isArray(v) ? v : []) {
    const o = item as Record<string, unknown> | null;
    const level = o?.['v'];
    if (!isDay(o?.['at']) || !(MOOD_LEVELS as readonly unknown[]).includes(level)) continue;
    const note = text(o?.['note'], MAX_MOOD_NOTE);
    out.push({ at: o?.['at'] as string, v: level as MoodLevel, ...(note ? { note } : {}) });
  }
  return out.slice(-MAX_MOODS);
}

/** Everything written about me, cleaned. `name` and `photo` are the caller's
 *  (they were there before this record was). */
export function cleanMeRecord(me: Record<string, unknown>): Omit<RelationMe, 'name' | 'photo'> {
  const resume = cleanResume(me['resume']);
  const mbti = cleanDated(me['mbti'], 4, isMbti).slice(-MAX_MBTI);
  const answers = cleanAnswers(me['answers']);
  const moods = cleanMoods(me['moods']);
  return {
    ...(resume.length ? { resume } : {}),
    ...(mbti.length ? { mbti } : {}),
    ...(Object.keys(answers).length ? { answers } : {}),
    ...(moods.length ? { moods } : {}),
  };
}

// ── Reading it back ─────────────────────────────────────────────────────────

/** The newest of a dated list: the last written among the latest day. */
export function latest(list: readonly Dated[] | undefined): Dated | null {
  if (!list?.length) return null;
  let best = list[0];
  for (const d of list) if (d.at >= best.at) best = d;
  return best;
}

/** A dated list, newest first (among one day, the one written later first). */
export const newestFirst = <T extends { at: string }>(list: readonly T[] | undefined): T[] =>
  (list ?? []).map((d, i) => ({ d, i }))
    .sort((a, b) => b.d.at.localeCompare(a.d.at) || b.i - a.i)
    .map((x) => x.d);

/** Résumé lines of one kind, the most recent first; an unfinished one ("still
 *  going") counts as the most recent of all. */
export function resumeOf(me: RelationMe, k: ResumeKind): ResumeEntry[] {
  const key = (e: ResumeEntry) => (e.to ? e.to : '9999') + (e.from ?? '');
  return (me.resume ?? []).filter((e) => e.k === k).sort((a, b) => key(b).localeCompare(key(a)));
}

/** How many of the hundred have an answer. */
export const answered = (me: RelationMe): number => Object.keys(me.answers ?? {}).length;

/** The average of the last `n` moods, to one decimal; null with none. */
export function moodAverage(me: RelationMe, n = 30): number | null {
  const last = newestFirst(me.moods).slice(0, n);
  if (!last.length) return null;
  return Math.round((last.reduce((s, m) => s + m.v, 0) / last.length) * 10) / 10;
}
