import { exportPng } from './png';

/** Blob → plain base64 (chunked so big arrays don't blow the arg limit). */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** The worker rejects share PNGs above ~360KB decoded — callers skip the image
 *  (falling back to the generic og card) rather than failing the share. */
const MAX_B64 = 480_000;

/**
 * Square 1080px render of the ring (watermark included) for the Android
 * home-screen widget — the widget shows this image square, so the 1200x630
 * unfurl card would waste half the pixels. Returns plain base64 or null.
 */
export async function buildSquarePngBase64(svg: SVGSVGElement): Promise<string | null> {
  try {
    const blob = await exportPng(svg, { size: 1080, transparent: false });
    const b64 = await blobToBase64(blob);
    return b64.length > MAX_B64 ? null : b64;
  } catch {
    return null;
  }
}

/**
 * Transparent 1080px render for the Android home-screen widget: no page
 * background (the launcher wallpaper shows through), a frosted disc under the
 * ring so the hour numbers stay legible on any wallpaper, no wordmark (it is
 * the user's own phone, inside our own app), and no hub title — the widget
 * paints a live clock into the hub natively. `haloR` is the disc radius in SVG
 * units (the chart's outer radius + enough to cover the hour labels).
 */
export async function buildWidgetPngBase64(svg: SVGSVGElement, haloR: number): Promise<string | null> {
  try {
    const blob = await exportPng(svg, {
      size: 1080,
      transparent: true,
      watermark: false,
      stripSelectors: ['[data-hub-title]'],
      haloDisc: { cx: 500, cy: 500, r: haloR, opacity: 0.62 },
    });
    const b64 = await blobToBase64(blob);
    return b64.length > MAX_B64 ? null : b64;
  } catch {
    return null;
  }
}

/**
 * Compose the 1200x630 link-unfurl card for a server-stored share: the current
 * theme's background colour with the ring (watermark included) centered on it.
 * Returns plain base64 (not a data URL) for the POST /api/share body, or null
 * when anything fails — the share is still created, just with the generic
 * fallback og-image.
 */
export async function buildOgPngBase64(svg: SVGSVGElement): Promise<string | null> {
  try {
    const blob = await exportPng(svg, { size: 1080, transparent: false });
    const bmp = await createImageBitmap(blob);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 630;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, 1200, 630);
      const side = 600; // ring size on the card (slightly bleeds top/bottom edges: 630 - 600 = 30px total margin)
      ctx.drawImage(bmp, (1200 - side) / 2, (630 - side) / 2, side, side);
      const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!out) return null;
      const b64 = await blobToBase64(out);
      return b64.length > MAX_B64 ? null : b64;
    } finally {
      bmp.close();
    }
  } catch {
    return null;
  }
}
