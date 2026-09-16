/**
 * What a calendar entry is, when a repeating one falls, and the order a day's
 * entries are shown in. Pure, so the view and the tests share one source.
 */
import { partsOf, weekdayOf } from './calendar-grid';

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
}

/** A day's entry plus the date it is FILED under (an occurrence of a repeating
 *  entry is shown on another day, but edited and removed at its origin). */
export interface DayEvent extends CalendarEvent {
  from: string;
}

/** Chip colours, kept close to the calendar palettes people expect. */
export const EVENT_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#64748b'] as const;
export const DEFAULT_EVENT_COLOR = EVENT_COLORS[0];

export const isRepeat = (v: unknown): v is Repeat => typeof v === 'string' && (REPEATS as readonly string[]).includes(v);
/** 'HH:MM', 24h. */
export const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** Does an entry filed under `from` fall on `day`? Never before its own date. */
export function occursOn(from: string, ev: Pick<CalendarEvent, 'repeat'>, day: string): boolean {
  if (day < from) return false;
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

/** All-day entries first, then by time, keeping insertion order within a slot. */
export function sortDayEvents<T extends CalendarEvent>(list: T[]): T[] {
  return [...list].sort((x, y) => {
    const xa = !x.time;
    const ya = !y.time;
    if (xa !== ya) return xa ? -1 : 1;
    if (xa && ya) return 0;
    return (x.time ?? '').localeCompare(y.time ?? '');
  });
}

/** Everything showing on `day`: entries filed there plus every repeat that
 *  lands on it, in display order. */
export function dayEvents(events: Record<string, CalendarEvent[]>, day: string): DayEvent[] {
  const out: DayEvent[] = [];
  for (const [from, list] of Object.entries(events)) {
    for (const ev of list) {
      if (occursOn(from, ev, day)) out.push({ ...ev, from });
    }
  }
  return sortDayEvents(out);
}
