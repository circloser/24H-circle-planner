/**
 * Batch 57 (offline, dist-single): the live now-line (.now-indicator) is hidden
 * while viewing a loaded diary (a past saved day), and returns after exiting.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1100, height: 1000 }, locale: 'ko-KR' })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(300);

const key = await page.evaluate(() => {
  const slices = [{ id: 'a', label: '수면', startTime: '00:00', endTime: '24:00', color: '#a78bfa', icon: '', textPosition: 'inside' }];
  const day = { id: 'd1', schedule: { id: 's', version: 1, name: '내 하루', presetSource: null, updatedAt: '2026-07-01T00:00:00.000Z', slices } };
  localStorage.setItem('24h-circle-planner.days', JSON.stringify({ version: 1, activeId: 'd1', days: [day] }));
  localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs: { language: 'ko' } }));
  const now = new Date();
  const k = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
  localStorage.setItem('24h-circle-planner.diary', JSON.stringify({ version: 1, entries: { [k]: { date: k, name: '내 하루', slices, note: '', savedAt: 1 } } }));
  return k;
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

const nowLines = () => page.locator('.now-indicator').count();

// Normal (editing) mode → the now-line shows.
pass('now-line visible in normal mode', (await nowLines()) > 0);

// Load the diary → enter diary mode.
await page.locator('button[aria-label="내 시간표"]').first().click();
await wait(200);
await page.locator('[role="menuitem"]:has-text("일기")').first().click();
await wait(400);
await page.locator(`button[title="${key}"]`).first().click();
await wait(250);
await page.locator('[role="dialog"] button:has-text("불러오기")').last().click();
await wait(500);
pass('now-line HIDDEN while viewing a loaded diary', (await nowLines()) === 0);

// Exit the diary → the now-line returns.
await page.locator('text=일기 나가기').first().click();
await wait(500);
pass('now-line returns after exiting the diary', (await nowLines()) > 0);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
