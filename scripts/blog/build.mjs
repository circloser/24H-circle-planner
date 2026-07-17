/**
 * Blog builder — the source of truth for /blog/*.
 *
 * Each post is a markdown file in scripts/blog/posts/ with frontmatter and
 * <!--ko--> / <!--en--> sections. This script renders them into bilingual
 * static pages (guides-style shell, Article+Breadcrumb JSON-LD), the /blog/
 * hub (date-desc cards), and an RSS 2.0 feed at /blog/rss.xml.
 *
 * Publish flow:  add/edit a .md → node scripts/blog/build.mjs → commit the
 * regenerated public/blog/* → add a sitemap entry for NEW posts (the script
 * prints the XML) → push.
 *
 * Post format:
 *   ---
 *   slug: my-post            date: 2026-07-17
 *   title_ko: …              title_en: …
 *   desc_ko: …               desc_en: …
 *   ---
 *   <!--ko-->  (markdown)    <!--en-->  (markdown)
 *
 * Markdown subset: ## h2, ### h3, - / 1. lists, > quote, **bold**, *italic*,
 * [text](url), blank-line paragraphs. Kept minimal on purpose (no deps).
 */
import { writeFileSync, readFileSync, readdirSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const POSTS_DIR = join(HERE, 'posts');
const OUT = join(HERE, '..', '..', 'public', 'blog');
const ORIGIN = 'https://24houring.com';

// ─── Tiny markdown subset → HTML ─────────────────────────────────────────────

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
}

