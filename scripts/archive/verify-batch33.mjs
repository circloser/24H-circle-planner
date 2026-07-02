/**
 * Batch 33 (offline, dist-single): the bottom day/diary indicator pill must not
 * overlap the footer. Add a 2nd day → the "n일 중 n일" pill appears → assert its
 * bottom edge sits above the footer's top edge, and the footer is readable.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 1000 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

// Add a 2nd day (duplicate) → the day-counter pill shows.
await page.locator('button[aria-label="날짜 추가"]').first().click();
await wait(250);
await page.locator('button:has-text("현재 시간표 복제")').first().click();
await wait(500);

const pill = await page.getByText(/\d+일 중 \d+일/).first().boundingBox().catch(() => null);
const footer = await page.locator('footer').first().boundingBox().catch(() => null);
pass('indicator pill present', !!pill, pill ? `y=${Math.round(pill.y)} h=${Math.round(pill.height)}` : '');
pass('footer present', !!footer, footer ? `top=${Math.round(footer.y)}` : '');

if (pill && footer) {
  const pillBottom = pill.y + pill.height;
  pass('pill sits above the footer (no overlap)', pillBottom <= footer.y + 1, `pillBottom=${Math.round(pillBottom)} footerTop=${Math.round(footer.y)}`);
}

const footerReadable = await page.locator('footer a:has-text("소개")').first().isVisible().catch(() => false);
pass('footer links readable', footerReadable);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
