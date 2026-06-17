import { injectFontFaceStyle } from './inlineFonts';
import { inlineComputedPaint } from './inlineComputedPaint';

export interface PngExportOptions {
  size: 1080 | 2160 | 3840;
  transparent: boolean;
}

/**
 * Exports the given SVG element as a PNG Blob at the specified resolution.
 *
 * The exported PNG:
 *  - Has Pretendard @font-face injected inline as base64 WOFF2 (R16 requirement)
 *  - Respects the transparent flag (fills with current theme body background if false)
 *  - Uses the native Canvas 2D pipeline for rasterization
 */
export async function exportPng(
  sourceSvg: SVGSVGElement,
  opts: PngExportOptions,
): Promise<Blob> {
  const { size, transparent } = opts;

  // 1. Deep-clone the SVG
  const clone = sourceSvg.cloneNode(true) as SVGSVGElement;

  // 1a. Inline computed fill/stroke (class-styled elements like the hub disc and
  // ring backdrop would otherwise default to black in the serialized image).
  // Must run BEFORE stripping excluded elements so source/clone stay aligned.
  inlineComputedPaint(sourceSvg, clone);

  // 1b. Strip any elements tagged data-export-exclude (e.g. now-indicator line)
  for (const el of Array.from(clone.querySelectorAll('[data-export-exclude]'))) {
    el.remove();
  }

  // 2. Inject @font-face with base64 WOFF2 (R16 requirement)
  injectFontFaceStyle(clone);

  // 2a. Resolve the live font preferences onto the clone root. The standalone
  // SVG is rasterized via <img> ("secure static mode"), which has no access to
  // the document's CSS custom properties — so the chart's
  // `font-family: var(--app-font-family, …)` and `font-size: calc(var(--app-font-scale,1)*…)`
  // would otherwise fall back to Pretendard at 100%. Defining the vars on the
  // clone root lets them resolve inside the isolated SVG (the @font-face above
  // supplies the actual glyphs).
  const rootStyle = getComputedStyle(document.documentElement);
  const famVar = rootStyle.getPropertyValue('--app-font-family').trim();
  const scaleVar = rootStyle.getPropertyValue('--app-font-scale').trim();
  clone.style.setProperty('--app-font-family', famVar || 'Pretendard');
  clone.style.setProperty('--app-font-scale', scaleVar || '1');

  // 3. Set explicit width/height for rasterization at target resolution
  clone.setAttribute('width', String(size));
  clone.setAttribute('height', String(size));

  // 4. Serialize, create Blob, object URL
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    // Load into <img>, await decode
    const img = new Image();
    img.src = objectUrl;
    await img.decode();

    // 5. Create canvas; optionally fill background
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('exportPng: could not get 2d context from canvas');

    if (!transparent) {
      // Fill with current theme background color
      const bgColor = getComputedStyle(document.body).backgroundColor;
      ctx.fillStyle = bgColor || '#ffffff';
      ctx.fillRect(0, 0, size, size);
    }

    // 6. Draw the SVG image
    ctx.drawImage(img, 0, 0, size, size);

    // 7. Return PNG blob
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('exportPng: canvas.toBlob returned null'));
        },
        'image/png',
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
