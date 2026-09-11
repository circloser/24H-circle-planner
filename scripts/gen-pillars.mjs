/**
 * Generates the consolidated PILLAR pages for /health and /stories from the rich
 * JSON in scripts/pillars/*.json (one deep bilingual article per category,
 * replacing the old thin per-item pages). Also emits:
 *   - hub index pages (/health/, /stories/)
 *   - worker/legacy-redirects.ts: the old-slug → pillar map the Worker uses to
 *     answer every absorbed URL with a real 301 (no thin stub pages ship)
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
const ROOT = join(__dirname, '..');
const SITE = 'https://24houring.com';

const escA = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escT = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Section hubs: order + labels for the two content sections.
const SECTIONS = {
  health: {
    ko: '건강', en: 'Health',
    order: ['sleep', 'nutrition', 'movement', 'mind', 'rhythm'],
    hubTitle: '건강과 일상 계획 — 수면·식사·움직임을 위한 시간 · 24Houring',
    hubDesc: '공공 보건 자료의 일반 정보와 시간표 작성 예시를 구분해 읽는 일상 계획 안내. Planning examples alongside clearly attributed public-health information.',
    hubLeadKo: '수면·식사·움직임·회복에 필요한 시간이 다른 일정에 밀리고 있나요? 공공 보건 자료에서 확인한 일반 정보와 시간표 작성 예시를 나누어 설명합니다. 자신의 상황에 맞는 계획을 점검하는 자료이며, 건강 상태를 진단하거나 치료 효과를 약속하지 않습니다.',
    hubLeadEn: 'Are sleep, meals, movement or recovery getting crowded out of your day? These pages distinguish general information from public-health sources from illustrative planning exercises. Use them to examine your schedule; they do not diagnose conditions or promise treatment outcomes.',
    disclaimer: true,
  },
  stories: {
    ko: '스토리', en: 'Stories',
    order: ['entrepreneurs', 'thinkers', 'writers', 'leaders', 'modern'],
    hubTitle: '기록으로 읽는 인물과 시간 — 출처와 계획 연습 · 24Houring',
    hubDesc: '연설·자서전·인터뷰·기록에서 확인한 내용과 오늘의 계획 연습을 구분합니다. Primary-source accounts and separate planning exercises.',
    hubLeadKo: '유명인의 하루를 그대로 따라 하기 전에, 원문이 실제로 무엇을 말하는지 살펴봅니다. 확인 가능한 기록, 확인하지 못해 제외한 일화, 오늘 적용해 볼 계획 연습을 구분했습니다. 한 사람의 습관이 성공의 원인이었다고 단정하지 않습니다.',
    hubLeadEn: 'Before copying a famous person’s day, look at what the original record actually says. These pages separate documented accounts, anecdotes removed for lack of verification, and planning exercises for your own circumstances. A reported habit is not proof of what caused someone’s success.',
    disclaimer: false,
  },
};

const HEAD_SCRIPTS = `<meta name="google-adsense-account" content="ca-pub-6947130056543786">
<script>
function setGuideLang(l,save){l=l==='ko'?'ko':'en';document.documentElement.lang=l;document.documentElement.classList.toggle('show-en',l==='en');document.querySelectorAll('[data-guide-lang]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.guideLang===l));});if(save!==false){try{localStorage.setItem('24h-guides-lang',l);}catch(e){}}}
(function(){var l=(navigator.language||'ko').slice(0,2);try{var o=localStorage.getItem('24h-guides-lang');var r=localStorage.getItem('24h-circle-planner.prefs');var p=r?JSON.parse(r):null;l=o||(p&&p.prefs&&p.prefs.language)||l;}catch(e){}setGuideLang(l,false);document.addEventListener('DOMContentLoaded',function(){setGuideLang(document.documentElement.lang,false);});})();
</script>`;

const FOOTER = `  <footer class="site">
    <nav>
      <a href="/"><span class="lang-ko">홈 Home</span><span class="lang-en">Home</span></a>
      <a href="/life-planner"><span class="lang-ko">생활계획표 Life Planner</span><span class="lang-en">Life Planner</span></a>
      <a href="/guides/"><span class="lang-ko">가이드 Guides</span><span class="lang-en">Guides</span></a>
      <a href="/blog/"><span class="lang-ko">블로그 Blog</span><span class="lang-en">Blog</span></a>
      <a href="/templates/"><span class="lang-ko">템플릿 Templates</span><span class="lang-en">Templates</span></a>
      <a href="/gallery/"><span class="lang-ko">갤러리 Gallery</span><span class="lang-en">Gallery</span></a>
      <a href="/stories/"><span class="lang-ko">스토리 Stories</span><span class="lang-en">Stories</span></a>
      <a href="/health/"><span class="lang-ko">건강 Health</span><span class="lang-en">Health</span></a>
      <a href="/faq"><span class="lang-ko">자주 묻는 질문 FAQ</span><span class="lang-en">FAQ</span></a>
      <a href="/about"><span class="lang-ko">소개 About</span><span class="lang-en">About</span></a>
      <a href="/editorial-policy"><span class="lang-ko">콘텐츠 작성 기준</span><span class="lang-en">Editorial policy</span></a>
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
        <p style="margin:0 0 4px"><strong>${section === 'health' ? '습관을 시간표에 심기' : '계획 연습을 내 일정에 적용하기'}</strong></p>
        <p style="margin:0">${section === 'health' ? '마음에 드는 습관을 24Houring의 원형 시간표에 블록으로 넣고 매일 눈으로 확인해 보세요.' : '글의 계획 연습을 자신의 일정에 맞게 조정하고 24Houring 원형 시간표에 배치해 보세요.'} 설치·회원가입 없이 무료입니다.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/">24Houring 열기 →</a></p>
      </div>
      <div class="lang-en">
        <p style="margin:0 0 4px"><strong>${section === 'health' ? 'Plant the habit in your day' : 'Apply the exercise to your own plan'}</strong></p>
        <p style="margin:0">Add it as a block on your 24-hour circle in 24Houring and see it every day — free, no sign-up or install.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/">Open 24Houring →</a></p>
      </div>
    </div>`;

const cited = (value, lang) => escT(value).replace(/\[(\d+)\]/g, (_, n) => `<a href="#source-${lang}-${n}" aria-label="${lang === 'ko' ? '출처' : 'Source'} ${n}">[${n}]</a>`);
const paras = (arr, lang) => (arr || []).map((p) => `      <p>${cited(p, lang)}</p>`).join('\n');
const secBlocks = (arr, lang) => (arr || []).map((s) => `      <h2>${escT(s.h)}</h2>\n${paras(s.body, lang)}`).join('\n');
const listBlock = (arr, lang) => `      <ul>\n${(arr || []).map((t) => `        <li>${cited(t, lang)}</li>`).join('\n')}\n      </ul>`;
const faqBlocks = (arr, lang) => (arr || []).map((f) => `      <h3>${escT(f.q)}</h3>\n      <p>${cited(f.a, lang)}</p>`).join('\n');
const langButtons = '<span class="langswitch"><button type="button" data-guide-lang="ko" onclick="setGuideLang(\'ko\')" aria-pressed="true">한국어</button><button type="button" data-guide-lang="en" onclick="setGuideLang(\'en\')" aria-pressed="false">EN</button></span>';
function sourcesBlock(d, lang) {
  if (!d.sources?.length) return '';
  return `<section aria-label="${lang === 'ko' ? '출처와 적용 범위' : 'Sources and scope'}"><h2>${lang === 'ko' ? '출처와 적용 범위' : 'Sources and scope'}</h2><ol>${d.sources.map((s, i) => {
    if (!/^https:\/\//.test(s.url)) throw new Error(`Invalid source URL: ${s.url}`);
    return `<li id="source-${lang}-${i + 1}"><a href="${escA(s.url)}" rel="noopener">${escT(s[`title_${lang}`] || s.title)}</a><p>${escT(s[`note_${lang}`] || '')}</p></li>`;
  }).join('\n')}</ol></section>`;
}

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
    ...(d.reviewed_at ? { dateModified: d.reviewed_at } : {}),
    ...(d.sources?.length ? { citation: d.sources.map((s) => s.url) } : {}),
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

  const faqKo = (d.faq_ko && d.faq_ko.length) ? `      <h2>자주 묻는 질문</h2>\n${faqBlocks(d.faq_ko, 'ko')}` : '';
  const faqEn = (d.faq_en && d.faq_en.length) ? `      <h2>FAQ</h2>\n${faqBlocks(d.faq_en, 'en')}` : '';

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
      ${langButtons}
      <a href="/${section}/"><span class="lang-ko">${cfg.ko}</span><span class="lang-en">${cfg.en}</span></a>
      <a href="/"><span class="lang-ko">홈</span><span class="lang-en">Home</span></a>
    </nav>
  </header>
  <main class="article">
    <p class="crumb"><a href="/${section}/"><span class="lang-ko">← ${cfg.ko} 전체</span><span class="lang-en">← All ${cfg.en}</span></a></p>
    <p class="editorial-meta"><span class="lang-ko">발행: 24Houring${d.reviewed_at ? ` · 내용 검토: <time datetime="${escA(d.reviewed_at)}">${escT(d.reviewed_at)}</time>` : ''}</span><span class="lang-en">Published by 24Houring${d.reviewed_at ? ` · Content reviewed: <time datetime="${escA(d.reviewed_at)}">${escT(d.reviewed_at)}</time>` : ''}</span> · <a href="/editorial-policy"><span class="lang-ko">작성 기준</span><span class="lang-en">Editorial policy</span></a></p>
    <div class="lang-ko" lang="ko">
      <h1>${escT(d.title_ko)} <span class="en">/ ${escT(d.title_en)}</span></h1>
      <p class="en" style="margin:0 0 10px">${escT(d.tag_ko)}</p>
      <p class="lead">${escT(d.lead_ko)}</p>
${secBlocks(d.sections_ko, 'ko')}
      <h2>24Houring에서 이렇게 실천</h2>
${listBlock(d.apply_ko, 'ko')}
${faqKo}
${sourcesBlock(d, 'ko')}
    </div>
    <div class="lang-en" lang="en">
      <h1>${escT(d.title_en)}</h1>
      <p class="en" style="margin:0 0 10px">${escT(d.tag_en)}</p>
      <p class="lead">${escT(d.lead_en)}</p>
${secBlocks(d.sections_en, 'en')}
      <h2>Do it in 24Houring</h2>
${listBlock(d.apply_en, 'en')}
${faqEn}
${sourcesBlock(d, 'en')}
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
      ${langButtons}
      <a href="/guides/"><span class="lang-ko">가이드</span><span class="lang-en">Guides</span></a>
      <a href="/blog/"><span class="lang-ko">블로그</span><span class="lang-en">Blog</span></a>
      <a href="/gallery/"><span class="lang-ko">갤러리</span><span class="lang-en">Gallery</span></a>
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

// Retired slugs are answered by a REAL 301 from the Worker (see
// worker/legacy-redirects.ts) instead of a meta-refresh stub page — 40 thin
// near-duplicate HTML files used to ship with the site. Consolidating their
// subjects improves navigation; it does not establish why AdSense rejected
// the site. This generator emits the redirect map that the Worker imports.
function redirectModule(pairs) {
  const rows = pairs
    .slice()
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([from, to]) => `  '${from}': '${to}',`)
    .join('\n');
  return `/**
 * Legacy article URLs → the pillar that absorbed them.
 *
 * GENERATED by scripts/gen-pillars.mjs from each pillar's \`absorbs\` list —
 * edit the pillar JSON and re-run, do not hand-edit this file.
 *
 * The 40 thin /health and /stories pages were consolidated into 10 deep pillars.
 * Workers static assets cannot 301 on their own, so wrangler.jsonc routes
 * /health/* and /stories/* through the Worker first and it answers these paths
 * with a real 301; readers reach the consolidated topic without a stub page.
 *
 * Kept as a plain map (not a prefix rule) so a typo can never redirect a pillar
 * onto itself — see worker/__tests__/legacy-redirects.test.ts.
 */
