/**
 * Batch 20 verification (offline, dist-single): timetable diary.
 *  - "오늘 저장" snapshots the current schedule under today; the day shows a
 *    mini-chart (saved ≠ unsaved). Persists across reload. Tapping it loads it.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 1000 } });
const page = await ctx.newPage();
await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});

let card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
if (!(await card.isVisible({ timeout: 2000 }).catch(() => false))) {
  await page.locator('button[aria-label="디자인"]').first().click().catch(() => {}); await page.waitForTimeout(200); await page.locator('[role="menuitem"]:has-text("프리셋")').first().click().catch(() => {});
  await wait(300);
  card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
}
await card.click().catch(() => {});
await page.locator('button:has-text("현재 창에 적용")').first().click().catch(() => {});
await wait(600);

async function openDiary() {
  await page.locator('button[aria-label="내 시간표"]').first().click();
  await wait(250);
  await page.locator('[role="menuitem"]:has-text("일기")').first().click();
  await wait(350);
}

await openDiary();
await page.locator('[role="dialog"] button:has-text("오늘 저장")').first().click();
await wait(400);
const savedCells = await page.locator('[role="dialog"] .grid button:has(svg)').count();
const stored = await page.evaluate(() => {
  try { return Object.keys(JSON.parse(localStorage.getItem('24h-circle-planner.diary')).entries).length; } catch { return -1; }
});
pass('save today creates a diary entry', stored === 1, `stored=${stored}`);
pass('saved day shows a mini-chart', savedCells >= 1, `savedCells=${savedCells}`);
await page.keyboard.press('Escape').catch(() => {});
await wait(200);

// Persist across reload.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);
await openDiary();
const afterReload = await page.locator('[role="dialog"] .grid button:has(svg)').count();
pass('diary persists across reload', afterReload >= 1, `cells=${afterReload}`);

// Tapping a saved day loads it (dialog closes, chart populated).
await page.locator('[role="dialog"] .grid button:has(svg)').first().click();
await wait(400);
const closed = !(await page.locator('[role="dialog"]:has-text("시간표 일기")').first().isVisible().catch(() => false));
const slices = await page.locator('svg[role="img"] path[data-slice-id]').count();
pass('tapping a saved day loads it', closed && slices > 1, `closed=${closed} slices=${slices}`);

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
