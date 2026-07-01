/**
 * Batch 40 (offline, dist-single): analysis + goals use SAVED DIARIES only.
 *  - A 'day' goal reads 0 while today has no saved diary (working timetable
 *    never counts). After a diary for today exists, it reflects.
 *  - Analytics dropped the current/all scopes (diary-only); no "현재 시간표".
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
await wait(300);

// A 'day' goal on 운동, target 1 min. NO diary yet.
await page.evaluate(() => {
  localStorage.setItem('24h-circle-planner.goals', JSON.stringify({ version: 1, goals: [{ id: 'g1', label: '운동', targetMinutes: 1, period: 'day' }] }));
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await wait(400);

await page.locator('button[aria-label="목표/미션"]').first().click();
await wait(300);
const zeroBeforeDiary = await page.locator('text=0시간 0분').first().isVisible().catch(() => false);
pass('goal reads 0 while today is not saved as a diary', zeroBeforeDiary);

// Now save a diary for today that contains 운동.
await page.evaluate(() => {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const slices = [
    { id: 'x', label: '운동', startTime: '00:00', endTime: '12:00', color: '#60a5fa', icon: '', textPosition: 'inside' },
    { id: 'y', label: '휴식', startTime: '12:00', endTime: '24:00', color: '#f472b6', icon: '', textPosition: 'inside' },
  ];
  localStorage.setItem('24h-circle-planner.diary', JSON.stringify({ version: 1, entries: { [key]: { date: key, name: '', slices, savedAt: 1 } } }));
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await wait(400);

await page.locator('button[aria-label="목표/미션"]').first().click();
await wait(300);
const stillZero = await page.locator('text=0시간 0분').count();
pass('saved diary → goal now reflects (no 0시간 0분)', stillZero === 0, `zeroText=${stillZero}`);

// Analytics: diary-only (no 현재 시간표 scope), shows the saved label.
await page.locator('button[aria-label="내 시간표"]').first().click();
await wait(200);
await page.locator('[role="menuitem"]:has-text("분석")').first().click();
await wait(400);
const dlgText = await page.locator('[role="dialog"]').first().innerText();
pass('analytics shows the saved diary label (운동)', dlgText.includes('운동'), '');
pass('analytics has NO current/all scope selector', !dlgText.includes('현재 시간표'), '');
pass('analytics range selector present (전체)', dlgText.includes('전체'), '');

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
