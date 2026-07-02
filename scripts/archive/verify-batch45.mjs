/**
 * Batch 45 (offline, dist-single): deleting a saved diary asks first.
 *  - Clicking the X on a saved calendar day no longer wipes it instantly; it
 *    opens a delete-confirmation dialog.
 *  - Cancel keeps the entry; confirming (삭제) removes it.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1100, height: 1000 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

// Seed a saved diary on day 15 of the CURRENT month, then reload.
const key = await page.evaluate(() => {
  const now = new Date();
  const k = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
  const slices = [{ id: 'a', label: '수면', startTime: '00:00', endTime: '24:00', color: '#a78bfa', icon: '', textPosition: 'inside' }];
  localStorage.setItem('24h-circle-planner.diary', JSON.stringify({ version: 1, entries: { [k]: { date: k, name: '', slices, savedAt: 1 } } }));
  return k;
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

const hasEntry = () => page.evaluate((k) => {
  try { return !!JSON.parse(localStorage.getItem('24h-circle-planner.diary')).entries[k]; } catch { return false; }
}, key);

// Open 내 시간표 → 일기.
await page.locator('button[aria-label="내 시간표"]').first().click();
await wait(200);
await page.locator('[role="menuitem"]:has-text("일기")').first().click();
await wait(400);
pass('diary dialog opens', await page.locator('[role="dialog"]').first().isVisible().catch(() => false));

const cell = page.locator(`button[title="${key}"]`).first();
pass('saved day cell present', await cell.isVisible().catch(() => false), `key=${key}`);

// Hover the cell to reveal the X, then click it.
await cell.hover();
await wait(150);
await cell.locator('[aria-label="삭제"]').first().click({ force: true });
await wait(300);

// A confirmation warning appears and NOTHING is deleted yet.
const confirmVisible = await page.locator('[role="dialog"]:has-text("일기 삭제")').first().isVisible().catch(() => false);
pass('delete asks for confirmation (warning shown)', confirmVisible);
pass('entry NOT deleted before confirming', await hasEntry());

// Cancel keeps the entry.
await page.locator('[role="dialog"]:has-text("일기 삭제") button:has-text("취소")').first().click();
await wait(300);
pass('cancel keeps the entry', await hasEntry());

// Re-open the X → confirm → delete for real.
await cell.hover();
await wait(150);
await cell.locator('[aria-label="삭제"]').first().click({ force: true });
await wait(300);
await page.locator('[role="dialog"]:has-text("일기 삭제") button:has-text("삭제")').last().click();
await wait(300);
pass('confirming removes the entry', !(await hasEntry()));
pass('saved day cell is gone after delete', !(await page.locator(`button[title="${key}"] [aria-label="삭제"]`).count()));

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
