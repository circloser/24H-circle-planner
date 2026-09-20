/**
 * The header's 내보내기 while the relation map is showing: the page answers
 * with its own export (the map as a picture, or the JSON backup), the way the
 * calendar and the life line do.
 */
export const RELATION_EXPORT_EVENT = '24h:relation-export';

export function requestRelationExport(): void {
  try {
    window.dispatchEvent(new Event(RELATION_EXPORT_EVENT));
  } catch {
    /* non-browser — no-op */
  }
}
