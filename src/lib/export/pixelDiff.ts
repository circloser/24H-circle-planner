import { injectFontFaceStyle } from './inlineFonts';

export interface PixelDiffResult {
  glassDiffPct: number;
  nonGlassDiffPct: number;
  glassPixelCount: number;
  nonGlassPixelCount: number;
}

/**
 * Builds a stencil mask for the glass annulus region in a square image of `size` pixels.
 *
 * Pixel is classified as "Glass" if its distance from center is between innerR and outerR
 * (in SVG viewBox units — the mask is computed in the scaled pixel space).
 *
 * For a 1080×1080 image and SVG viewBox 0 0 1000 1000:
 *   center = (540, 540), innerR_px = 350 * (1080/1000) = 378, outerR_px = 460 * 1.08 = 496.8
 *
 * Returns a Uint8Array of length size*size: 1 = Glass region, 0 = non-Glass.
 */
export function buildAnnulusStencil(
  size: number,
  innerR: number,
  outerR: number,
): Uint8Array {
  const stencil = new Uint8Array(size * size);
  const cx = size / 2;
  const cy = size / 2;
  const innerR2 = innerR * innerR;
  const outerR2 = outerR * outerR;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = px - cx;
      const dy = py - cy;
      const dist2 = dx * dx + dy * dy;
      stencil[py * size + px] = dist2 >= innerR2 && dist2 <= outerR2 ? 1 : 0;
    }
  }

  return stencil;
}

/**
 * Compares the on-screen SVG render against an exported PNG Blob using pixelmatch.
 *
 * Buckets pixel differences into Glass annulus vs non-Glass regions using the
 * annulus stencil mask.
 *
 * Acceptance thresholds (per architect's spec G7):
 *   glassDiffPct ≤ 12%
 *   nonGlassDiffPct ≤ 5%
 */
export async function compareScreenToExport(
  screenSvg: SVGSVGElement,
  exportPng: Blob,
  options: { size: number },
): Promise<PixelDiffResult> {
  const { size } = options;

  // SVG viewBox is 0 0 1000 1000; scale factor = size/1000
  const scale = size / 1000;
  // RING constants from svg-geometry.ts (T11: innerR updated 350→100, outerR unchanged 460)
  // For 1080×1080: innerR_px = 100 * 1.08 = 108.0, outerR_px = 460 * 1.08 = 496.8
  const innerRPx = 100 * scale;
  const outerRPx = 460 * scale;

  // Build annulus stencil
  const stencil = buildAnnulusStencil(size, innerRPx, outerRPx);

  // Render screen SVG to reference canvas at `size`×`size`
  const refCanvas = await renderSvgToCanvas(screenSvg, size);
  const refCtx = refCanvas.getContext('2d');
  if (!refCtx) throw new Error('compareScreenToExport: could not get ref canvas context');
  const refData = refCtx.getImageData(0, 0, size, size).data;

  // Decode export PNG to canvas
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = size;
  exportCanvas.height = size;
  const exportCtx = exportCanvas.getContext('2d');
  if (!exportCtx) throw new Error('compareScreenToExport: could not get export canvas context');

  const exportUrl = URL.createObjectURL(exportPng);
  try {
    const exportImg = new Image();
    exportImg.src = exportUrl;
    await exportImg.decode();
    exportCtx.drawImage(exportImg, 0, 0, size, size);
  } finally {
    URL.revokeObjectURL(exportUrl);
  }
  const exportData = exportCtx.getImageData(0, 0, size, size).data;

  // Dynamic-import pixelmatch (keep out of main bundle)
  const { default: pixelmatch } = await import('pixelmatch');

  // Run pixelmatch
  const diffData = new Uint8ClampedArray(size * size * 4);
  pixelmatch(refData, exportData, diffData, size, size, { threshold: 0.1 });

  // Bucket diff pixels by Glass vs non-Glass
  let glassPixelCount = 0;
  let nonGlassPixelCount = 0;
  let glassDiffCount = 0;
  let nonGlassDiffCount = 0;

  for (let i = 0; i < size * size; i++) {
    const r = diffData[i * 4];
    const g = diffData[i * 4 + 1];
    const b = diffData[i * 4 + 2];
    // pixelmatch marks differing pixels as red (255, 0, 0)
    const isDiff = r === 255 && g === 0 && b === 0;

    if (stencil[i] === 1) {
      glassPixelCount++;
      if (isDiff) glassDiffCount++;
    } else {
      nonGlassPixelCount++;
      if (isDiff) nonGlassDiffCount++;
    }
  }

  const glassDiffPct = glassPixelCount > 0 ? (glassDiffCount / glassPixelCount) * 100 : 0;
  const nonGlassDiffPct =
    nonGlassPixelCount > 0 ? (nonGlassDiffCount / nonGlassPixelCount) * 100 : 0;

  return { glassDiffPct, nonGlassDiffPct, glassPixelCount, nonGlassPixelCount };
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function renderSvgToCanvas(svg: SVGSVGElement, size: number): Promise<HTMLCanvasElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  injectFontFaceStyle(clone);
  clone.setAttribute('width', String(size));
  clone.setAttribute('height', String(size));

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const img = new Image();
    img.src = objectUrl;
    await img.decode();

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('renderSvgToCanvas: could not get 2d context');
    // Fill background to match exportPng (which fills with body background color).
    // Without this, the reference would be transparent vs the export's opaque background,
    // causing ~100% non-glass diff even when the ring renders identically.
    const bgColor = getComputedStyle(document.body).backgroundColor;
    ctx.fillStyle = bgColor || '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    return canvas;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
