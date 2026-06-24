/**
 * Verifies (offline single-file build, en-US locale):
 *  #1 Export "Transparent background" toggle is visibly coloured + scroll-safe gallery.
 *  #2 "Save as preset" → appears in gallery "My presets" + delete; gallery not clipped.
 *  #3 Multi-day:
 *     - one day → NO thumbnail, a single faded + , NO "Day x of y" indicator;
 *     - + opens a dialog (Duplicate current / Empty schedule);
 *     - "Empty" adds an empty day → 2 thumbnails + "Day 2 of 2";
 *     - switching restores content; "Duplicate" clones the active day's slices;
 *     - deleting back to one day removes thumbnails + indicator again.
 *  #4 Settings → Background → Gradient applies a visible gradient to the body.
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

const thumbCount = () => page.locator('button[aria-label^="Day "]').count();
const indicatorText = () => page.getByText(/Day \d+ of \d+/).first().textContent().catch(() => '');
const addDay = page.getByRole('button', { name: 'Add day' }).first();
const mainSlices = () => page.locator('svg[role="img"] path[data-slice-id]').count();

// Load a preset so day 1 has content.
const card = page.locator('button:has(h3)').first();
if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
  await card.click();
  await page.getByRole('button', { name: 'Apply to current' }).first().click().catch(() => {});
}
await page.waitForTimeout(600);

// ── #3a One-day state: no thumbnail, faded +, no indicator ─────────────────────
const oneDay = {
  thumbs: await thumbCount(),
  addOpacity: await addDay.evaluate((el) => getComputedStyle(el).opacity).catch(() => '1'),
  indicator: await indicatorText(),
};

// ── #1 Transparent toggle visibility ──────────────────────────────────────────
await page.getByRole('button', { name: 'Export' }).first().click();
await page.waitForTimeout(500);
const toggle = page.getByRole('switch').first();
const offBg = await toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
await toggle.click();
await page.waitForTimeout(150);
const onBg = await toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
const isTransparent = (c) => !c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(200);
const toggleOk = !isTransparent(offBg) && !isTransparent(onBg) && offBg !== onBg;

// ── #2 Save as preset → gallery section + delete + not clipped ────────────────
await page.getByRole('button', { name: 'My Schedules' }).first().click();
await page.waitForTimeout(150);
await page.getByRole('menuitem', { name: 'Save as preset' }).first().click();
await page.waitForTimeout(200);
await page.getByRole('textbox').first().fill('Trip Day Template');
await page.getByRole('button', { name: 'Save' }).first().click();
await page.waitForTimeout(300);
await page.locator('button[aria-label="Design"]').first().click().catch(() => {}); await page.waitForTimeout(200); await page.getByRole("menuitem", { name: "Presets" }).first().click().catch(() => {});
await page.waitForTimeout(400);
const myPresetsShown = await page.getByText('My presets', { exact: false }).first().isVisible().catch(() => false);
const savedCard = await page.getByRole('heading', { name: 'Trip Day Template' }).first().isVisible().catch(() => false);
const galleryBox = await page.evaluate(() => {
  const els = [...document.querySelectorAll('[role="dialog"][data-state="open"]')];
  const el = els[els.length - 1];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return { top: r.top, bottom: r.bottom, ih: window.innerHeight, overflowY: cs.overflowY };
});
const galleryOk = !!galleryBox && galleryBox.top >= -1 && galleryBox.bottom <= galleryBox.ih + 1 && galleryBox.overflowY === 'auto';
const delBtn = page.getByRole('button', { name: 'Delete preset' }).first();
const hadDelete = await delBtn.isVisible().catch(() => false);
if (hadDelete) await delBtn.click();
await page.waitForTimeout(200);
const afterDelete = await page.getByRole('heading', { name: 'Trip Day Template' }).first().isVisible().catch(() => false);
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(200);
const presetOk = myPresetsShown && savedCard && hadDelete && afterDelete === false;

// ── #3b Add (Empty) → 2 days, thumbnails + indicator ──────────────────────────
await addDay.click();
await page.waitForTimeout(250);
const dialogShown = await page.getByText('How should the new day start?').first().isVisible().catch(() => false);
await page.getByRole('button', { name: 'Empty schedule' }).first().click();
await page.waitForTimeout(300);
const afterEmpty = { thumbs: await thumbCount(), indicator: await indicatorText(), slices: await mainSlices() };
await page.screenshot({ path: path.join(DIR, 'days2-strip.png') });

// Switch to Day 1 → preset content restored.
await page.locator('button[aria-label="Day 1"]').first().click();
await page.waitForTimeout(300);
const day1 = { indicator: await indicatorText(), slices: await mainSlices() };

// ── #3c Add (Duplicate) → clones active (Day 1) ───────────────────────────────
await addDay.click();
await page.waitForTimeout(250);
await page.getByRole('button', { name: 'Duplicate current' }).first().click();
await page.waitForTimeout(300);
const afterDup = { thumbs: await thumbCount(), indicator: await indicatorText(), slices: await mainSlices() };

// ── #3d Delete back down to one day → strip collapses ─────────────────────────
let guard = 0;
while ((await thumbCount()) > 1 && guard++ < 6) {
  await page.locator('button[aria-label="Delete this day"]').last().click({ force: true });
  await page.waitForTimeout(200);
}
const backToOne = { thumbs: await thumbCount(), indicator: await indicatorText() };

// ── #4 Gradient background ────────────────────────────────────────────────────
await page.evaluate(() => {
  localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({
    version: 1, prefs: { background: 'gradient', bgType: 'pattern' },
  }));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.waitForTimeout(400);
const gradient = await page.evaluate(() => ({
  attr: document.documentElement.getAttribute('data-bg'),
  bgImage: getComputedStyle(document.body).backgroundImage,
}));
await page.screenshot({ path: path.join(DIR, 'bg-gradient.png') });

await browser.close();

console.log('#3a oneDay:', JSON.stringify(oneDay));
console.log('#1 toggle:', JSON.stringify({ offBg, onBg, toggleOk }));
console.log('#2 preset:', JSON.stringify({ presetOk, galleryOk, galleryBox }));
console.log('#3b dialogShown:', dialogShown, 'afterEmpty:', JSON.stringify(afterEmpty));
console.log('#3 day1:', JSON.stringify(day1), 'afterDup:', JSON.stringify(afterDup), 'backToOne:', JSON.stringify(backToOne));
console.log('#4 gradient:', JSON.stringify(gradient));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const oneDayOk = oneDay.thumbs === 0 && parseFloat(oneDay.addOpacity) < 0.9 && !/Day \d+ of \d+/.test(oneDay.indicator || '');
const daysOk =
  dialogShown &&
  afterEmpty.thumbs === 2 && /Day 2 of 2/.test(afterEmpty.indicator || '') && afterEmpty.slices === 1 &&
  /Day 1 of 2/.test(day1.indicator || '') && day1.slices > 1 &&
  afterDup.thumbs === 3 && /Day 3 of 3/.test(afterDup.indicator || '') && afterDup.slices === day1.slices &&
  backToOne.thumbs === 0 && !/Day \d+ of \d+/.test(backToOne.indicator || '');
const gradientOk = gradient.attr === 'gradient' && /linear-gradient/.test(gradient.bgImage) && gradient.bgImage !== 'none';

console.log(`oneDayOk:${oneDayOk} toggleOk:${toggleOk} presetOk:${presetOk} galleryOk:${galleryOk} daysOk:${daysOk} gradientOk:${gradientOk}`);
const ok = oneDayOk && toggleOk && presetOk && galleryOk && daysOk && gradientOk && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
