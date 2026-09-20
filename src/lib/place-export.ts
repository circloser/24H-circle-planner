/**
 * The header's 내보내기 while the place map is showing: the page answers with
 * its own export (the world as a picture, or the JSON backup).
 */
export const PLACE_EXPORT_EVENT = '24h:place-export';

export function requestPlaceExport(): void {
  try {
    window.dispatchEvent(new Event(PLACE_EXPORT_EVENT));
  } catch {
    /* non-browser — no-op */
  }
}
