import { injectFontFaceStyle } from './inlineFonts';
import { inlineComputedPaint } from './inlineComputedPaint';

/**
 * Build a self-contained SVG data URL that mirrors the PNG/PDF export exactly:
 *  - computed fill/stroke inlined (class-styled elements survive serialization),
 *  - every `data-export-exclude` element removed (so the live now-line is gone),
 *  - the selected font (+ Pretendard) embedded as base64 @font-face.
 *
 * Used by the export dialog's live preview so the user sees precisely what the
 * downloaded artifact will contain — notably WITHOUT the live clock or red
 * now-line, which only exist in the on-screen app.
 */
export function buildExportPreviewDataUrl(sourceSvg: SVGSVGElement): string {
  const clone = sourceSvg.cloneNode(true) as SVGSVGElement;

  inlineComputedPaint(sourceSvg, clone);

  for (const el of Array.from(clone.querySelectorAll('[data-export-exclude]'))) {
    el.remove();
  }

  const rootStyle = getComputedStyle(document.documentElement);
  const famVar = rootStyle.getPropertyValue('--app-font-family').trim();
  const scaleVar = rootStyle.getPropertyValue('--app-font-scale').trim();
  const selectedFamily = (famVar || 'Pretendard').replace(/['"]/g, '').trim();
  clone.style.setProperty('--app-font-family', famVar || 'Pretendard');
  clone.style.setProperty('--app-font-scale', scaleVar || '1');

  injectFontFaceStyle(clone, [selectedFamily, 'Pretendard']);

  const svgString = new XMLSerializer().serializeToString(clone);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
}
