/**
 * Batch 19 verification (offline, dist-single): weekly time analytics.
 *  - "시간 분석" shows the daily-average split (sleep/work/meal/leisure/commute)
 *    with bars, and a per-day trend strip once there are 2+ days.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1000, height: 1000 } })).newPage();
await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});

// Load 직장인 preset.
let card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
if (!(await card.isVisible({ timeout: 2000 }).catch(() => false))) {
  await page.locator('button:has-text("프리셋")').first().click().catch(() => {});
  await wait(300);
  card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
}
await card.click().catch(() => {});
await page.locator('button:has-text("현재 창에 적용")').first().click().catch(() => {});
await wait(600);

// Add a 2nd day (duplicate) → enables the trend strip.
await page.locator('button[aria-label="날짜 추가"]').first().click().catch(() => {});
await wait(300);
await page.locator('[role="dialog"] button:has-text("현재 시간표 복제")').first().click().catch(() => {});
await wait(500);

// Open the analysis dialog.
await page.locator('button[aria-label="설정"]').first().click();
await wait(300);
await page.locator('[role="menuitem"]:has-text("시간 분석")').first().click();
await wait(400);

const info = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => (d.textContent || '').includes('시간 분석'));
  if (!dlg) return null;
  const txt = dlg.textContent || '';
  return {
    sleep: txt.includes('수면'),
    work: txt.includes('업무·학업'),
    leisure: txt.includes('여가'),
    trend: txt.includes('일별 추세'),
    twoDays: txt.includes('2일 기준'),
    bars: dlg.querySelectorAll('.rounded-full > .rounded-full').length, // category fill bars
  };
});
pass('analytics dialog opens', info !== null);
pass('shows sleep / work / leisure categories', !!info && info.sleep && info.work && info.leisure, JSON.stringify(info));
pass('shows category bars', !!info && info.bars >= 4, `bars=${info?.bars}`);
pass('shows per-day trend (2 days)', !!info && info.trend && info.twoDays);

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
