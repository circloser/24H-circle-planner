import { slug } from './export/_internal';
import { APP_URL } from './export/watermark';

export type ShareOutcome = 'shared' | 'downloaded';

/**
 * Share the current chart as a PNG image via the Web Share API — on mobile this
 * opens the native share sheet (Instagram, KakaoTalk, Messages, …). When the
 * platform can't share files (most desktop browsers), it falls back to
 * downloading the image so the user can upload it manually.
 *
 * Throws on genuine failures. Callers should swallow `AbortError` (the user
 * dismissed the share sheet — not an error).
 */
export async function shareChartImage(
  svg: SVGSVGElement,
  scheduleName: string,
  shareText: string,
): Promise<ShareOutcome> {
  const { exportPng } = await import('./export/png');
  const blob = await exportPng(svg, { size: 1080, transparent: false, qrUrl: APP_URL });
  return shareOrDownload(blob, `24h-${slug(scheduleName) || 'timetable'}.png`, shareText);
}

/**
 * Hand a PNG to the native share sheet where the platform can share files
 * (mobile), otherwise download it. Throws `AbortError` when the user closes the
 * share sheet.
 */
export async function shareOrDownload(blob: Blob, filename: string, shareText: string): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: 'image/png' });

  // Prefer native file sharing when available (mobile).
  if (
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] }) &&
    typeof navigator.share === 'function'
  ) {
    await navigator.share({ files: [file], title: '24Houring', text: shareText });
    return 'shared';
  }

  // Fallback: download the image.
  downloadBlob(blob, filename);
  return 'downloaded';
}

/** Save a blob as a file. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
