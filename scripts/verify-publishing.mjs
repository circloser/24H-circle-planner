// Validate the published HTML, not just source templates: locale generation
// must retain reader-visible content and may not reintroduce global ad loaders.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { JSDOM } from 'jsdom';

const dist = 'dist';
const origin = 'https://24houring.com';
const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };
const pages = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (path.endsWith('.html')) pages.push(path);
  }
}
walk(dist);
for (const path of pages) {
  const html = readFileSync(path, 'utf8');
  check(!/<script\b[^>]*src=["'][^"']*pagead2\.googlesyndication\.com/i.test(html), `${path}: direct global Google ad loader`);
}
const locales = ['', 'ko/', 'de/', 'ja/', 'zh/', 'fr/', 'es/', 'ru/'];
for (const locale of locales) {
  const path = `${locale}index.html`;
  const doc = new JSDOM(readFileSync(join(dist, path), 'utf8')).window.document;
  const root = doc.getElementById('root');
  const copy = doc.getElementById('site-copy');
  check(root && copy && !root.contains(copy), `${path}: editorial content must survive React mount`);
  check(doc.querySelector('meta[name="google-adsense-account"]')?.content === 'ca-pub-6947130056543786', `${path}: missing site verification`);
  check(!doc.querySelector('script[src="/publisher-ads.js"]'), `${path}: app entry should not load publisher ads`);
}
const guides = ['time-blocking', 'time-audit', 'morning-evening-routine'];
const editorial = pages.map(p => relative(dist,p).replaceAll('\\','/')).filter(p => /^(?:(?:guides|health|stories|blog)\/[^/]+|(?:(?:de|ja)\/)?templates\/[^/]+)\.html$/.test(p));
const critical = [...new Set(['index.html', ...locales.slice(1).map((l) => `${l}index.html`), 'about.html', 'contact.html', 'faq.html', 'editorial-policy.html', 'privacy.html', 'life-planner.html', 'for-students.html', 'for-workers.html', 'for-parents.html', 'weekend-planner.html', 'gallery/index.html', ...editorial])];
function resolveLocal(path) {
  // Shared schedule import is handled by the app, not a static HTML file.
  if (path === "/s") return existsSync(join(dist, "index.html"));
  const base = join(dist, decodeURIComponent(path));
  return [base, `${base}.html`, join(base, 'index.html')].find((p) => existsSync(p) && statSync(p).isFile());
}
let links = 0;
for (const path of critical) {
  const doc = new JSDOM(readFileSync(join(dist, path), 'utf8'), { url: `${origin}/${path.replace(/index\.html$/, '')}` }).window.document;
  check(doc.querySelector('title')?.textContent.trim(), `${path}: missing title`);
  check(doc.querySelector('link[rel="canonical"]'), `${path}: missing canonical`);
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try { JSON.parse(script.textContent); } catch { check(false, `${path}: invalid structured data`); }
  }
  if (/^(health|stories)\/(?!index\.html)/.test(path)) {
    for (const lang of ['ko', 'en']) {
      check(doc.querySelector(`[id="source-${lang}-1"] a[href^="https://"]`), `${path}: missing ${lang} primary source`);
    }
    check(doc.querySelector('a[href="/editorial-policy"]'), `${path}: missing editorial policy`);
  }
  for (const node of doc.querySelectorAll('a[href], img[src], script[src], link[rel="stylesheet"]')) {
    const raw = node.getAttribute('href') ?? node.getAttribute('src');
    const url = new URL(raw, doc.URL);
    if (url.origin !== origin || url.pathname.startsWith('/api/')) continue;
    links++;
    check(resolveLocal(url.pathname), `${path}: unresolved local resource ${raw}`);
    if (raw.startsWith('#') && !raw.startsWith('#p=')) {
      check(doc.getElementById(decodeURIComponent(raw.slice(1))), `${path}: missing section ${raw}`);
    }
  }
  if (guides.some((slug) => path === `guides/${slug}.html`)) {
    check(doc.querySelector('main[data-publisher-content]'), `${path}: missing editorial content marker`);
    check(doc.querySelectorAll('script[src="/publisher-ads.js"]').length === 1, `${path}: guarded ad loader must appear once`);
    check(doc.querySelector('a[href="/editorial-policy"]'), `${path}: missing editorial standards link`);
    for (const img of doc.images) check(img.hasAttribute('alt') && img.width && img.height, `${path}: image needs alt text and reserved dimensions`);
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Publishing checks passed: ${pages.length} HTML pages, ${locales.length} persistent app locales, ${links} local resources, ${guides.length} guarded editorial pages.`);
}
