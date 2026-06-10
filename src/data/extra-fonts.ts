/**
 * Base64-inlined copies of the selectable web fonts, for the OFFLINE single-file
 * build (where url('/fonts/...') would 404 over file://). Imported only from the
 * single-file branch in main.tsx (dynamic import), so this base64 payload is
 * tree-shaken out of the normal web bundle.
 */
import notoSans400 from './fonts/noto-sans-kr-400.woff2?inline';
import notoSans700 from './fonts/noto-sans-kr-700.woff2?inline';
import nanum400 from './fonts/nanum-myeongjo-400.woff2?inline';
import nanum700 from './fonts/nanum-myeongjo-700.woff2?inline';
import jua400 from './fonts/jua-400.woff2?inline';

export function injectExtraFonts(): void {
  const style = document.createElement('style');
  style.textContent = `
    @font-face { font-family:'Noto Sans KR'; font-weight:400; font-display:swap; src:url('${notoSans400}') format('woff2'); }
    @font-face { font-family:'Noto Sans KR'; font-weight:700; font-display:swap; src:url('${notoSans700}') format('woff2'); }
    @font-face { font-family:'Nanum Myeongjo'; font-weight:400; font-display:swap; src:url('${nanum400}') format('woff2'); }
    @font-face { font-family:'Nanum Myeongjo'; font-weight:700; font-display:swap; src:url('${nanum700}') format('woff2'); }
    @font-face { font-family:'Jua'; font-weight:400; font-display:swap; src:url('${jua400}') format('woff2'); }
  `;
  document.head.appendChild(style);
}
