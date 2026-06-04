import { pretendardRegular, pretendardBold } from '@/data/fonts';

/**
 * Injects @font-face declarations for Pretendard Regular + Bold into the
 * given SVG clone's <defs> as a <style> element. This ensures the SVG is
 * self-contained for PNG export (R16 requirement: base64 WOFF2 inline).
 *
 * The style element is inserted as the first child of <defs> so it takes
 * precedence over any subsequent style rules.
 */
export function injectFontFaceStyle(svgClone: SVGSVGElement): void {
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `
    @font-face {
      font-family: 'Pretendard';
      font-weight: 400;
      font-style: normal;
      src: url(${pretendardRegular}) format('woff2');
    }
    @font-face {
      font-family: 'Pretendard';
      font-weight: 700;
      font-style: normal;
      src: url(${pretendardBold}) format('woff2');
    }
  `;

  // Insert as first child of <defs> (creating one if absent)
  let defs = svgClone.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svgClone.insertBefore(defs, svgClone.firstChild);
  }
  defs.insertBefore(style, defs.firstChild);
}
