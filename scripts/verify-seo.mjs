/**
 * Verifies the SEO setup in the PRODUCTION build (dist/):
 *  - <html lang>, title, meta description (length sane), canonical;
 *  - Open Graph + Twitter card tags with an absolute og:image;
 *  - valid JSON-LD WebApplication structured data;
 *  - robots.txt (with Sitemap line) and sitemap.xml (with the canonical loc)
 *    and og-image.png are present at the site root.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const FILE = 'file:///C:/vibecoding/24h/dist/index.html';
const SITE = 'https://24houringp.singlena.workers.dev';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
// The app's hashed JS 404s on file:// — irrelevant; we only read <head> meta.
await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });

const meta = await page.evaluate(() => {
  const get = (sel, attr = 'content') => {
    const el = document.querySelector(sel);
    return el ? el.getAttribute(attr) : null;
  };
  let ld = null;
  const ldEl = document.querySelector('script[type="application/ld+json"]');
  try { ld = ldEl ? JSON.parse(ldEl.textContent) : null; } catch { ld = 'INVALID'; }
  return {
    lang: document.documentElement.lang,
    title: document.title,
    description: get('meta[name="description"]'),
    canonical: get('link[rel="canonical"]', 'href'),
    robots: get('meta[name="robots"]'),
    ogTitle: get('meta[property="og:title"]'),
    ogImage: get('meta[property="og:image"]'),
    ogUrl: get('meta[property="og:url"]'),
    ogType: get('meta[property="og:type"]'),
    twCard: get('meta[name="twitter:card"]'),
    twImage: get('meta[name="twitter:image"]'),
    ld,
  };
});
await browser.close();

const robots = fs.existsSync(path.join(DIST, 'robots.txt')) ? fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8') : '';
const sitemap = fs.existsSync(path.join(DIST, 'sitemap.xml')) ? fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8') : '';
const descLen = meta.description ? meta.description.length : 0;

console.log('lang:', meta.lang, '| title:', meta.title);
console.log('descLen:', descLen);
console.log('canonical:', meta.canonical);
console.log('og:image:', meta.ogImage);
console.log('twitter:card:', meta.twCard);
console.log('ld type:', meta.ld && meta.ld['@type']);

const checks = {
  langKo: meta.lang === 'ko',
  titleHasBrand: !!meta.title && meta.title.includes('24Houring'),
  descPresent: descLen >= 50 && descLen <= 320,
  robotsIndex: !!meta.robots && /index/.test(meta.robots),
  canonicalAbs: meta.canonical === `${SITE}/`,
  ogType: meta.ogType === 'website',
  ogTitle: !!meta.ogTitle,
  ogImageAbs: meta.ogImage === `${SITE}/og-image.png`,
  ogUrl: meta.ogUrl === `${SITE}/`,
  twitterLargeImage: meta.twCard === 'summary_large_image' && !!meta.twImage,
  jsonLdValid: meta.ld && meta.ld !== 'INVALID' && meta.ld['@type'] === 'WebApplication',
  robotsFile: /Allow: \//.test(robots) && /Sitemap:\s*https:\/\//.test(robots),
  sitemapFile: sitemap.includes(`${SITE}/`) && sitemap.includes('<urlset'),
  ogImageFile: fs.existsSync(path.join(DIST, 'og-image.png')),
};
console.log('checks:', JSON.stringify(checks, null, 0));
const ok = Object.values(checks).every(Boolean);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
