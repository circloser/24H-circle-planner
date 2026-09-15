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

export interface DayCell {
  day: number;
  /** The 'YYYY-MM-DD' key this day's events are filed under. */
  key: string;
}

/**
 * One month as a flat list of cells, weeks starting Sunday. Leading and
 * trailing blanks are null so the list always divides into rows of 7.
 */
export function monthCells(y: number, m: number): Array<DayCell | null> {
  const lead = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells: Array<DayCell | null> = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push({ day: d, key: dateKey(y, m, d) });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
