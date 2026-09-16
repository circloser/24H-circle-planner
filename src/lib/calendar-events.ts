/**
 * What a calendar entry is, which days it covers, and the order a day's entries
 * are shown in. Pure, so the view and the tests share one source.
 */
import { addDays, dayGap, partsOf, weekdayOf } from './calendar-grid';

/** How an entry repeats. 'none' is a one-off on its own date. */
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export const REPEATS: readonly Repeat[] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

export interface CalendarEvent {
  id: string;
  text: string;
  /** 'HH:MM' for an entry at a time; absent/null = all day. */
  time?: string | null;
  /** Dot (at a time) or chip fill (all day). */
  color?: string;
  repeat?: Repeat;
  /** How many days one occurrence covers (1 = a single day). */
  days?: number;
  /** Occurrence dates dropped from a repeat ("delete this day only"). */
  skip?: string[];
  /** Last date a repeat may start on ("delete this and later" sets it back). */
  until?: string;
}

/** A day's entry: the stored event, the date it is FILED under, and where this
 *  day sits inside a multi-day span (0-based). */
export interface DayEvent extends CalendarEvent {
  from: string;
  /** The date this occurrence starts on (equals `from` unless it repeats). */
  start: string;
  /** 0 on the first day of the span, 1 on the second… */
  index: number;
  /** How many days this occurrence covers. */
  length: number;
}

/** Chip colours, kept close to the calendar palettes people expect. */
export const EVENT_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#64748b'] as const;
export const DEFAULT_EVENT_COLOR = EVENT_COLORS[0];

export const isRepeat = (v: unknown): v is Repeat => typeof v === 'string' && (REPEATS as readonly string[]).includes(v);
/** 'HH:MM', 24h. */
export const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export const spanOf = (ev: Pick<CalendarEvent, 'days'>): number => Math.max(1, Math.floor(ev.days ?? 1));

/** Does an occurrence START on `day`? Ignores multi-day spans and the skip list. */
export function startsOn(from: string, ev: Pick<CalendarEvent, 'repeat' | 'until'>, day: string): boolean {
  if (day < from) return false;
  if (ev.until && day > ev.until) return false;
  const repeat = ev.repeat ?? 'none';
  if (repeat === 'none') return day === from;
  if (repeat === 'daily') return true;
  if (repeat === 'weekly') return weekdayOf(day) === weekdayOf(from);
  const a = partsOf(from);
  const b = partsOf(day);
  // A monthly entry on the 31st simply skips the months without one (the same
  // rule Google applies), rather than sliding to the 28th.
  if (repeat === 'monthly') return a.d === b.d;
  return a.d === b.d && a.m === b.m;
}

/** Kept for readers that only care whether an entry touches a day at all. */
export function occursOn(from: string, ev: Pick<CalendarEvent, 'repeat' | 'until' | 'days' | 'skip'>, day: string): boolean {
  return spanIndexOn(from, ev, day) !== null;
}

/**
 * Where `day` falls inside an occurrence of this entry: its 0-based position in
 * the span, or null when the entry does not cover the day. A skipped occurrence
 * (the user deleted that one day) covers nothing.
 */
export function spanIndexOn(
  from: string,
  ev: Pick<CalendarEvent, 'repeat' | 'until' | 'days' | 'skip'>,
  day: string,
): { index: number; start: string; length: number } | null {
  const length = spanOf(ev);
  const skip = ev.skip ?? [];
  for (let back = 0; back < length; back++) {
    const start = addDays(day, -back);
    if (!startsOn(from, ev, start)) continue;
    if (skip.includes(start)) continue;
    return { index: back, start, length };
  }
  return null;
}

/** All-day (and multi-day) entries first, then by time, keeping insertion order. */
export function sortDayEvents<T extends CalendarEvent>(list: T[]): T[] {
  return [...list].sort((x, y) => {
    const xa = !x.time;
    const ya = !y.time;
    if (xa !== ya) return xa ? -1 : 1;
    if (xa && ya) return spanOf(y) - spanOf(x); // longer bars ride on top
    return (x.time ?? '').localeCompare(y.time ?? '');
  });
}

/** Everything showing on `day`: entries filed there, every repeat that lands on
 *  it, and every multi-day span that covers it — in display order. */
export function dayEvents(events: Record<string, CalendarEvent[]>, day: string): DayEvent[] {
  const out: DayEvent[] = [];
  for (const [from, list] of Object.entries(events)) {
    for (const ev of list) {
      const hit = spanIndexOn(from, ev, day);
      if (hit) out.push({ ...ev, from, start: hit.start, index: hit.index, length: hit.length });
    }
  }
  return sortDayEvents(out);
}

/** Days covered by an entry that starts on `start` (used when moving/creating). */
export const spanDays = (start: string, days: number): string[] =>
  Array.from({ length: Math.max(1, days) }, (_, i) => addDays(start, i));

/** The span a drag across the grid describes, whichever way it was drawn. */
export function dragRange(a: string, b: string): { start: string; days: number } {
  const start = a <= b ? a : b;
  const end = a <= b ? b : a;
  return { start, days: dayGap(start, end) + 1 };
}
