/**
 * Month-grid maths for the calendar view. Pure and date-library free: the two
 * months shown side by side, the cells of one month, and the 'YYYY-MM-DD' keys
 * events are filed under.
 */

/** A month on screen: `m` is 0-11, like Date. */
export interface YearMonth {
  y: number;
  m: number;
}

/** Move by whole months, rolling the year over in both directions. */
export function shiftMonth(at: YearMonth, delta: number): YearMonth {
  const n = at.m + delta;
  return { y: at.y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 };
}

/** The pair shown side by side: the month itself and the one after it. */
export function monthPair(at: YearMonth): [YearMonth, YearMonth] {
  return [at, shiftMonth(at, 1)];
}

/** 'YYYY-MM-DD' in LOCAL time — toISOString() would shift the day by the
 *  timezone offset and file an evening event under the next (or previous) day. */
export function dateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function todayKey(now: Date = new Date()): string {
  return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

export function thisMonth(now: Date = new Date()): YearMonth {
  return { y: now.getFullYear(), m: now.getMonth() };
}

/** Split a 'YYYY-MM-DD' key back into numbers (m is 0-11). */
export function partsOf(key: string): { y: number; m: number; d: number } {
  return { y: Number(key.slice(0, 4)), m: Number(key.slice(5, 7)) - 1, d: Number(key.slice(8, 10)) };
}

/** Day of week for a key: 0 = Sunday … 6 = Saturday. */
export function weekdayOf(key: string): number {
  const { y, m, d } = partsOf(key);
  return new Date(y, m, d).getDay();
}

/** The key `n` days after `key` (`n` may be negative). */
export function addDays(key: string, n: number): string {
  const { y, m, d } = partsOf(key);
  const x = new Date(y, m, d + n);
  return dateKey(x.getFullYear(), x.getMonth(), x.getDate());
}

/** Whole days from `a` to `b`; negative when `b` is the earlier one. Rounded,
 *  so a daylight-saving hour in between never costs a day. */
export function dayGap(a: string, b: string): number {
  const pa = partsOf(a);
  const pb = partsOf(b);
  const ms = new Date(pb.y, pb.m, pb.d).getTime() - new Date(pa.y, pa.m, pa.d).getTime();
  return Math.round(ms / 86_400_000);
}

export interface DayCell {
  day: number;
  /** The 'YYYY-MM-DD' key this day's events are filed under. */
  key: string;
  /** False for the neighbouring-month days that pad the first and last rows. */
  inMonth: boolean;
}

/** Cells per row, and rows per month — always five, so the grid keeps one
 *  height and every week gets a taller row. A month that needs a sixth week
 *  (it starts late in the week) hands its last days to the next month: they
 *  open that month's grid, exactly as a paper planner carries them over. */
export const WEEK_DAYS = 7;
export const MONTH_ROWS = 5;

/**
 * One month as five weeks starting Sunday. The leading and trailing cells carry
 * the neighbouring months' days (marked `inMonth: false`) rather than blanks,
 * so every square is a real date the user can drop a plan on.
 */
export function monthCells(y: number, m: number): DayCell[] {
  const lead = new Date(y, m, 1).getDay();
  const start = new Date(y, m, 1 - lead);
  return Array.from({ length: WEEK_DAYS * MONTH_ROWS }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return {
      day: d.getDate(),
      key: dateKey(d.getFullYear(), d.getMonth(), d.getDate()),
      inMonth: d.getMonth() === m && d.getFullYear() === y,
    };
  });
}

/** The month after `y`/`m`. */
export const nextMonthOf = (y: number, m: number): { y: number; m: number } =>
  (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 });

/**
 * Which month's grid a day is drawn in, and at which cell: its own month —
 * unless it falls past the fifth week, when the next month's first row shows it.
 */
export function homeOf(key: string): { y: number; m: number; index: number } {
  const { y, m } = partsOf(key);
  const own = monthCells(y, m).findIndex((c) => c.key === key);
  if (own >= 0) return { y, m, index: own };
  const next = nextMonthOf(y, m);
  return { ...next, index: monthCells(next.y, next.m).findIndex((c) => c.key === key) };
}
