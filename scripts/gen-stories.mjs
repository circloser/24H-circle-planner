/**
 * Generates the /stories content section (hub + one page per person) from
 * scripts/stories-data.mjs, so all pages share an identical, verified shell
 * (matching the /guides articles: guide.css, language toggle, footer, CTA).
 *
 *   node scripts/gen-stories.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stories } from './stories-data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'stories');
mkdirSync(OUT, { recursive: true });

const SITE = 'https://24houring.com';
const escA = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escT = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CATS = [
  { key: 'entrepreneurs', ko: '기업가·혁신가', en: 'Entrepreneurs & Innovators' },
  { key: 'thinkers', ko: '사상가·과학자', en: 'Thinkers & Scientists' },
  { key: 'writers', ko: '작가·예술가', en: 'Writers & Artists' },
  { key: 'leaders', ko: '리더·역사', en: 'Leaders & History' },
  { key: 'modern', ko: '현대·스포츠·웰빙', en: 'Modern & Well-being' },
];

const HEAD_SCRIPTS = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6947130056543786" crossorigin="anonymous"></script>
<script>
(function(){try{var o=localStorage.getItem('24h-guides-lang');var l=o;if(!l){var r=localStorage.getItem('24h-circle-planner.prefs');if(r){var p=JSON.parse(r);l=p&&p.prefs&&p.prefs.language;}}if(!l){l=(navigator.language||'ko').slice(0,2);}if(l&&l.toLowerCase()!=='ko'){document.documentElement.classList.add('show-en');}}catch(e){}})();
function setGuideLang(l){try{localStorage.setItem('24h-guides-lang',l);}catch(e){}document.documentElement.classList.toggle('show-en',l!=='ko');}
</script>`;

const FOOTER = `  <footer class="site">
    <nav>
      <a href="/"><span class="lang-ko">홈 Home</span><span class="lang-en">Home</span></a>
      <a href="/guides/"><span class="lang-ko">가이드 Guides</span><span class="lang-en">Guides</span></a>
      <a href="/stories/"><span class="lang-ko">스토리 Stories</span><span class="lang-en">Stories</span></a>
      <a href="/faq"><span class="lang-ko">자주 묻는 질문 FAQ</span><span class="lang-en">FAQ</span></a>
      <a href="/about"><span class="lang-ko">소개 About</span><span class="lang-en">About</span></a>
      <a href="/privacy"><span class="lang-ko">개인정보처리방침 Privacy</span><span class="lang-en">Privacy</span></a>
      <a href="/contact"><span class="lang-ko">문의 Contact</span><span class="lang-en">Contact</span></a>
    </nav>
    <p class="copy">© 2026 Circloser · 24houring.com</p>
  </footer>`;

const CTA = `    <div class="cta card">
      <div class="lang-ko">
        <p style="margin:0 0 4px"><strong>지금 바로 해보기</strong></p>
        <p style="margin:0">이 습관을 24Houring의 원형 시간표에 직접 그려 보세요. 설치·회원가입 없이 무료로 시작할 수 있습니다.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/">24Houring 열기 →</a></p>
      </div>
      <div class="lang-en">
        <p style="margin:0 0 4px"><strong>Try it now</strong></p>
        <p style="margin:0">Sketch this habit onto your own 24-hour circle in 24Houring — free, with no sign-up or install.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/">Open 24Houring →</a></p>
      </div>
    </div>`;

function personPage(s) {
  const url = `${SITE}/stories/${s.slug}`;
  const desc = `${s.lead_ko} ${s.lead_en}`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${s.name_ko} — ${s.hook_ko}`,
    description: s.lead_ko,
    inLanguage: 'ko',
    author: { '@type': 'Organization', name: 'Circloser' },
    publisher: { '@type': 'Organization', name: '24Houring' },
    mainEntityOfPage: url,
  };
  const paras = (arr) => arr.map((p) => `      <p>${escT(p)}</p>`).join('\n');
  const tips = (arr) => `      <ul>\n${arr.map((t) => `        <li>${escT(t)}</li>`).join('\n')}\n      </ul>`;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escA(s.name_ko)} — ${escA(s.hook_ko)} · 24Houring</title>
<meta name="description" content="${escA(desc)}" />
<link rel="canonical" href="${url}" />
<meta name="robots" content="index, follow" />
<meta property="og:title" content="${escA(s.name_ko)} — ${escA(s.hook_ko)}" />
<meta property="og:description" content="${escA(s.lead_ko)}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${SITE}/og-image.png" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="/guides/guide.css" />
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
${HEAD_SCRIPTS}
</head>
<body>
<div class="wrap">
  <header class="site">
    <a class="logo" href="/">24Hour<b>ing</b></a>
    <nav class="site-nav">
      <span class="langswitch"><a onclick="setGuideLang('ko')">한국어</a><span class="sep">·</span><a onclick="setGuideLang('en')">EN</a></span>
      <a href="/stories/"><span class="lang-ko">스토리</span><span class="lang-en">Stories</span></a>
      <a href="/"><span class="lang-ko">홈</span><span class="lang-en">Home</span></a>
    </nav>
  </header>
  <main class="article">
    <p class="crumb"><a href="/stories/"><span class="lang-ko">← 스토리 목록</span><span class="lang-en">← All stories</span></a></p>
    <div class="lang-ko">
      <h1>${escT(s.name_ko)} <span class="en">/ ${escT(s.name_en)}</span></h1>
      <p class="en" style="margin:0 0 10px">${escT(s.era_ko)}</p>
      <p class="lead">${escT(s.lead_ko)}</p>
${paras(s.body_ko)}
      <h2>24Houring에서 이렇게 적용</h2>
${tips(s.tips_ko)}
    </div>
    <div class="lang-en">
      <h1>${escT(s.name_en)}</h1>
      <p class="en" style="margin:0 0 10px">${escT(s.era_en)}</p>
      <p class="lead">${escT(s.lead_en)}</p>
${paras(s.body_en)}
      <h2>Put it to work in 24Houring</h2>
${tips(s.tips_en)}
    </div>
${CTA}
  </main>
${FOOTER}
</div>
</body>
</html>
`;
}

function hubPage() {
  const sections = CATS.map((c) => {
    const people = stories.filter((s) => s.cat === c.key);
    if (!people.length) return '';
    const cards = people.map((s) => `      <a class="gcard" href="/stories/${s.slug}">
        <h3><span class="lang-ko">${escT(s.name_ko)}</span><span class="lang-en">${escT(s.name_en)}</span></h3>
        <p><span class="lang-ko">${escT(s.hook_ko)}</span><span class="lang-en">${escT(s.hook_en)}</span></p>
      </a>`).join('\n');
    return `    <h2><span class="lang-ko">${escT(c.ko)}</span><span class="lang-en">${escT(c.en)}</span></h2>
    <div class="grid">
${cards}
    </div>`;
  }).filter(Boolean).join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>스토리 — 유명인 20인의 시간 관리 노하우 · 24Houring</title>
<meta name="description" content="버핏·게이츠·다윈·헤밍웨이·이순신까지 — 유명인 20인의 실제 하루 루틴과 시간 관리 노하우, 그리고 오늘 바로 따라 하는 법. Time-management habits of 20 famous people." />
<link rel="canonical" href="${SITE}/stories/" />
<meta name="robots" content="index, follow" />
<meta property="og:title" content="스토리 — 유명인 20인의 시간 관리 노하우" />
<meta property="og:description" content="유명인 20인의 하루 루틴에서 배우는 시간 관리." />
<meta property="og:type" content="website" />
<meta property="og:url" content="${SITE}/stories/" />
<meta property="og:image" content="${SITE}/og-image.png" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="/guides/guide.css" />
${HEAD_SCRIPTS}
</head>
<body>
<div class="wrap">
  <header class="site">
    <a class="logo" href="/">24Hour<b>ing</b></a>
    <nav class="site-nav">
      <span class="langswitch"><a onclick="setGuideLang('ko')">한국어</a><span class="sep">·</span><a onclick="setGuideLang('en')">EN</a></span>
      <a href="/guides/"><span class="lang-ko">가이드</span><span class="lang-en">Guides</span></a>
      <a href="/"><span class="lang-ko">홈</span><span class="lang-en">Home</span></a>
    </nav>
  </header>
  <main>
    <div class="lang-ko">
      <h1>스토리 <span class="en">/ Stories</span></h1>
      <p class="lead">역사와 오늘을 만든 사람들은 하루를 어떻게 다뤘을까요? 유명인 20인의 실제 루틴과 시간 관리 노하우, 그리고 24Houring에서 바로 따라 하는 법을 담았습니다.</p>
    </div>
    <div class="lang-en">
      <h1>Stories</h1>
      <p class="lead">How did the people who shaped history and today handle their hours? Here are the real routines of 20 famous figures — and how to try each one in 24Houring.</p>
    </div>
${sections}
    <div class="cta card">
      <div class="lang-ko">
        <p style="margin:0 0 4px"><strong>내 하루도 그려 보기</strong></p>
        <p style="margin:0">마음에 드는 습관을 골라 24Houring의 원형 시간표에 얹어 보세요. 무료로 시작할 수 있습니다.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/">24Houring 열기 →</a></p>
      </div>
      <div class="lang-en">
        <p style="margin:0 0 4px"><strong>Draw your own day</strong></p>
        <p style="margin:0">Pick a habit you like and lay it onto your 24-hour circle in 24Houring — free to start.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/">Open 24Houring →</a></p>
      </div>
    </div>
  </main>
${FOOTER}
</div>
</body>
</html>
`;
}

// ── Emit ──
let n = 0;
for (const s of stories) {
  writeFileSync(join(OUT, `${s.slug}.html`), personPage(s));
  n++;
}
writeFileSync(join(OUT, 'index.html'), hubPage());
console.log(`Generated ${n} story pages + hub → public/stories/`);
console.log('slugs:', stories.map((s) => s.slug).join(', '));
