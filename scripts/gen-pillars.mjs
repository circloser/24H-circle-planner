/**
 * Generates the consolidated PILLAR pages for /health and /stories from the rich
 * JSON in scripts/pillars/*.json (one deep bilingual article per category,
 * replacing the old thin per-item pages). Also emits:
 *   - hub index pages (/health/, /stories/)
 *   - redirect stubs for every absorbed old slug → its new pillar (canonical +
 *     meta-refresh, so consolidation preserves inbound links without a 404)
 *
 * Reuses the same shell as /guides (guide.css, lang toggle, footer). Health
 * pillars carry a general-wellness disclaimer (not medical advice).
 *
 *   node scripts/gen-pillars.mjs
 */
import { writeFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PILLAR_DIR = join(__dirname, 'pillars');
const PUB = join(__dirname, '..', 'public');
const SITE = 'https://24houring.com';

const escA = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escT = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Section hubs: order + labels for the two content sections.
const SECTIONS = {
  health: {
    ko: '건강', en: 'Health',
    order: ['sleep', 'nutrition', 'movement', 'mind', 'rhythm'],
    hubTitle: '건강 — 하루 시간표로 실천하는 건강 습관 · 24Houring',
    hubDesc: '수면·식사·움직임·회복·리듬을 시간 관리로 챙기는 심층 가이드. Deep guides on building healthy habits through how you spend your 24 hours.',
    hubLeadKo: '건강은 대단한 결심이 아니라 하루의 시간을 어떻게 쓰느냐에서 시작됩니다. 수면·식사·움직임·마음·리듬 다섯 축을 깊이 있게 다루고, 24Houring 원형 시간표로 매일 실천하는 법을 담았습니다.',
    hubLeadEn: 'Health starts less from grand resolutions than from how you spend the hours of your day. Five in-depth pillars — sleep, meals, movement, mind, and rhythm — and how to keep them on your 24Houring circular timetable.',
    disclaimer: true,
  },
  stories: {
    ko: '스토리', en: 'Stories',
    order: ['entrepreneurs', 'thinkers', 'writers', 'leaders', 'modern'],
    hubTitle: '스토리 — 위대한 인물들의 하루 습관 · 24Houring',
    hubDesc: '기업가·사상가·작가·리더·현대 인물들이 하루를 어떻게 설계했는지, 그리고 당신의 원형 시간표에 무엇을 빌려올 수 있는지. How remarkable people structured their days — and what you can borrow.',
    hubLeadKo: '위대한 성취 뒤에는 화려한 비법이 아니라, 반복 가능한 하루의 구조가 있었습니다. 기업가·사상가·작가·리더·현대 인물들의 하루 습관을 살펴보고, 당신의 24Houring 원형 시간표에 빌려올 수 있는 것을 정리했습니다.',
    hubLeadEn: "Behind great work is rarely a secret trick — it is a repeatable shape to the day. Here is how entrepreneurs, thinkers, writers, leaders, and modern high performers structured theirs, and what you can borrow for your own 24Houring circle.",
    disclaimer: false,
  },
};

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

const DISCLAIMER = `    <div class="card" style="font-size:13px">
      <p class="lang-ko" style="margin:0; color:hsl(var(--text-muted))">※ 이 글은 일반적인 건강 정보이며 의학적 조언이 아닙니다. 지속되는 증상이 있거나 특정 질환·복용약이 있다면 생활 습관을 바꾸기 전에 전문가와 상담하세요.</p>
      <p class="lang-en" style="margin:0; color:hsl(var(--text-muted))">Note: This is general wellness information, not medical advice. If you have persistent symptoms, a specific condition, or take medication, consult a professional before changing your habits.</p>
    </div>`;

const ctaBlock = (section) => `    <div class="cta card">
      <div class="lang-ko">
        <p style="margin:0 0 4px"><strong>${section === 'health' ? '습관을 시간표에 심기' : '이 하루를 내 시간표에 옮기기'}</strong></p>
        <p style="margin:0">${section === 'health' ? '마음에 드는 습관을 24Houring의 원형 시간표에 블록으로 넣고 매일 눈으로 확인해 보세요.' : '빌려오고 싶은 습관을 24Houring 원형 시간표에 블록으로 그려 보세요.'} 설치·회원가입 없이 무료입니다.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/">24Houring 열기 →</a></p>
      </div>
      <div class="lang-en">
        <p style="margin:0 0 4px"><strong>${section === 'health' ? 'Plant the habit in your day' : 'Draw this day on your own circle'}</strong></p>
        <p style="margin:0">Add it as a block on your 24-hour circle in 24Houring and see it every day — free, no sign-up or install.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/">Open 24Houring →</a></p>
      </div>
    </div>`;

const paras = (arr) => (arr || []).map((p) => `      <p>${escT(p)}</p>`).join('\n');
const secBlocks = (arr) => (arr || []).map((s) => `      <h2>${escT(s.h)}</h2>\n${paras(s.body)}`).join('\n');
const listBlock = (arr) => `      <ul>\n${(arr || []).map((t) => `        <li>${escT(t)}</li>`).join('\n')}\n      </ul>`;
const faqBlocks = (arr) => (arr || []).map((f) => `      <h3>${escT(f.q)}</h3>\n      <p>${escT(f.a)}</p>`).join('\n');

function pillarPage(section, d) {
  const cfg = SECTIONS[section];
  const url = `${SITE}/${section}/${d.slug}`;
  const desc = `${d.lead_ko} ${d.lead_en}`;
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: d.title_ko,
    description: d.lead_ko,
    inLanguage: 'ko',
    author: { '@type': 'Organization', name: 'Circloser' },
    publisher: { '@type': 'Organization', name: '24Houring' },
    mainEntityOfPage: url,
  };
  const faqLd = (d.faq_ko && d.faq_ko.length)
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: d.faq_ko.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }
    : null;

  const faqKo = (d.faq_ko && d.faq_ko.length) ? `      <h2>자주 묻는 질문</h2>\n${faqBlocks(d.faq_ko)}` : '';
  const faqEn = (d.faq_en && d.faq_en.length) ? `      <h2>FAQ</h2>\n${faqBlocks(d.faq_en)}` : '';

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escA(d.title_ko)} · 24Houring</title>
<meta name="description" content="${escA(desc.slice(0, 300))}" />
<link rel="canonical" href="${url}" />
<meta name="robots" content="index, follow" />
<meta property="og:title" content="${escA(d.title_ko)}" />
<meta property="og:description" content="${escA(d.lead_ko)}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${SITE}/og-image.png" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="/guides/guide.css" />
<script type="application/ld+json">
${JSON.stringify(article, null, 2)}
</script>${faqLd ? `\n<script type="application/ld+json">\n${JSON.stringify(faqLd, null, 2)}\n</script>` : ''}
${HEAD_SCRIPTS}
</head>
<body>
<div class="wrap">
  <header class="site">
    <a class="logo" href="/">24Hou<b>ring</b></a>
    <nav class="site-nav">
      <span class="langswitch"><a onclick="setGuideLang('ko')">한국어</a><span class="sep">·</span><a onclick="setGuideLang('en')">EN</a></span>
      <a href="/${section}/"><span class="lang-ko">${cfg.ko}</span><span class="lang-en">${cfg.en}</span></a>
      <a href="/"><span class="lang-ko">홈</span><span class="lang-en">Home</span></a>
    </nav>
  </header>
  <main class="article">
    <p class="crumb"><a href="/${section}/"><span class="lang-ko">← ${cfg.ko} 전체</span><span class="lang-en">← All ${cfg.en}</span></a></p>
    <div class="lang-ko">
      <h1>${escT(d.title_ko)} <span class="en">/ ${escT(d.title_en)}</span></h1>
      <p class="en" style="margin:0 0 10px">${escT(d.tag_ko)}</p>
      <p class="lead">${escT(d.lead_ko)}</p>