export const LEGACY_REDIRECTS: Readonly<Record<string, string>> = {
${rows}
};

/**
 * Resolve a request path to its 301 target, or null when the path is not a
 * retired article. Trailing slashes and casing are normalised so /health/Foo/
 * redirects exactly like /health/foo.
 */
export function legacyRedirectTarget(pathname: string): string | null {
  const key = pathname.replace(/\\/+$/, '').toLowerCase();
  return LEGACY_REDIRECTS[key] ?? null;
}
`;
}

// ── Load pillar JSON ──
const files = readdirSync(PILLAR_DIR).filter((f) => f.endsWith('.json'));
const bySection = { health: [], stories: [] };
const sitemapUrls = [];
let redirects = 0;
const redirectPairs = [];

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
      redirectPairs.push([`/${section}/${old}`, `/${section}/${d.slug}`]);
      redirects++;
    }
  }
  writeFileSync(join(dir, 'index.html'), hubPage(section, pillars));
  console.log(`${section}: ${pillars.length} pillars + hub (${pillars.map((p) => p.slug).join(', ')})`);
}

writeFileSync(join(ROOT, 'worker', 'legacy-redirects.ts'), redirectModule(redirectPairs));
console.log(`301 redirects written to worker/legacy-redirects.ts: ${redirects}`);
console.log('SITEMAP_PILLAR_URLS:', JSON.stringify(sitemapUrls));
