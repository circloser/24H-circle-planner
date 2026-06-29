/**
 * Batch 32 (offline, dist-single): real-time recording mode (non-contiguous).
 *  - Cycle the view to 기록(record). Live: Start → "기록 중" banner → Cancel.
 *  - Manual add (label + start/end) → an arc on the ring + a list row + persist.
 *  - Empty time stays empty (record arcs only; not a full 24h ring).
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1100, height: 1050 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

// Cycle the view toggle to record mode.
const toggle = page.locator('button[aria-label*="보기 전환"]').first();
let inRecord = false;
for (let i = 0; i < 6; i++) {
  inRecord = await page.locator('svg[aria-label="record-ring"]').isVisible().catch(() => false);
  if (inRecord) break;
  await toggle.click();
  await wait(220);
}
pass('reached record mode (ring shown)', inRecord);

// Live: Start → banner → Cancel.
await page.locator('input[placeholder*="무엇을 기록"]').first().fill('운동');
await page.locator('button:has-text("시작")').first().click();
await wait(300);
const recording = await page.locator('text=기록 중').first().isVisible().catch(() => false);
const activeStored = await page.evaluate(() => { try { return !!JSON.parse(localStorage.getItem('24h-circle-planner.records')).active; } catch { return false; } });
pass('live start shows recording banner + persists active', recording && activeStored);
await page.locator('button[aria-label="취소"]').first().click();
await wait(300);
const activeCleared = await page.evaluate(() => { try { return !JSON.parse(localStorage.getItem('24h-circle-planner.records')).active; } catch { return false; } });
pass('cancel clears the active recording', activeCleared);

// Manual add (deterministic, no wall-clock dependency).
await page.locator('input[placeholder*="무엇을 기록"]').first().fill('공부');
await page.locator('input[type="time"]').nth(0).fill('09:00');
await page.locator('input[type="time"]').nth(1).fill('11:30');
await page.locator('button:has-text("추가")').first().click();
await wait(400);

const arcs = await page.locator('svg[aria-label="record-ring"] path').count();
pass('manual record drew an arc (gap-allowed ring)', arcs >= 1, `arcs=${arcs}`);
const listed = await page.locator('li:has-text("공부")').first().isVisible().catch(() => false);
pass('record appears in the list', listed);
const persisted = await page.evaluate(() => {
  try {
    const byDate = JSON.parse(localStorage.getItem('24h-circle-planner.records')).byDate;
    const all = Object.values(byDate).flat();
    return all.some((r) => r.label === '공부' && r.start === '09:00' && r.end === '11:30');
  } catch { return false; }
});
pass('record persisted with start/end', persisted);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
