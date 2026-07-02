/**
 * Batch 47 (offline): the /stories section renders — hub lists 20 people in 5
 * categories, and a person page is bilingual with valid Article JSON-LD.
 */
import { chromium } from 'playwright';

const HUB = 'file:///C:/vibecoding/24h/public/stories/index.html';
const PAGE = 'file:///C:/vibecoding/24h/public/stories/warren-buffett.html';
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
pass('hub Korean heading', await page.locator('h1:has-text("스토리")').first().isVisible());
const cards = await page.locator('a.gcard').count();
pass('hub lists 20 people', cards === 20, `cards=${cards}`);
const cats = await page.locator('main h2').count();
pass('hub shows 5 category sections', cats === 5, `sections=${cats}`);
pass('hub footer links /stories and /guides', (await page.locator('footer a[href="/stories/"]').count()) >= 1 && (await page.locator('footer a[href="/guides/"]').count()) >= 1);
await page.evaluate(() => setGuideLang('en'));
await wait(100);
pass('hub English heading after toggle', await page.locator('h1:has-text("Stories")').first().isVisible());

// ── Person page ──
await page.goto(PAGE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.evaluate(() => setGuideLang('ko'));
await wait(100);
pass('person KO name', await page.locator('h1:has-text("워런 버핏")').isVisible());
pass('person KO apply section', await page.locator('h2:has-text("24Houring에서 이렇게 적용")').isVisible());
const koTips = await page.locator('.lang-ko ul li').count();
pass('person KO has tips', koTips >= 3, `tips=${koTips}`);
await page.evaluate(() => setGuideLang('en'));
await wait(100);
pass('person EN name after toggle', await page.locator('.lang-en h1:has-text("Warren Buffett")').isVisible());
pass('person EN apply section', await page.locator('h2:has-text("Put it to work in 24Houring")').isVisible());
pass('person footer links /stories', (await page.locator('footer a[href="/stories/"]').count()) >= 1);

const ld = await page.evaluate(() => {
  const el = document.querySelector('script[type="application/ld+json"]');
  try { const j = JSON.parse(el.textContent); return { t: j['@type'], h: !!j.headline }; } catch { return null; }
});
pass('person Article JSON-LD valid', ld && ld.t === 'Article' && ld.h, JSON.stringify(ld));

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
