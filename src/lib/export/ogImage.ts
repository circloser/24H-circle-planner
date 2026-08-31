import { exportPng } from './png';

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
      const bytes = new Uint8Array(await out.arrayBuffer());
      let bin = '';
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      const b64 = btoa(bin);
      // The worker rejects anything above ~360KB decoded — skip rather than fail.
      return b64.length > 480_000 ? null : b64;
    } finally {
      bmp.close();
    }
  } catch {
    return null;
  }
}
