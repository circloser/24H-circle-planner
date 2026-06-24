/**
 * Batch 17 verification (offline, dist-single): first-visit onboarding.
 *  - First visit: a DEMO schedule is pre-loaded (circle not empty) AND a
 *    non-blocking welcome card with the value prop + gesture guide is shown.
 *  - The welcome is non-blocking (the page stays interactive) and Escape /
 *    "직접 편집" dismisses it, leaving the editable demo.
 *  - Genuinely empty schedule → an empty-state hero CTA appears (no welcome).
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });

// ── A. First visit: demo + welcome, welcome is non-blocking & dismissable ─────
{
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
  await wait(800);

  const welcomeShown = await page.locator('[role="dialog"]:has-text("원형 시간표")').first().isVisible().catch(() => false);
  const demoSlices = await page.locator('svg[role="img"] path[data-slice-id]').count();
  pass('A first-visit shows welcome', welcomeShown);
  pass('A demo schedule pre-loaded (circle not empty)', demoSlices >= 6, `slices=${demoSlices}`);

  // Non-blocking: the header (settings) is clickable WHILE the welcome is up.
  await page.locator('button[aria-label="설정"]').first().click({ timeout: 4000 }).catch(() => {});
  const menuReachable = await page.locator('[role="menu"]').first().isVisible().catch(() => false);
  pass('A welcome is non-blocking (header reachable)', menuReachable);
  await page.keyboard.press('Escape').catch(() => {}); // close menu

  // Escape dismisses the welcome; demo remains.
  await page.keyboard.press('Escape').catch(() => {});
  await wait(300);
  const welcomeGone = !(await page.locator('[role="dialog"]:has-text("원형 시간표")').first().isVisible().catch(() => false));
  const stillHasDemo = (await page.locator('svg[role="img"] path[data-slice-id]').count()) >= 6;
  pass('A Escape dismisses welcome, demo stays', welcomeGone && stillHasDemo, `gone=${welcomeGone} demo=${stillHasDemo}`);
}

// ── B. Empty state hero (pre-seed empty schedule + onboarded flag) ────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('24h-circle-planner.onboarded', '1');
    const empty = {
      version: 1,
      days: [{ id: 'd1', schedule: { id: 's1', version: 1, name: '내 시간표', presetSource: null, updatedAt: '2026-01-01T00:00:00.000Z', slices: [{ id: 'sl1', label: '', startTime: '00:00', endTime: '24:00', color: '#e5e7eb', icon: '', textPosition: 'inside' }] } }],
      activeId: 'd1',
    };
    localStorage.setItem('24h-circle-planner.days', JSON.stringify(empty));
  });
  const page = await ctx.newPage();
  await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
  await wait(700);
  const heroShown = await page.locator('text=프리셋으로 30초 만에 시작').first().isVisible().catch(() => false);
  const noWelcome = !(await page.locator('[role="dialog"]:has-text("원형 시간표")').first().isVisible().catch(() => false));
  pass('B empty-state hero shown', heroShown);
  pass('B no welcome for returning user', noWelcome);
  await ctx.close();
}

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
