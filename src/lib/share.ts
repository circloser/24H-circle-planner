import { exportPng } from './export/png';
import { slug } from './export/_internal';

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
  const blob = await exportPng(svg, { size: 1080, transparent: false });
  const filename = `24h-${slug(scheduleName) || 'timetable'}.png`;
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}
