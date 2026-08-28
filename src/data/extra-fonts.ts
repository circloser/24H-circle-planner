/**
 * Base64-inlined copies of the selectable web fonts, for the OFFLINE single-file
 * build (where url('/fonts/...') would 404 over file://). Imported only from the
 * single-file branch in main.tsx (dynamic import), so this base64 payload is
 * tree-shaken out of the normal web bundle.
 */
import pretendard400 from './fonts/pretendard-regular.woff2?inline';
import pretendard700 from './fonts/pretendard-bold.woff2?inline';
import notoSans400 from './fonts/noto-sans-kr-400.woff2?inline';
import notoSans700 from './fonts/noto-sans-kr-700.woff2?inline';
import nanum400 from './fonts/nanum-myeongjo-400.woff2?inline';
import nanum700 from './fonts/nanum-myeongjo-700.woff2?inline';
import jua400 from './fonts/jua-400.woff2?inline';
import gowunDodum400 from './fonts/gowun-dodum-400.woff2?inline';
import blackHanSans400 from './fonts/black-han-sans-400.woff2?inline';
import gaegu400 from './fonts/gaegu-400.woff2?inline';
import roboto400 from './fonts/roboto-400.woff2?inline';
import openSans400 from './fonts/open-sans-400.woff2?inline';
import lato400 from './fonts/lato-400.woff2?inline';
import montserrat400 from './fonts/montserrat-400.woff2?inline';
import poppins400 from './fonts/poppins-400.woff2?inline';
import playfair400 from './fonts/playfair-display-400.woff2?inline';
import ptSansLatin from './fonts/pt-sans-latin.woff2?inline';
import ptSansCyrillic from './fonts/pt-sans-cyrillic.woff2?inline';
import rubikLatin from './fonts/rubik-latin.woff2?inline';
import rubikCyrillic from './fonts/rubik-cyrillic.woff2?inline';

export function injectExtraFonts(): void {
  const style = document.createElement('style');
  style.textContent = `
    @font-face { font-family:'Pretendard'; font-weight:400; font-display:swap; src:url('${pretendard400}') format('woff2'); }
    @font-face { font-family:'Pretendard'; font-weight:700; font-display:swap; src:url('${pretendard700}') format('woff2'); }
    @font-face { font-family:'Noto Sans KR'; font-weight:400; font-display:swap; src:url('${notoSans400}') format('woff2'); }
    @font-face { font-family:'Noto Sans KR'; font-weight:700; font-display:swap; src:url('${notoSans700}') format('woff2'); }
    @font-face { font-family:'Nanum Myeongjo'; font-weight:400; font-display:swap; src:url('${nanum400}') format('woff2'); }
    @font-face { font-family:'Nanum Myeongjo'; font-weight:700; font-display:swap; src:url('${nanum700}') format('woff2'); }
    @font-face { font-family:'Jua'; font-weight:400; font-display:swap; src:url('${jua400}') format('woff2'); }
    @font-face { font-family:'Gowun Dodum'; font-weight:400; font-display:swap; src:url('${gowunDodum400}') format('woff2'); }
    @font-face { font-family:'Black Han Sans'; font-weight:400; font-display:swap; src:url('${blackHanSans400}') format('woff2'); }
    @font-face { font-family:'Gaegu'; font-weight:400; font-display:swap; src:url('${gaegu400}') format('woff2'); }
    @font-face { font-family:'Roboto'; font-weight:400; font-display:swap; src:url('${roboto400}') format('woff2'); }
    @font-face { font-family:'Open Sans'; font-weight:400; font-display:swap; src:url('${openSans400}') format('woff2'); }
    @font-face { font-family:'Lato'; font-weight:400; font-display:swap; src:url('${lato400}') format('woff2'); }
    @font-face { font-family:'Montserrat'; font-weight:400; font-display:swap; src:url('${montserrat400}') format('woff2'); }
    @font-face { font-family:'Poppins'; font-weight:400; font-display:swap; src:url('${poppins400}') format('woff2'); }
    @font-face { font-family:'Playfair Display'; font-weight:400; font-display:swap; src:url('${playfair400}') format('woff2'); }
    @font-face { font-family:'PT Sans'; font-weight:400; font-display:swap; src:url('${ptSansCyrillic}') format('woff2'); unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116; }
    @font-face { font-family:'PT Sans'; font-weight:400; font-display:swap; src:url('${ptSansLatin}') format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
    @font-face { font-family:'Rubik'; font-weight:400; font-display:swap; src:url('${rubikCyrillic}') format('woff2'); unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116; }
    @font-face { font-family:'Rubik'; font-weight:400; font-display:swap; src:url('${rubikLatin}') format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
  `;
  document.head.appendChild(style);
}
