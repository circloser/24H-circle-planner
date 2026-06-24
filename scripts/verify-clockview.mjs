/**
 * Verifies the 12h clock-view feature (offline build, en-US):
 *  - a toggle cycles 24h → day(06–18) → night(18–06) → 24h;
 *  - each view relabels the hour ticks for its window (06/18 or 18/06 seam at
 *    the bottom) and clips the slices to the window;
 *  - editing in a 12h view (scissors cut) changes the SAME underlying schedule,
 *    so switching back to 24h shows the edit (linked data);
 *  - round-trip back to 24h preserves the rest; 0 console errors.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
const page = await ctx.newPage();
// Ignore offline-only 404s (absolute /manifest, /icon-*, /favicon) + the
// external AdSense loader; assert on real app errors only.
const IGNORE = /favicon|manifest|icon-\d|pagead|googlesyndication|adsbygoogle|Failed to load resource/i;
page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!IGNORE.test(e.message)) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

// Load a preset so the schedule has several slices. Dismiss the first-visit
// welcome overlay, then open the preset gallery if it isn't already showing.
await page.keyboard.press('Escape').catch(() => {});
let presetCard = page.locator('button:has(h3)').first();
if (!(await presetCard.isVisible({ timeout: 1500 }).catch(() => false))) {
  await page.locator('button[aria-label="Design"]').first().click().catch(() => {}); await page.waitForTimeout(200); await page.getByRole("menuitem", { name: "Presets" }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  presetCard = page.locator('button:has(h3)').first();
}
await presetCard.click();
await page.getByRole('button', { name: 'Apply to current' }).first().click().catch(() => {});
await page.waitForTimeout(500);

const tickLabels = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('svg[role="img"] .hour-ticks text')].map((t) => t.textContent),
  );
const scheduleSliceCount = () =>
  page.evaluate(() => {
    try {
      const raw = localStorage.getItem('24h-circle-planner.schedule');
      const env = JSON.parse(raw);
      const sched = env?.present ?? env?.schedule ?? env;
      return Array.isArray(sched?.slices) ? sched.slices.length : -1;
    } catch { return -1; }
  });
const toggle = () => page.getByRole('button', { name: /Switch view/ }).first();
// SVG x-coordinate (user units, cx=500) of a seam hour label, by its text.
const seamLabelX = (txt) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll('svg[role="img"] .hour-ticks text')].find(
      (n) => n.textContent === t,
    );
    return el ? parseFloat(el.getAttribute('x')) : null;
  }, txt);

// ── 24h baseline ──────────────────────────────────────────────────────────
const fullLabels = await tickLabels();
const fullCount = await scheduleSliceCount();
await page.screenshot({ path: path.join(DIR, 'clock-24h.png') });

// ── → day (06–18) ────────────────────────────────────────────────────────
await toggle().click();
await page.waitForTimeout(300);
const dayLabels = await tickLabels();
const daySlicePaths = await page.locator('svg[role="img"] path[data-slice-id]').count();
const day06x = await seamLabelX('06');
const day18x = await seamLabelX('18');
await page.screenshot({ path: path.join(DIR, 'clock-day.png') });

// Edit in the day view: a scissors cut on the band (~10:00) splits the slice.
const dayTarget = await page.evaluate(() => {
  const svg = document.querySelector('svg[role="img"]');
  const ctm = svg.getScreenCTM();
  const pt = svg.createSVGPoint();
  // 10:00 in day view → angle 90 + ((600-360)/720)*360 = 210°, on the band (r=280)
  const rad = (210 * Math.PI) / 180;
  pt.x = 500 + 280 * Math.cos(rad);
  pt.y = 500 + 280 * Math.sin(rad);
  const s = pt.matrixTransform(ctm);
  return { x: s.x, y: s.y };
});
await page.mouse.click(dayTarget.x, dayTarget.y);
await page.waitForTimeout(1300); // outlast the 220ms split timer + persistence debounce
const afterCutCount = await scheduleSliceCount();

// ── → night (18–06) ──────────────────────────────────────────────────────
await toggle().click();
await page.waitForTimeout(300);
const nightLabels = await tickLabels();
const night18x = await seamLabelX('18');
const night06x = await seamLabelX('06');
await page.screenshot({ path: path.join(DIR, 'clock-night.png') });

// ── → back to 24h ────────────────────────────────────────────────────────
await toggle().click();
await page.waitForTimeout(300);
const backLabels = await tickLabels();
const backCount = await scheduleSliceCount();
await page.screenshot({ path: path.join(DIR, 'clock-back24h.png') });

await browser.close();

const has = (arr, v) => arr.includes(v);
console.log('full labels:', fullLabels.join(','));
console.log('day labels :', dayLabels.join(','));
console.log('night labels:', nightLabels.join(','));
console.log('seam x: day 06=', day06x, '18=', day18x, '| night 18=', night18x, '06=', night06x, '(cx=500)');
console.log('counts: full', fullCount, '→ afterCut', afterCutCount, '→ back', backCount, '| daySlicePaths', daySlicePaths);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const checks = {
  fullHas00and23: has(fullLabels, '00') && has(fullLabels, '23'),
  dayWindow: has(dayLabels, '06') && has(dayLabels, '12') && has(dayLabels, '18') && !has(dayLabels, '23') && !has(dayLabels, '00'),
  nightWindow: has(nightLabels, '18') && has(nightLabels, '00') && has(nightLabels, '06') && !has(nightLabels, '12'),
  daySlicesRendered: daySlicePaths > 0,
  daySeamOrder: day06x < 500 && day18x > 500, // 06 left, 18 right of the bottom seam
  nightSeamOrder: night18x < 500 && night06x > 500, // 18 left, 06 right of the bottom seam
  cutChangedSharedData: afterCutCount === fullCount + 1, // edit in day view added a slice
  back24hReflectsEdit: backLabels.length === 24 && backCount === fullCount + 1,
  noErrors: errors.length === 0,
};
console.log('checks:', JSON.stringify(checks, null, 0));
const ok = Object.values(checks).every(Boolean);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
