import {
  pretendardRegular,
  pretendardBold,
  notoSansKr400,
  notoSansKr700,
  nanumMyeongjo400,
  nanumMyeongjo700,
  jua400,
  gowunDodum400,
  blackHanSans400,
  gaegu400,
  roboto400,
  openSans400,
  lato400,
  montserrat400,
  poppins400,
  playfair400,
  ptSansLatin,
  ptSansCyrillic,
  rubikLatin,
  rubikCyrillic,
} from '@/data/fonts';

interface Face {
  family: string;
  weight: 400 | 700;
  src: string | undefined;
  /** Optional unicode-range — lets one family ship as subset pairs (RU). */
  range?: string;
}

const CYRILLIC_RANGE = 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116';
const LATIN_RANGE = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

// All selectable bundled fonts. The export embeds them all (base64) so whichever
// font the user picked renders in the PNG/PDF — an SVG rendered as an image runs
// in "secure static mode" and cannot fetch /fonts/*.woff2, so the faces MUST be
// inlined. (In unit tests only Pretendard is mocked; the rest are undefined and
// filtered out below.)
const FACES: Face[] = [
  { family: 'Pretendard', weight: 400, src: pretendardRegular },
  { family: 'Pretendard', weight: 700, src: pretendardBold },
  { family: 'Noto Sans KR', weight: 400, src: notoSansKr400 },
  { family: 'Noto Sans KR', weight: 700, src: notoSansKr700 },
  { family: 'Nanum Myeongjo', weight: 400, src: nanumMyeongjo400 },
  { family: 'Nanum Myeongjo', weight: 700, src: nanumMyeongjo700 },
  { family: 'Jua', weight: 400, src: jua400 },
  { family: 'Gowun Dodum', weight: 400, src: gowunDodum400 },
  { family: 'Black Han Sans', weight: 400, src: blackHanSans400 },
  { family: 'Gaegu', weight: 400, src: gaegu400 },
  { family: 'Roboto', weight: 400, src: roboto400 },
  { family: 'Open Sans', weight: 400, src: openSans400 },
  { family: 'Lato', weight: 400, src: lato400 },
  { family: 'Montserrat', weight: 400, src: montserrat400 },
  { family: 'Poppins', weight: 400, src: poppins400 },
  { family: 'Playfair Display', weight: 400, src: playfair400 },
  { family: 'PT Sans', weight: 400, src: ptSansCyrillic, range: CYRILLIC_RANGE },
  { family: 'PT Sans', weight: 400, src: ptSansLatin, range: LATIN_RANGE },
  { family: 'Rubik', weight: 400, src: rubikCyrillic, range: CYRILLIC_RANGE },
  { family: 'Rubik', weight: 400, src: rubikLatin, range: LATIN_RANGE },
];

/**
 * Injects @font-face declarations (base64 WOFF2) into the given SVG clone's
 * <defs> as a <style> element, so the exported image is self-contained (R16).
 *
 * Pass `families` to embed only those families (plus omit the rest) — the export
 * does this to keep the payload small (just the selected font + Pretendard
 * fallback), because embedding all ~6.5MB of fonts makes an SVG-as-image
 * rasterize before the fonts finish loading, dropping the text. With no argument
 * every bundled face is embedded.
 *
 * The style element is inserted as the first child of <defs> so it takes
 * precedence over any subsequent style rules.
 */
export function injectFontFaceStyle(svgClone: SVGSVGElement, families?: string[]): void {
  const wanted = families ? new Set(families) : null;
  const css = FACES.filter((f) => Boolean(f.src) && (!wanted || wanted.has(f.family)))
    .map(
      (f) => `@font-face {
  font-family: '${f.family}';
  font-weight: ${f.weight};
  font-style: normal;
  src: url(${f.src}) format('woff2');${f.range ? `\n  unicode-range: ${f.range};` : ''}
}`,
    )
    .join('\n');

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = css;

  // Insert as first child of <defs> (creating one if absent)
  let defs = svgClone.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svgClone.insertBefore(defs, svgClone.firstChild);
  }
  defs.insertBefore(style, defs.firstChild);
}
