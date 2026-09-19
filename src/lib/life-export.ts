/**
 * The header's 내보내기 while the life page is showing: the page answers with
 * its own export (a long image, or the JSON backup), like the calendar does.
 */
export const LIFE_EXPORT_EVENT = '24h:life-export';

export function requestLifeExport(): void {
  try {
    window.dispatchEvent(new Event(LIFE_EXPORT_EVENT));
  } catch {
    /* non-browser — no-op */
  }
}