${secBlocks(d.sections_ko)}
      <h2>24Houring에서 이렇게 실천</h2>
${listBlock(d.apply_ko)}
${faqKo}
    </div>
    <div class="lang-en">
      <h1>${escT(d.title_en)}</h1>
      <p class="en" style="margin:0 0 10px">${escT(d.tag_en)}</p>
      <p class="lead">${escT(d.lead_en)}</p>
${secBlocks(d.sections_en)}
      <h2>Do it in 24Houring</h2>
${listBlock(d.apply_en)}
${faqEn}
    </div>
${cfg.disclaimer ? DISCLAIMER + '\n' : ''}${ctaBlock(section)}
  </main>
${FOOTER}
</div>
</body>
</html>
`;
}

function hubPage(section, pillars) {
  const cfg = SECTIONS[section];
  const cards = cfg.order
    .map((slug) => pillars.find((p) => p.slug === slug))
    .filter(Boolean)
    .map((d) => `      <a class="gcard" href="/${section}/${d.slug}">
        <h3><span class="lang-ko">${escT(d.title_ko)}</span><span class="lang-en">${escT(d.title_en)}</span></h3>
        <p><span class="lang-ko">${escT(d.lead_ko).slice(0, 110)}</span><span class="lang-en">${escT(d.lead_en).slice(0, 130)}</span></p>
      </a>`).join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escA(cfg.hubTitle)}</title>
<meta name="description" content="${escA(cfg.hubDesc)}" />
<link rel="canonical" href="${SITE}/${section}/" />
<meta name="robots" content="index, follow" />
<meta property="og:title" content="${escA(cfg.hubTitle)}" />
<meta property="og:description" content="${escA(cfg.hubDesc)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${SITE}/${section}/" />
<meta property="og:image" content="${SITE}/og-image.png" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="/guides/guide.css" />
${HEAD_SCRIPTS}
</head>
<body>
<div class="wrap">
  <header class="site">
    <a class="logo" href="/">24Hou<b>ring</b></a>
    <nav class="site-nav">
      <span class="langswitch"><a onclick="setGuideLang('ko')">한국어</a><span class="sep">·</span><a onclick="setGuideLang('en')">EN</a></span>
      <a href="/guides/"><span class="lang-ko">가이드</span><span class="lang-en">Guides</span></a>
      <a href="/"><span class="lang-ko">홈</span><span class="lang-en">Home</span></a>
    </nav>
  </header>
  <main>
    <div class="lang-ko">
      <h1>${cfg.ko} <span class="en">/ ${cfg.en}</span></h1>
      <p class="lead">${escT(cfg.hubLeadKo)}</p>
    </div>
    <div class="lang-en">
      <h1>${cfg.en}</h1>
      <p class="lead">${escT(cfg.hubLeadEn)}</p>
    </div>
    <div class="grid">
${cards}
    </div>
${cfg.disclaimer ? DISCLAIMER + '\n' : ''}${ctaBlock(section)}
  </main>
${FOOTER}
</div>
</body>
</html>
`;
}

