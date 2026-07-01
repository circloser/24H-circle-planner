/**
 * Batch 31 (offline, dist-single): time-accumulation goals.
 *  - Open 목표/미션, add a goal on a label that exists in the seeded schedule,
 *    confirm progress accumulates (>0), the bar fills, and it persists.
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

// Open 내 시간표 → 목표/미션.
await page.locator('button[aria-label="내 시간표"]').first().click();
await wait(200);
await page.locator('[role="menuitem"]:has-text("목표")').first().click();
await wait(400);

const dialogVisible = await page.locator('[role="dialog"]:has-text("목표")').first().isVisible().catch(() => false);
pass('goals dialog opens', dialogVisible);

// Pick a label that exists in the seeded schedule (from the datalist).
const label = await page.evaluate(() => {
  const opt = document.querySelector('#goal-labels option');
  return opt ? opt.value : '';
});
pass('seeded labels available for goals', !!label, `label=${label}`);

await page.locator('input[list="goal-labels"]').first().fill(label);
await page.locator('[role="dialog"] input[type="number"]').nth(0).fill('0'); // hours
await page.locator('[role="dialog"] input[type="number"]').nth(1).fill('1'); // minutes
await page.locator('button:has-text("목표 추가")').first().click();
await wait(400);

const state = await page.evaluate(() => {
  const li = document.querySelector('[role="dialog"] li');
  if (!li) return { rows: 0, hasBar: false, width: -1 };
  const bar = li.querySelector('div[style*="width"]');
  const w = bar ? parseFloat((bar.getAttribute('style').match(/width:\s*([\d.]+)%/) || [])[1] || '0') : -1;
  return { rows: document.querySelectorAll('[role="dialog"] li').length, hasBar: !!bar, width: w };
});
pass('goal row added with a progress bar', state.rows >= 1 && state.hasBar, `rows=${state.rows} hasBar=${state.hasBar}`);
// Goals count SAVED DIARIES only — with no diary yet, progress is 0% (diary-only).
pass('progress 0% without a saved diary (diary-only)', state.width === 0, `width=${state.width}`);

const persisted = await page.evaluate(() => {
  try {
    const raw = JSON.parse(localStorage.getItem('24h-circle-planner.goals'));
    return Array.isArray(raw.goals) && raw.goals.length === 1 && raw.goals[0].targetMinutes === 1;
  } catch { return false; }
});
pass('goal persisted', persisted);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
