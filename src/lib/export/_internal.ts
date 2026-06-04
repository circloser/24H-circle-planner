/**
 * Internal utility helpers shared across the export pipeline.
 * Not exported from the public export API surface.
 */

/**
 * Convert an ArrayBuffer to a base64 string.
 * Used for loading TTF/OTF binary data into jsPDF's addFileToVFS.
 */
export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * Create a slug from a schedule name for use in filenames.
 * Lowercase + replace whitespace with '-' + strip non-[a-z0-9-가-힣] characters.
 * Preserves Korean (한글) characters as-is.
 */
export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-가-힣]/g, '');
}

/**
 * Format a Date as yyyyMMdd for filename use.
 */
export function formatDateYYYYMMDD(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
