/**
 * Batch 36 (offline, dist-single): exit diary mode → back to timetable editing.
 *  - Loading a diary must NOT overwrite the working day (writeback gated).
 *  - The "일기 나가기" button restores the working day's timetable + clears the
 *    locked diary view.
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

// Seed a diary entry (current month, day 05) with a distinct 1-slice schedule.
await page.evaluate(() => {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const d1 = `${ym}-05`;
  const slice = [{ id: 's1', label: '일기', startTime: '00:00', endTime: '24:00', color: '#f472b6', icon: '', textPosition: 'inside' }];
  localStorage.setItem('24h-circle-planner.diary', JSON.stringify({ version: 1, entries: { [d1]: { date: d1, name: 'D', slices: slice, savedAt: 1 } } }));
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await wait(500);

const workDayCount = () => page.evaluate(() => JSON.parse(localStorage.getItem('24h-circle-planner.days')).days[0].schedule.slices.length);
const A = await workDayCount();
pass('working day has a multi-slice timetable', A >= 3, `slices=${A}`);

// Open diary → load the seeded entry (day 05).
await page.locator('button[aria-label="내 시간표"]').first().click();
await wait(200);
await page.locator('[role="menuitem"]:has-text("일기")').first().click();
await wait(400);
await page.locator('[role="dialog"] .grid button').filter({ has: page.locator('svg') }).first().click();
await wait(250);
await page.getByRole('button', { name: '불러오기', exact: true }).first().click();
await wait(500);

const loadedCount = await page.locator('svg[role="img"] path[data-slice-id]').count();
pass('diary loaded (chart shows the 1-slice record)', loadedCount === 1, `slices=${loadedCount}`);

const exitVisible = await page.locator('button:has-text("일기 나가기")').first().isVisible().catch(() => false);
pass('"일기 나가기" button appears', exitVisible);

// CRITICAL: the working day must be untouched while the diary is loaded.
const preserved = await workDayCount();
pass('working day preserved (not overwritten by the diary)', preserved === A, `before=${A} after=${preserved}`);

// Exit → back to the working timetable.
await page.locator('button:has-text("일기 나가기")').first().click();
await wait(500);
const afterExit = await page.locator('svg[role="img"] path[data-slice-id]').count();
pass('exit restores the working timetable', afterExit === A, `slices=${afterExit}`);
const exitGone = await page.locator('button:has-text("일기 나가기")').count();
pass('diary pill gone after exit', exitGone === 0);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