// A tiny canonical + meta-refresh redirect stub for an absorbed old slug.
function redirectStub(section, oldSlug, newSlug, title) {
  const target = `/${section}/${newSlug}`;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escA(title)} · 24Houring</title>
<link rel="canonical" href="${SITE}${target}" />
<meta name="robots" content="noindex, follow" />
<meta http-equiv="refresh" content="0; url=${target}" />
<script>location.replace(${JSON.stringify(target)});</script>
</head>
<body>
<p>이 글은 더 깊은 가이드로 통합되었습니다. 이동하지 않으면 <a href="${target}">여기</a>를 눌러 주세요.</p>
<p>This page has moved to a fuller guide. If you are not redirected, <a href="${target}">click here</a>.</p>
</body>
</html>
`;
}

// ── Load pillar JSON ──
const files = readdirSync(PILLAR_DIR).filter((f) => f.endsWith('.json'));
const bySection = { health: [], stories: [] };
const sitemapUrls = [];
let redirects = 0;

for (const f of files) {
  const section = f.startsWith('health-') ? 'health' : f.startsWith('stories-') ? 'stories' : null;
  if (!section) continue;
  const d = JSON.parse(readFileSync(join(PILLAR_DIR, f), 'utf-8'));
  bySection[section].push(d);
}

for (const section of ['health', 'stories']) {
  const dir = join(PUB, section);
  mkdirSync(dir, { recursive: true });
  const pillars = bySection[section];
  for (const d of pillars) {
    writeFileSync(join(dir, `${d.slug}.html`), pillarPage(section, d));
    sitemapUrls.push(`${SITE}/${section}/${d.slug}`);
    for (const old of d.absorbs || []) {
      if (old === d.slug) continue;
      writeFileSync(join(dir, `${old}.html`), redirectStub(section, old, d.slug, d.title_ko));
      redirects++;
    }
  }
  writeFileSync(join(dir, 'index.html'), hubPage(section, pillars));
  console.log(`${section}: ${pillars.length} pillars + hub (${pillars.map((p) => p.slug).join(', ')})`);
}

console.log(`redirect stubs: ${redirects}`);
console.log('SITEMAP_PILLAR_URLS:', JSON.stringify(sitemapUrls));
