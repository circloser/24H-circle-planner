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
  check(!/<script\b[^>]*src=["'][^"']*(?:pagead2\.googlesyndication\.com|googletagmanager\.com)/i.test(html), `${path}: third-party advertising or analytics loader present before consent`);
  check(!/src=["']\/publisher-ads\.js["']/i.test(html), `${path}: dormant publisher ad loader reference`);
  check(!/src=["']\/content-analytics\.js["']/i.test(html), `${path}: dormant analytics loader reference`);
}
const notFoundDoc = new JSDOM(readFileSync(join(dist, '404.html'), 'utf8')).window.document;
check(/noindex/i.test(notFoundDoc.querySelector('meta[name="robots"]')?.content || ''), '404.html: must be excluded from search results');
check(notFoundDoc.querySelectorAll('h1').length === 1, '404.html: needs one clear page heading');
check(!notFoundDoc.querySelector('link[rel="canonical"]'), '404.html: must not claim a canonical content URL');
const wranglerConfig = readFileSync('wrangler.jsonc', 'utf8');
check(/"not_found_handling"\s*:\s*"404-page"/.test(wranglerConfig), 'wrangler.jsonc: unknown public paths must return a real 404');
for (const utility of ['s.html', 'widget.html']) {
  const utilityDoc = new JSDOM(readFileSync(join(dist, utility), 'utf8')).window.document;
  check(/noindex/i.test(utilityDoc.querySelector('meta[name="robots"]')?.content || ''), `${utility}: utility entry must be excluded from search results`);
  check(utilityDoc.getElementById('root'), `${utility}: missing application mount point`);
}
const adsTxt = readFileSync(join(dist, 'ads.txt'), 'utf8').trim();
check(adsTxt === 'google.com, pub-6947130056543786, DIRECT, f08c47fec0942fa0', 'ads.txt: publisher authorization record is missing or unexpected');
const locales = ['', 'ko/', 'de/', 'ja/', 'zh/', 'fr/', 'es/', 'ru/'];
for (const locale of locales) {
  const path = `${locale}index.html`;
  const doc = new JSDOM(readFileSync(join(dist, path), 'utf8')).window.document;
  const root = doc.getElementById('root');
  const copy = doc.getElementById('site-copy');
  check(root && copy && !root.contains(copy), `${path}: editorial content must survive React mount`);
  check(doc.querySelector('meta[name="google-adsense-account"]')?.content === 'ca-pub-6947130056543786', `${path}: missing site verification`);
}
const guides = ['time-blocking', 'time-audit', 'morning-evening-routine'];
const editorial = pages.map(p => relative(dist,p).replaceAll('\\','/')).filter(p => /^(?:(?:guides|health|stories|blog)\/[^/]+|(?:(?:de|ja)\/)?templates\/[^/]+)\.html$/.test(p));
const critical = [...new Set(['index.html', ...locales.slice(1).map((l) => `${l}index.html`), 'about.html', 'contact.html', 'faq.html', 'editorial-policy.html', 'privacy.html', 'life-planner.html', 'for-students.html', 'for-workers.html', 'for-parents.html', 'weekend-planner.html', 'calendar.html', 'life.html', 'gallery/index.html', ...editorial])];
const sitemapDoc = new JSDOM(readFileSync(join(dist, 'sitemap.xml'), 'utf8'), { contentType: 'text/xml' }).window.document;
const sitemapUrls = [...sitemapDoc.querySelectorAll('url > loc')].map((node) => node.textContent.trim());
check(sitemapUrls.length === new Set(sitemapUrls).size, 'sitemap.xml: duplicate URL entries');
check(!sitemapUrls.includes(`${origin}/404`), 'sitemap.xml: 404 page must not be submitted');
function resolveLocal(path) {
  const base = join(dist, decodeURIComponent(path));
  return [base, `${base}.html`, join(base, 'index.html')].find((p) => existsSync(p) && statSync(p).isFile());
}
let links = 0;
for (const path of critical) {
  const doc = new JSDOM(readFileSync(join(dist, path), 'utf8'), { url: `${origin}/${path.replace(/index\.html$/, '')}` }).window.document;
  check(doc.querySelector('title')?.textContent.trim(), `${path}: missing title`);
  const canonical = doc.querySelector('link[rel="canonical"]')?.href;
  check(canonical, `${path}: missing canonical`);
  check(canonical && sitemapUrls.includes(canonical), `${path}: canonical missing from sitemap`);
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
    check(!doc.querySelector('script[src="/publisher-ads.js"]'), `${path}: review-stage page must not request ads before consent setup`);
    check(doc.querySelector('a[href="/editorial-policy"]'), `${path}: missing editorial standards link`);
    for (const img of doc.images) check(img.hasAttribute('alt') && img.width && img.height, `${path}: image needs alt text and reserved dimensions`);
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Publishing checks passed: ${pages.length} HTML pages, ${locales.length} persistent app locales, ${links} local resources, ${guides.length} reviewed editorial pages, no pre-consent third-party loaders.`);
}