function mdToHtml(md) {
  const blocks = md.trim().split(/\n\s*\n/);
  return blocks
    .map((b) => {
      const lines = b.trim().split('\n');
      if (/^###\s/.test(lines[0])) return `<h3>${inline(lines[0].replace(/^###\s+/, ''))}</h3>`;
      if (/^##\s/.test(lines[0])) return `<h2>${inline(lines[0].replace(/^##\s+/, ''))}</h2>`;
      if (lines.every((l) => /^>\s?/.test(l))) {
        return `<blockquote>${inline(lines.map((l) => l.replace(/^>\s?/, '')).join(' '))}</blockquote>`;
      }
      if (lines.every((l) => /^-\s/.test(l))) {
        return `<ul>\n${lines.map((l) => `  <li>${inline(l.replace(/^-\s+/, ''))}</li>`).join('\n')}\n</ul>`;
      }
      if (lines.every((l) => /^\d+\.\s/.test(l))) {
        return `<ol>\n${lines.map((l) => `  <li>${inline(l.replace(/^\d+\.\s+/, ''))}</li>`).join('\n')}\n</ol>`;
      }
      return `<p>${inline(lines.join(' '))}</p>`;
    })
    .join('\n');
}

// ─── Post parsing ────────────────────────────────────────────────────────────

function parsePost(file) {
  const raw = readFileSync(join(POSTS_DIR, file), 'utf8');
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) throw new Error(`${file}: missing frontmatter`);
  const meta = {};
  for (const line of fm[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) meta[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1');
  }
  for (const k of ['slug', 'date', 'title_ko', 'title_en', 'desc_ko', 'desc_en']) {
    if (!meta[k]) throw new Error(`${file}: missing frontmatter key ${k}`);
  }
  const body = raw.slice(fm[0].length);
  const ko = body.match(/<!--ko-->([\s\S]*?)(?=<!--en-->|$)/);
  const en = body.match(/<!--en-->([\s\S]*)$/);
  if (!ko || !en) throw new Error(`${file}: needs <!--ko--> and <!--en--> sections`);
  return { ...meta, ko: mdToHtml(ko[1]), en: mdToHtml(en[1]) };
}

// ─── Shared shell (matches guides/templates) ─────────────────────────────────

const LANG_SCRIPT = `<script>
(function(){try{var o=localStorage.getItem('24h-guides-lang');var l=o;if(!l){var r=localStorage.getItem('24h-circle-planner.prefs');if(r){var p=JSON.parse(r);l=p&&p.prefs&&p.prefs.language;}}if(!l){l=(navigator.language||'ko').slice(0,2);}if(l&&l.toLowerCase()!=='ko'){document.documentElement.classList.add('show-en');}}catch(e){}})();
function setGuideLang(l){try{localStorage.setItem('24h-guides-lang',l);}catch(e){}document.documentElement.classList.toggle('show-en',l!=='ko');}
</${'script'}>`;

const HEAD_NAV = `
  <header class="site">
    <a class="logo" href="/">24Hou<b>ring</b></a>
    <nav class="site-nav">
      <span class="langswitch"><a onclick="setGuideLang('ko')">한국어</a><span class="sep">·</span><a onclick="setGuideLang('en')">EN</a></span>
      <a href="/blog/"><span class="lang-ko">블로그</span><span class="lang-en">Blog</span></a>
      <a href="/"><span class="lang-ko">홈</span><span class="lang-en">Home</span></a>
    </nav>
  </header>`;

const NAV_FOOT = `
  <footer class="site">
    <nav>
      <a href="/"><span class="lang-ko">홈 Home</span><span class="lang-en">Home</span></a>
      <a href="/blog/"><span class="lang-ko">블로그 Blog</span><span class="lang-en">Blog</span></a>
      <a href="/templates/"><span class="lang-ko">템플릿 Templates</span><span class="lang-en">Templates</span></a>
      <a href="/guides/"><span class="lang-ko">가이드 Guides</span><span class="lang-en">Guides</span></a>
      <a href="/stories/"><span class="lang-ko">스토리 Stories</span><span class="lang-en">Stories</span></a>
      <a href="/health/"><span class="lang-ko">건강 Health</span><span class="lang-en">Health</span></a>
      <a href="/faq"><span class="lang-ko">FAQ</span><span class="lang-en">FAQ</span></a>
      <a href="/about"><span class="lang-ko">소개 About</span><span class="lang-en">About</span></a>
      <a href="/privacy"><span class="lang-ko">개인정보처리방침 Privacy</span><span class="lang-en">Privacy</span></a>
      <a href="/terms"><span class="lang-ko">이용약관 Terms</span><span class="lang-en">Terms</span></a>
      <a href="/contact"><span class="lang-ko">문의 Contact</span><span class="lang-en">Contact</span></a>
    </nav>
    <p class="copy">© 2026 Circloser · 24houring.com</p>
  </footer>`;

function shell({ title, desc, canonical, jsonld, body }) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${canonical}" />
<meta name="robots" content="index, follow" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${ORIGIN}/og-image.png" />
<link rel="alternate" type="application/rss+xml" title="24Houring Blog" href="/blog/rss.xml" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="/guides/guide.css" />
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6947130056543786" crossorigin="anonymous"></${'script'}>
${jsonld}
${LANG_SCRIPT}
</head>
<body>
<div class="wrap">${HEAD_NAV}
  <main class="article">
${body}
  </main>${NAV_FOOT}
</div>
</body>
</html>
`;
}

const CTA = `
    <div class="cta card">
      <div class="lang-ko">
        <p style="margin:0 0 4px"><strong>하루를 원으로 그려 보세요</strong></p>
        <p style="margin:0">24Houring은 하루 24시간을 원형 시간표로 그리는 무료 플래너입니다. 설치·회원가입 없이 바로 시작할 수 있어요.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/">24Houring 열기 →</a></p>
      </div>
      <div class="lang-en">
        <p style="margin:0 0 4px"><strong>Draw your day as a circle</strong></p>
        <p style="margin:0">24Houring is a free planner that draws your 24 hours as a circular timetable — no sign-up or install.</p>
        <p style="margin:8px 0 0"><a class="btn" href="/">Open 24Houring →</a></p>
      </div>
    </div>`;

// ─── Page generators ─────────────────────────────────────────────────────────

const fmtDateKo = (d) => { const [y, m, day] = d.split('-'); return `${y}년 ${Number(m)}월 ${Number(day)}일`; };

function postPage(p) {
  const canonical = `${ORIGIN}/blog/${p.slug}`;
  // Optional frontmatter `image:` (path under /blog/img/) → og:image, JSON-LD
  // image, and a hero figure under the title in both languages.
  const heroUrl = p.image ? `${ORIGIN}${p.image}` : `${ORIGIN}/og-image.png`;
  const hero = p.image
    ? `<p style="text-align:center;margin:14px 0"><img src="${p.image}" alt="${esc(p.title_ko)}" width="520" style="max-width:100%;height:auto;border-radius:16px" loading="lazy" /></p>\n`
    : '';
  const jsonld = `<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'BlogPosting',
  headline: p.title_ko, description: p.desc_ko, inLanguage: ['ko', 'en'],
  image: heroUrl, datePublished: p.date, dateModified: p.date,
  author: { '@type': 'Organization', name: '24Houring', url: `${ORIGIN}/` },
  publisher: { '@type': 'Organization', name: '24Houring', url: `${ORIGIN}/` },
  mainEntityOfPage: canonical,
}, null, 1)}
</${'script'}>
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: '블로그', item: `${ORIGIN}/blog/` },
    { '@type': 'ListItem', position: 2, name: p.title_ko, item: canonical },
  ],
}, null, 1)}
</${'script'}>`;

  const body = `    <p class="crumb"><a href="/blog/"><span class="lang-ko">← 블로그 목록</span><span class="lang-en">← All posts</span></a></p>
    <div class="lang-ko">
    <h1>${esc(p.title_ko)}</h1>
    <p class="en" style="margin:0 0 14px">${fmtDateKo(p.date)} · 24Houring</p>
