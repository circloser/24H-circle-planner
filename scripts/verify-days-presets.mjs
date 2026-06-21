/**
 * Verifies (offline single-file build, en-US locale):
 *  #1 Export "Transparent background" toggle is visibly coloured (not transparent),
 *     and its colour changes when toggled.
 *  #2 "Save as preset" stores the current schedule; it appears in the gallery's
 *     "My presets" section and can be deleted.
 *  #3 Multi-day: day strip shows a thumbnail + add (+); adding a day updates the
 *     "Day M of N" indicator and switches active; switching restores content;
 *     deleting reduces the count; state persists across reload.
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
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

// Load a preset so the schedule has content.
const card = page.locator('button:has(h3)').first();
if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
  await card.click();
  await page.getByRole('button', { name: 'Apply to current' }).first().click().catch(() => {});
}
await page.waitForTimeout(600);

// ── #1 Transparent toggle visibility ──────────────────────────────────────────
await page.getByRole('button', { name: 'Export' }).first().click();
await page.waitForTimeout(500);
const toggle = page.getByRole('switch').first();
const offBg = await toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
await toggle.click();
await page.waitForTimeout(150);
const onBg = await toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
const isTransparent = (c) => !c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
await page.screenshot({ path: path.join(DIR, 'export-toggle.png') });
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(200);
const toggleOk = !isTransparent(offBg) && !isTransparent(onBg) && offBg !== onBg;

// ── #2 Save as preset → appears in gallery → delete ───────────────────────────
await page.getByRole('button', { name: 'My Schedules' }).first().click();
await page.waitForTimeout(150);
await page.getByRole('menuitem', { name: 'Save as preset' }).first().click();
await page.waitForTimeout(200);
await page.getByRole('textbox').first().fill('Trip Day Template');
await page.getByRole('button', { name: 'Save' }).first().click();
await page.waitForTimeout(300);
// Open the gallery and look for the My presets section + saved card.
await page.getByRole('button', { name: 'Presets' }).first().click();
await page.waitForTimeout(400);
const myPresetsShown = await page.getByText('My presets', { exact: false }).first().isVisible().catch(() => false);
const savedCard = await page.getByRole('heading', { name: 'Trip Day Template' }).first().isVisible().catch(() => false);
// #2b: the gallery dialog must fit the viewport (not clipped) and be scrollable.
const galleryBox = await page.evaluate(() => {
  // Dialog content is position:fixed (offsetParent === null), so select the
  // open one by Radix's data-state instead.
  const els = [...document.querySelectorAll('[role="dialog"][data-state="open"]')];
  const el = els[els.length - 1];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return { top: r.top, bottom: r.bottom, ih: window.innerHeight, overflowY: cs.overflowY, scrollH: el.scrollHeight, clientH: el.clientHeight };
});
const galleryOk = !!galleryBox && galleryBox.top >= -1 && galleryBox.bottom <= galleryBox.ih + 1 && galleryBox.overflowY === 'auto';
const delBtn = page.getByRole('button', { name: 'Delete preset' }).first();
const hadDelete = await delBtn.isVisible().catch(() => false);
await page.screenshot({ path: path.join(DIR, 'gallery-mypresets.png') });
if (hadDelete) await delBtn.click();
await page.waitForTimeout(200);
const afterDelete = await page.getByRole('heading', { name: 'Trip Day Template' }).first().isVisible().catch(() => false);
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(200);
const presetOk = myPresetsShown && savedCard && hadDelete && afterDelete === false;

// ── #3 Multi-day strip ────────────────────────────────────────────────────────
const thumbCount = () => page.locator('button[aria-label^="Day "]').count();
const initialThumbs = await thumbCount();
const indicator0 = await page.getByText(/Day \d+ of \d+/).first().textContent().catch(() => '');
// Add a day.
await page.getByRole('button', { name: 'Add day' }).first().click();
await page.waitForTimeout(300);
const afterAddThumbs = await thumbCount();
const indicator1 = await page.getByText(/Day \d+ of \d+/).first().textContent().catch(() => '');
await page.screenshot({ path: path.join(DIR, 'days-strip.png') });
// Switch back to day 1.
await page.locator('button[aria-label="Day 1"]').first().click();
await page.waitForTimeout(300);
const indicator2 = await page.getByText(/Day \d+ of \d+/).first().textContent().catch(() => '');
const day1Slices = await page.locator('svg[role="img"] path[data-slice-id]').count();
// Delete day 2.
const delDay = page.locator('button[aria-label="Delete this day"]');
const delCount = await delDay.count();
await delDay.last().click({ force: true });
await page.waitForTimeout(300);
const afterDelThumbs = await thumbCount();
// #1: with a single day left, no delete affordance should exist.
const delAtOne = await page.locator('button[aria-label="Delete this day"]').count();

// Persistence across reload.
const storedDays = await page.evaluate(() => {
  try {
    const env = JSON.parse(localStorage.getItem('24h-circle-planner.days') || '{}');
    return Array.isArray(env.days) ? env.days.length : -1;
  } catch { return -1; }
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.waitForTimeout(500);
const thumbsAfterReload = await thumbCount();

await browser.close();

console.log('#1 toggle:', JSON.stringify({ offBg, onBg, toggleOk }));
console.log('#2 preset:', JSON.stringify({ myPresetsShown, savedCard, hadDelete, afterDelete, presetOk }));
console.log('#2b gallery box:', JSON.stringify(galleryBox), 'galleryOk:', galleryOk);
console.log('#3 days:', JSON.stringify({
  initialThumbs, indicator0, afterAddThumbs, indicator1, indicator2, day1Slices,
  delCount, afterDelThumbs, delAtOne, storedDays, thumbsAfterReload,
}));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const daysOk =
  initialThumbs === 1 &&
  afterAddThumbs === 2 &&
  /Day 2 of 2/.test(indicator1 || '') &&
  /Day 1 of 2/.test(indicator2 || '') &&
  day1Slices > 1 &&
  afterDelThumbs === 1 &&
  delAtOne === 0 &&
  storedDays === 1 &&
  thumbsAfterReload === 1;

console.log(`toggleOk:${toggleOk} presetOk:${presetOk} galleryOk:${galleryOk} daysOk:${daysOk}`);
const ok = toggleOk && presetOk && galleryOk && daysOk && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
