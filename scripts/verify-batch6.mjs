/**
 * Verifies the 6-item batch (offline single-file, en-US):
 *  #3 Service renamed to "24Houring" (header + document title).
 *  #1 Preset gallery has no "Original" theme chip; loading recolours to a theme.
 *  #2 Deleting a day asks for confirmation.
 *  #5 Day add is capped at 20 (the + is disabled at 20).
 *  #4 The memo button opens a popup: new / show-hide / delete-all (+ confirm).
 *  #6 Slice bodies carry the cut cursor (.slice-cut) and a click splits; the
 *     label is excluded (pointer-events:auto).
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

// ── #3 rename + #1 gallery (first-launch gallery is open) ─────────────────────
const title = await page.title();
const brand = await page.locator('header h1').first().innerText();
const hasOriginalChip = await page.getByRole('button', { name: 'Original', exact: true }).first().isVisible().catch(() => false);
// Load the first preset (now always theme-coloured).
const card = page.locator('button:has(h3)').first();
await card.click();
await page.getByRole('button', { name: 'Apply to current' }).first().click().catch(() => {});
await page.waitForTimeout(700);
const sliceColors = await page.$$eval('svg[role="img"] path[data-slice-id]', (ps) => ps.map((p) => p.getAttribute('fill')));

// ── #6 scissors cut: class + click-to-split ───────────────────────────────────
const cutInfo = await page.evaluate(() => {
  const paths = [...document.querySelectorAll('svg[role="img"] path[data-slice-id]')];
  const withCut = paths.filter((p) => p.classList.contains('slice-cut')).length;
  const cs = paths[0] ? getComputedStyle(paths[0]).cursor : '';
  const label = document.querySelector('g[data-label-kind="inside"]');
  const labelPE = label ? getComputedStyle(label).pointerEvents : 'none';
  return { total: paths.length, withCut, cursorHasUrl: /url\(|crosshair/.test(cs), labelPE };
});
const slicesBeforeCut = sliceColors.length;
// Click a point on the ring (radius 410, angle -45° = inside the first slice),
// away from the centroid label.
const clickPt = await page.evaluate(() => {
  const svg = document.querySelector('svg[role="img"]');
  const r = svg.getBoundingClientRect();
  const VB = { x: -36, y: -36, w: 1072, h: 1072 };
  const cx = 500, cy = 500, rad = 410, a = (-45 * Math.PI) / 180;
  const vx = cx + rad * Math.cos(a), vy = cy + rad * Math.sin(a);
  return { sx: r.left + ((vx - VB.x) / VB.w) * r.width, sy: r.top + ((vy - VB.y) / VB.h) * r.height };
});
await page.mouse.click(clickPt.sx, clickPt.sy);
await page.waitForTimeout(400); // past the 220ms split debounce
const slicesAfterCut = await page.locator('svg[role="img"] path[data-slice-id]').count();
await page.screenshot({ path: path.join(DIR, 'batch6-cut.png') });

// ── #4 memo popup ─────────────────────────────────────────────────────────────
const memoFab = page.locator('button[aria-label="Add memo"]').last();
await memoFab.click();
await page.waitForTimeout(200);
const popupNew = await page.getByRole('button', { name: 'Add memo' }).first().isVisible().catch(() => false);
const popupHide = await page.getByText(/Hide memos|Show memos/).first().isVisible().catch(() => false);
const popupClear = await page.getByRole('button', { name: 'Delete all memos' }).first().isVisible().catch(() => false);
await page.screenshot({ path: path.join(DIR, 'batch6-memo-popup.png') });
// New memo via popup
await page.getByText('Add memo').first().click().catch(() => {});
await page.waitForTimeout(300);
const memoCount = await page.locator('.memo-note').count();
// Delete all via popup → confirm
await memoFab.click();
await page.waitForTimeout(150);
await page.getByRole('button', { name: 'Delete all memos' }).first().click();
await page.waitForTimeout(150);
await page.getByRole('button', { name: 'Delete all', exact: true }).first().click().catch(() => {});
await page.waitForTimeout(250);
const memoCountAfterClear = await page.locator('.memo-note').count();

// ── #2 day delete confirm ─────────────────────────────────────────────────────
await page.getByRole('button', { name: 'Add day' }).first().click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Empty schedule' }).first().click();
await page.waitForTimeout(300);
const thumbsBefore = await page.locator('button[aria-label^="Day "]').count();
await page.locator('button[aria-label="Delete this day"]').last().click({ force: true });
await page.waitForTimeout(200);
const confirmShown = await page.getByText("This day's schedule will be deleted", { exact: false }).isVisible().catch(() => false);
await page.getByRole('button', { name: 'Delete', exact: true }).first().click().catch(() => {});
await page.waitForTimeout(300);
const thumbsAfter = await page.locator('button[aria-label^="Day "]').count();

// ── #5 cap at 20: inject 20 days, reload, check + disabled ────────────────────
await page.evaluate(() => {
  const day = (i) => ({ id: 'd' + i, schedule: { id: 's' + i, version: 1, name: 'D' + i, presetSource: null, updatedAt: new Date().toISOString(), slices: [{ id: 'sl' + i, label: '', startTime: '00:00', endTime: '00:00', color: '#9CA3AF', icon: '', textPosition: 'inside' }] } });
  const days = Array.from({ length: 20 }, (_, i) => day(i));
  localStorage.setItem('24h-circle-planner.days', JSON.stringify({ version: 1, days, activeId: 'd0' }));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.waitForTimeout(400);
const addDisabled = await page.locator('button[aria-label="Add day"]').first().isDisabled().catch(() => false);
const dayThumbsAt20 = await page.locator('button[aria-label^="Day "]').count();

await browser.close();

// ── Report ────────────────────────────────────────────────────────────────────
console.log('#3 title/brand:', JSON.stringify({ title, brand }));
console.log('#1 hasOriginalChip:', hasOriginalChip, '| firstColors:', JSON.stringify(sliceColors.slice(0, 3)));
console.log('#6 cut:', JSON.stringify(cutInfo), '| slices', slicesBeforeCut, '->', slicesAfterCut);
console.log('#4 popup:', JSON.stringify({ popupNew, popupHide, popupClear }), '| memo', memoCount, '-> clear', memoCountAfterClear);
console.log('#2 dayDelete confirm:', confirmShown, '| thumbs', thumbsBefore, '->', thumbsAfter);
console.log('#5 cap:', JSON.stringify({ addDisabled, dayThumbsAt20 }));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const ok3 = title === '24Houring' && /24Houring/.test(brand);
const ok1 = hasOriginalChip === false && sliceColors.length > 0;
const ok6 = cutInfo.withCut === cutInfo.total && cutInfo.total > 0 && cutInfo.labelPE === 'auto' && slicesAfterCut === slicesBeforeCut + 1;
const ok4 = popupNew && popupHide && popupClear && memoCount >= 1 && memoCountAfterClear === 0;
// 2 days → delete one → 1 day, where the strip collapses (thumbnails hidden).
const ok2 = confirmShown && thumbsBefore === 2 && thumbsAfter === 0;
const ok5 = addDisabled === true && dayThumbsAt20 === 20;
console.log(`ok1:${ok1} ok2:${ok2} ok3:${ok3} ok4:${ok4} ok5:${ok5} ok6:${ok6}`);
const ok = ok1 && ok2 && ok3 && ok4 && ok5 && ok6 && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