${hero}${p.ko}
    </div>
    <div class="lang-en">
    <h1>${esc(p.title_en)}</h1>
    <p class="en" style="margin:0 0 14px">${p.date} · 24Houring</p>
${hero}${p.en}
    </div>
${CTA}`;

  return shell({ title: `${p.title_ko} · 24Houring 블로그`, desc: p.desc_ko, canonical, jsonld, body });
}

function hubPage(posts) {
  const cards = posts
    .map((p) => `      <a class="gcard" href="/blog/${p.slug}">
        <h3><span class="lang-ko">${esc(p.title_ko)}</span><span class="lang-en">${esc(p.title_en)}</span></h3>
        <p class="en" style="margin:0 0 6px">${fmtDateKo(p.date)}</p>
        <p><span class="lang-ko">${esc(p.desc_ko)}</span><span class="lang-en">${esc(p.desc_en)}</span></p>
      </a>`)
    .join('\n');

  const jsonld = `<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Blog',
  name: '24Houring 블로그', url: `${ORIGIN}/blog/`,
  description: '시간 관리, 하루 계획, 원형 시간표 활용에 대한 24Houring의 이야기.',
  inLanguage: ['ko', 'en'],
}, null, 1)}
</${'script'}>`;

  const body = `    <h1><span class="lang-ko">블로그</span><span class="lang-en">Blog</span></h1>
    <p class="lead"><span class="lang-ko">시간 관리와 하루 계획에 대한 이야기를 씁니다. 읽고 나면 바로 원형 시간표에 적용해 볼 수 있어요.</span><span class="lang-en">Notes on time management and daily planning — things you can apply to your circular timetable right away.</span></p>
    <div class="grid" style="grid-template-columns:1fr">
${cards}
    </div>
${CTA}`;

  return shell({
    title: '블로그 — 시간 관리와 하루 계획 이야기 · 24Houring',
    desc: '시간 관리, 하루 계획, 원형 시간표 활용에 대한 24Houring의 블로그. 시간 가계부, 방학 계획, 크로노타입까지.',
    canonical: `${ORIGIN}/blog/`,
    jsonld, body,
  });
}

function rss(posts) {
  const items = posts
    .map((p) => `    <item>
      <title>${esc(p.title_ko)}</title>
      <link>${ORIGIN}/blog/${p.slug}</link>
      <guid isPermaLink="true">${ORIGIN}/blog/${p.slug}</guid>
      <pubDate>${new Date(`${p.date}T09:00:00+09:00`).toUTCString()}</pubDate>
      <description>${esc(p.desc_ko)}</description>
    </item>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>24Houring 블로그</title>
    <link>${ORIGIN}/blog/</link>
    <description>시간 관리, 하루 계획, 원형 시간표 활용에 대한 24Houring의 이야기.</description>
    <language>ko</language>
${items}
  </channel>
</rss>
`;
}

// ─── Run ─────────────────────────────────────────────────────────────────────

mkdirSync(OUT, { recursive: true });
const posts = readdirSync(POSTS_DIR)
  .filter((f) => f.endsWith('.md'))
  .map(parsePost)
  .sort((a, b) => (a.date < b.date ? 1 : -1));

for (const p of posts) {
  writeFileSync(join(OUT, `${p.slug}.html`), postPage(p));
  console.log(`post  ${p.slug}.html (${p.date})`);
}
writeFileSync(join(OUT, 'index.html'), hubPage(posts));
writeFileSync(join(OUT, 'rss.xml'), rss(posts));
console.log(`hub   index.html · rss.xml — ${posts.length} posts`);
console.log('\nsitemap entries (add NEW ones to public/sitemap.xml):');
for (const p of posts) {
  console.log(`  <url><loc>${ORIGIN}/blog/${p.slug}</loc><lastmod>${p.date}</lastmod><changefreq>yearly</changefreq><priority>0.6</priority></url>`);
}
