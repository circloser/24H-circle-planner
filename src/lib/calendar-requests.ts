/**
 * Things the header menus ask of the calendar: connect a Google calendar
 * (⚙ settings) or open a decorating tool (디자인 → 캘린더 꾸미기).
 *
 * The calendar may not be on screen yet — the menu switches to it first — so
 * the request is kept until the calendar takes it, on mount or on the event.
 */
export type CalendarRequest =
  | { kind: 'ical' }
  | { kind: 'decor'; tool: 'sticker' | 'tape' | 'photo' };

export const CALENDAR_REQUEST_EVENT = '24h:calendar-request';

let pending: CalendarRequest | null = null;

export function requestCalendar(req: CalendarRequest): void {
  pending = req;
  try {
    window.dispatchEvent(new Event(CALENDAR_REQUEST_EVENT));
  } catch {
    /* non-browser — the request waits for the calendar */
  }
}

/** The waiting request, once. */
export function takeCalendarRequest(): CalendarRequest | null {
  const req = pending;
  pending = null;
  return req;
}
