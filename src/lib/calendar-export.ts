/**
 * The header's 내보내기 while the calendar is showing: the calendar answers
 * with its own export (the timetable export needs the chart on screen).
 */
export const CALENDAR_EXPORT_EVENT = '24h:calendar-export';

export function requestCalendarExport(): void {
  try {
    window.dispatchEvent(new Event(CALENDAR_EXPORT_EVENT));
  } catch {
    /* non-browser — no-op */
  }
}
