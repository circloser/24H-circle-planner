/**
 * Batch 46 (offline): the static FAQ page renders bilingually with valid content.
 *  - Korean by default-toggle shows the 15 Q&A; English toggle swaps the language.
 *  - Footer links /faq; FAQPage JSON-LD is present and parses.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/public/faq.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });

// Force Korean and check the KO content.
await page.evaluate(() => setGuideLang('ko'));
await wait(100);
pass('Korean heading visible', await page.locator('h1:has-text("자주 묻는 질문")').isVisible());
pass('English heading hidden in KO mode', !(await page.locator('h1:has-text("Frequently Asked Questions")').isVisible()));
const koCount = await page.locator('.lang-ko .qa').count();
pass('15 Q&A rendered (KO)', koCount === 15, `count=${koCount}`);

// Toggle to English.
await page.evaluate(() => setGuideLang('en'));
await wait(100);
pass('English heading visible after toggle', await page.locator('h1:has-text("Frequently Asked Questions")').isVisible());
pass('Korean heading hidden in EN mode', !(await page.locator('h1:has-text("자주 묻는 질문")').isVisible()));
const enCount = await page.locator('.lang-en .qa').count();
pass('15 Q&A rendered (EN)', enCount === 15, `count=${enCount}`);

// Footer self-links /faq.
pass('footer links /faq', (await page.locator('footer a[href="/faq"]').count()) >= 1);

// FAQPage structured data present + parses to 15 questions.
const ld = await page.evaluate(() => {
  const el = document.querySelector('script[type="application/ld+json"]');
  try { const j = JSON.parse(el.textContent); return { type: j['@type'], n: j.mainEntity.length }; } catch { return null; }
});
pass('FAQPage JSON-LD valid (15 Q)', ld && ld.type === 'FAQPage' && ld.n === 15, JSON.stringify(ld));

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
