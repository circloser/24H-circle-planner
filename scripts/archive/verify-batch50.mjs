/**
 * Batch 50 (offline): the /health section renders — hub lists 20 tips in 5
 * categories with a wellness disclaimer, and a tip page is bilingual with the
 * disclaimer + valid Article JSON-LD.
 */
import { chromium } from 'playwright';

const HUB = 'file:///C:/vibecoding/24h/public/health/index.html';
const PAGE = 'file:///C:/vibecoding/24h/public/health/regular-sleep-schedule.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

// ── Hub ──
await page.goto(HUB, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.evaluate(() => setGuideLang('ko'));
await wait(100);
pass('hub Korean heading', await page.locator('h1:has-text("건강")').first().isVisible());
const cards = await page.locator('a.gcard').count();
pass('hub lists 20 tips', cards === 20, `cards=${cards}`);
pass('hub shows 5 category sections', (await page.locator('main h2').count()) === 5);
pass('hub shows wellness disclaimer', await page.locator('text=의학적 조언이 아닙니다').first().isVisible());
pass('hub footer links /health + /stories + /guides',
  (await page.locator('footer a[href="/health/"]').count()) >= 1 &&
  (await page.locator('footer a[href="/stories/"]').count()) >= 1 &&
  (await page.locator('footer a[href="/guides/"]').count()) >= 1);
await page.evaluate(() => setGuideLang('en'));
await wait(100);
pass('hub English heading after toggle', await page.locator('.lang-en h1:has-text("Health")').first().isVisible());

// ── Tip page ──
await page.goto(PAGE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.evaluate(() => setGuideLang('ko'));
await wait(100);
pass('tip KO title', await page.locator('h1:has-text("규칙적인 수면 시간")').isVisible());
pass('tip KO apply section', await page.locator('h2:has-text("24Houring에서 이렇게 실천")').isVisible());
pass('tip KO has tips', (await page.locator('.lang-ko ul li').count()) >= 3);
pass('tip shows disclaimer', await page.locator('text=의학적 조언이 아닙니다').first().isVisible());
await page.evaluate(() => setGuideLang('en'));
await wait(100);
pass('tip EN title after toggle', await page.locator('.lang-en h1:has-text("A regular sleep schedule")').isVisible());
pass('tip EN apply section', await page.locator('h2:has-text("Build the habit in 24Houring")').isVisible());
pass('tip footer links /health', (await page.locator('footer a[href="/health/"]').count()) >= 1);

const ld = await page.evaluate(() => {
  const el = document.querySelector('script[type="application/ld+json"]');
  try { const j = JSON.parse(el.textContent); return { t: j['@type'], h: !!j.headline }; } catch { return null; }
});
pass('tip Article JSON-LD valid', ld && ld.t === 'Article' && ld.h, JSON.stringify(ld));

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
