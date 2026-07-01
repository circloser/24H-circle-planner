/**
 * Batch 38 (offline, dist-single): date-range export (내보내기 → 기간).
 *  - Seed 3 diary entries (day 05/06/07). Range 01–28 → count says 3.
 *  - Circle image, table image, and CSV each trigger a download.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1100, height: 1050 }, acceptDownloads: true })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

// Seed 3 diary entries in the current month (each with 2 slices).
const ym = await page.evaluate(() => {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const slices = (l) => [
    { id: 'a' + l, label: l + '오전', startTime: '00:00', endTime: '12:00', color: '#60a5fa', icon: '', textPosition: 'inside' },
    { id: 'b' + l, label: l + '오후', startTime: '12:00', endTime: '24:00', color: '#f472b6', icon: '', textPosition: 'inside' },
  ];
  const entries = {};
  for (const [d, nm] of [['05', 'A'], ['06', 'B'], ['07', 'C']]) {
    entries[`${ym}-${d}`] = { date: `${ym}-${d}`, name: nm, slices: slices(nm), savedAt: Number(d) };
  }
  localStorage.setItem('24h-circle-planner.diary', JSON.stringify({ version: 1, entries }));
  return ym;
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await wait(500);

// Open 내보내기 → 기간 tab.
await page.locator('button[aria-label="내보내기"]').first().click();
await wait(400);
await page.locator('[role="dialog"] [role="tab"]:has-text("기간")').first().click();
await wait(300);
const rangeVisible = await page.locator('[role="dialog"] input[type="date"]').first().isVisible().catch(() => false);
pass('기간 tab shows date inputs', rangeVisible);

// Set the range 01–28 (covers 05/06/07).
await page.locator('[role="dialog"] input[type="date"]').nth(0).fill(`${ym}-01`);
await page.locator('[role="dialog"] input[type="date"]').nth(1).fill(`${ym}-28`);
await wait(300);
const dialogText = await page.locator('[role="dialog"]').first().innerText();
pass('count shows 3 saved diaries in range', dialogText.includes('3개'), dialogText.split('\n').find((l) => l.includes('개')) || '');

// Circle image download.
const [dCircle] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.locator('[role="dialog"] button:has-text("이미지로 저장")').first().click(),
]);
pass('circle image downloaded (.png)', dCircle.suggestedFilename().endsWith('.png'), dCircle.suggestedFilename());

// Switch to 표, download table image.
await page.locator('[role="dialog"]').getByRole('button', { name: '표', exact: true }).first().click();
await wait(200);
const [dTable] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.locator('[role="dialog"] button:has-text("이미지로 저장")').first().click(),
]);
pass('table image downloaded (.png)', dTable.suggestedFilename().endsWith('.png'), dTable.suggestedFilename());

// CSV download.
const [dCsv] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.locator('[role="dialog"] button:has-text("CSV로 저장")').first().click(),
]);
pass('range CSV downloaded (.csv)', dCsv.suggestedFilename().endsWith('.csv'), dCsv.suggestedFilename());

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
