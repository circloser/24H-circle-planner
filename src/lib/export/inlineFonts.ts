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
} from '@/data/fonts';

interface Face {
  family: string;
  weight: 400 | 700;
  src: string | undefined;
}

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
];

/**
 * Injects @font-face declarations (base64 WOFF2) for all bundled fonts into the
 * given SVG clone's <defs> as a <style> element, so the exported image is
 * self-contained regardless of which font the user selected (R16).
 *
 * The style element is inserted as the first child of <defs> so it takes
 * precedence over any subsequent style rules.
 */
export function injectFontFaceStyle(svgClone: SVGSVGElement): void {
  const css = FACES.filter((f) => Boolean(f.src))
    .map(
      (f) => `@font-face {
  font-family: '${f.family}';
  font-weight: ${f.weight};
  font-style: normal;
  src: url(${f.src}) format('woff2');
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
