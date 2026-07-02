/**
 * Batch 49 (offline, dist-single, MOBILE viewport): mobile diary + memo layout.
 *  1. When a diary is loaded, the date/exit pill is IN-FLOW (not a fixed overlay)
 *     and its "일기 나가기" button stays on one line (no vertical char wrapping).
 *  2. Mobile post-it cards center their text (justify-content: center).
 *  3. No horizontal overflow in diary mode.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

const key = await page.evaluate(() => {
  const slices = [
    { id: 'a', label: '수면', startTime: '00:00', endTime: '08:00', color: '#a78bfa', icon: '', textPosition: 'inside' },
    { id: 'b', label: '일', startTime: '08:00', endTime: '18:00', color: '#f472b6', icon: '', textPosition: 'inside' },
    { id: 'c', label: '휴식', startTime: '18:00', endTime: '24:00', color: '#34d399', icon: '', textPosition: 'inside' },
  ];
  const day = { id: 'd1', schedule: { id: 's', version: 1, name: '내 하루', presetSource: null, updatedAt: '2026-07-01T00:00:00.000Z', slices } };
  localStorage.setItem('24h-circle-planner.days', JSON.stringify({ version: 1, activeId: 'd1', days: [day] }));
  const now = new Date();
  const k = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
  localStorage.setItem('24h-circle-planner.diary', JSON.stringify({ version: 1, entries: { [k]: { date: k, name: '내 하루', slices, note: '기록', savedAt: 1 } } }));
  return k;
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(500);

// (2) mobile memo card centers its text.
const memoJustify = await page.evaluate(() => {
  const ta = document.querySelector('section textarea');
  return ta && ta.parentElement ? getComputedStyle(ta.parentElement).justifyContent : null;
});
pass('mobile memo card centers content', memoJustify === 'center', `justify=${memoJustify}`);

// Load the diary via the calendar.
await page.locator('button[aria-label="내 시간표"]').first().click().catch(() => {});
await wait(300);
await page.locator('[role="menuitem"]:has-text("일기")').first().click().catch(() => {});
await wait(400);
await page.locator(`button[title="${key}"]`).first().click().catch(() => {});
await wait(300);
await page.locator('[role="dialog"] button:has-text("불러오기")').last().click().catch(() => {});
await wait(700);

// (1) diary pill is in-flow (not fixed) and the exit button doesn't wrap tall.
const pill = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('일기 나가기'));
  if (!btn || !btn.parentElement) return null;
  return { pos: getComputedStyle(btn.parentElement).position, h: btn.clientHeight };
});
pass('diary pill is in-flow on mobile (not a fixed overlay)', pill && pill.pos !== 'fixed', `pos=${pill && pill.pos}`);
pass('exit button stays on one line (no vertical wrap)', pill && pill.h > 0 && pill.h < 44, `h=${pill && pill.h}`);

// (3) no horizontal overflow.
const of = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
pass('no horizontal overflow in diary mode', of.s <= of.c, JSON.stringify(of));

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
