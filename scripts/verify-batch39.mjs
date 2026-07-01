/**
 * Batch 39 (offline, dist-single): bottom-right goals viewer.
 *  - No goals → no goals FAB.
 *  - After a goal is set, a Target FAB appears next to the memo FAB; clicking it
 *    opens a card with the goal's live progress bar.
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

// A label that exists in the seeded demo schedule (for a non-zero accumulation).
const label = await page.evaluate(() => {
  try {
    const days = JSON.parse(localStorage.getItem('24h-circle-planner.days')).days;
    const s = days[0].schedule.slices.find((x) => (x.label || '').trim());
    return s ? s.label.trim() : '';
  } catch { return ''; }
});
pass('found a seeded label to target', !!label, `label=${label}`);

// No goals yet → no widget FAB.
const before = await page.locator('button[aria-label="목표/미션"]').count();
pass('no goals → no goals FAB', before === 0, `fab=${before}`);

// Seed one goal (target 1 min → should read as achieved), reload.
await page.evaluate((lbl) => {
  localStorage.setItem('24h-circle-planner.goals', JSON.stringify({ version: 1, goals: [{ id: 'g1', label: lbl, targetMinutes: 1, period: 'day' }] }));
}, label);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await wait(500);

const fab = page.locator('button[aria-label="목표/미션"]').first();
const fabVisible = await fab.isVisible().catch(() => false);
pass('goal set → widget FAB appears (bottom-right)', fabVisible);

await fab.click();
await wait(300);
const goalShown = await page.locator(`text=${label}`).last().isVisible().catch(() => false);
pass('progress card shows the goal', goalShown);
const pctShown = await page.locator('text=100%').first().isVisible().catch(() => false);
pass('progress reads 100% (target met)', pctShown);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
