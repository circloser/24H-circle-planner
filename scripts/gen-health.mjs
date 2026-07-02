/**
 * Generates the /health content section (hub + one page per tip) from
 * scripts/health-data.mjs — same verified shell as /guides & /stories, plus a
 * general-wellness disclaimer on every page (health content is not medical advice).
 *
 *   node scripts/gen-health.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { health } from './health-data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'health');
mkdirSync(OUT, { recursive: true });

const SITE = 'https://24houring.com';
const escA = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escT = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CATS = [
  { key: 'sleep', ko: '수면', en: 'Sleep' },
  { key: 'nutrition', ko: '식사·영양', en: 'Meals & Nutrition' },
  { key: 'movement', ko: '운동·활동', en: 'Movement' },
  { key: 'mind', ko: '정신·회복', en: 'Mind & Recovery' },
  { key: 'rhythm', ko: '리듬·습관', en: 'Rhythm & Habits' },
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
      <a href="/health/"><span class="lang-ko">건강 Health</span><span class="lang-en">Health</span></a>
      <a href="/faq"><span class="lang-ko">자주 묻는 질문 FAQ</span><span class="lang-en">FAQ</span></a>
      <a href="/about"><span class="lang-ko">소개 About</span><span class="lang-en">About</span></a>
      <a href="/privacy"><span class="lang-ko">개인정보처리방침 Privacy</span><span class="lang-en">Privacy</span></a>
      <a href="/contact"><span class="lang-ko">문의 Contact</span><span class="lang-en">Contact</span></a>
    </nav>
    <p class="copy">© 2026 Circloser · 24houring.com</p>
  </footer>`;

// General-wellness disclaimer (YMYL-safe) shown on every health page/hub.
const DISCLAIMER = `    <div class="card" style="font-size:13px">
      <p class="lang-ko" style="margin:0; color:hsl(var(--text-muted))">※ 이 글은 일반적인 건강 정보이며 의학적 조언이 아닙니다. 지속되는 증상이 있거나 특정 질환·복용약이 있다면 생활 습관을 바꾸기 전에 전문가와 상담하세요.</p>
      <p class="lang-en" style="margin:0; color:hsl(var(--text-muted))">Note: This is general wellness information, not medical advice. If you have persistent symptoms, a specific condition, or take medication, consult a professional before changing your habits.</p>
    </div>`;

const CTA = `    <div class="cta card">
      <div class="lang-ko">
        <p style="margin:0 0 4px"><strong>습관을 시간표에 심기</strong></p>
        <p style="margin:0">이 습관을 24Houring의 원형 시간표에 블록으로 넣고 매일 눈으로 확인해 보세요. 설치·회원가입 없이 무료입니다.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/">24Houring 열기 →</a></p>
      </div>
      <div class="lang-en">
        <p style="margin:0 0 4px"><strong>Plant the habit in your day</strong></p>
        <p style="margin:0">Add this habit as a block on your 24-hour circle in 24Houring and see it every day — free, no sign-up or install.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/">Open 24Houring →</a></p>
      </div>
    </div>`;

function tipPage(s) {
  const url = `${SITE}/health/${s.slug}`;
  const desc = `${s.lead_ko} ${s.lead_en}`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${s.title_ko} — ${s.hook_ko}`,
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
<title>${escA(s.title_ko)} — ${escA(s.hook_ko)} · 24Houring</title>
<meta name="description" content="${escA(desc)}" />
<link rel="canonical" href="${url}" />
<meta name="robots" content="index, follow" />
<meta property="og:title" content="${escA(s.title_ko)} — ${escA(s.hook_ko)}" />
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
      <a href="/health/"><span class="lang-ko">건강</span><span class="lang-en">Health</span></a>
      <a href="/"><span class="lang-ko">홈</span><span class="lang-en">Home</span></a>
    </nav>
  </header>
  <main class="article">
    <p class="crumb"><a href="/health/"><span class="lang-ko">← 건강 팁 목록</span><span class="lang-en">← All health tips</span></a></p>
    <div class="lang-ko">
      <h1>${escT(s.title_ko)} <span class="en">/ ${escT(s.title_en)}</span></h1>
      <p class="en" style="margin:0 0 10px">${escT(s.tag_ko)}</p>
      <p class="lead">${escT(s.lead_ko)}</p>
${paras(s.body_ko)}
      <h2>24Houring에서 이렇게 실천</h2>
${tips(s.tips_ko)}
    </div>
    <div class="lang-en">
      <h1>${escT(s.title_en)}</h1>
      <p class="en" style="margin:0 0 10px">${escT(s.tag_en)}</p>
      <p class="lead">${escT(s.lead_en)}</p>
${paras(s.body_en)}
      <h2>Build the habit in 24Houring</h2>
${tips(s.tips_en)}
    </div>
${DISCLAIMER}
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
    const items = health.filter((s) => s.cat === c.key);
    if (!items.length) return '';
    const cards = items.map((s) => `      <a class="gcard" href="/health/${s.slug}">
        <h3><span class="lang-ko">${escT(s.title_ko)}</span><span class="lang-en">${escT(s.title_en)}</span></h3>
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
<title>건강 — 시간 관리로 실천하는 건강 습관 20가지 · 24Houring</title>
<meta name="description" content="수면·식사·운동·회복·리듬까지, 시간 관리로 매일 실천하는 건강 습관 20가지와 24Houring에서 챙기는 법. 20 health habits you can build with better time management." />
<link rel="canonical" href="${SITE}/health/" />
<meta name="robots" content="index, follow" />
<meta property="og:title" content="건강 — 시간 관리로 실천하는 건강 습관 20가지" />
<meta property="og:description" content="수면·식사·운동·회복·리듬, 시간 관리로 챙기는 건강 습관 20가지." />
<meta property="og:type" content="website" />
<meta property="og:url" content="${SITE}/health/" />
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
      <h1>건강 <span class="en">/ Health</span></h1>
      <p class="lead">건강은 대단한 결심이 아니라 하루의 시간을 어떻게 쓰느냐에서 시작됩니다. 수면·식사·운동·회복·리듬을 다루는 건강 습관 20가지와, 24Houring 시간표로 매일 챙기는 법을 모았습니다.</p>
    </div>
    <div class="lang-en">
      <h1>Health</h1>
      <p class="lead">Health starts less from grand resolutions than from how you spend the hours of your day. Here are 20 health habits across sleep, meals, movement, recovery and rhythm — and how to keep them with your 24Houring timetable.</p>
    </div>
${sections}
${DISCLAIMER}
    <div class="cta card">
      <div class="lang-ko">
        <p style="margin:0 0 4px"><strong>건강도 시간표에서</strong></p>
        <p style="margin:0">마음에 드는 습관을 골라 24Houring의 원형 시간표에 블록으로 넣어 보세요. 무료로 시작할 수 있습니다.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/">24Houring 열기 →</a></p>
      </div>
      <div class="lang-en">
        <p style="margin:0 0 4px"><strong>Schedule your health</strong></p>
        <p style="margin:0">Pick a habit you like and add it as a block on your 24-hour circle in 24Houring — free to start.</p>
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
for (const s of health) {
  writeFileSync(join(OUT, `${s.slug}.html`), tipPage(s));
  n++;
}
writeFileSync(join(OUT, 'index.html'), hubPage());
console.log(`Generated ${n} health pages + hub → public/health/`);
console.log('slugs:', health.map((s) => s.slug).join(', '));
