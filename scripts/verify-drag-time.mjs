/**
 * Verify the boundary-drag time pill: appears during drag, follows the cursor,
 * shows the live (accurate) time, and its on-screen position matches that time.
 * Offline single-file build.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];

// Content-space geometry (must match RING in svg-geometry + viewBox padding).
const VB_MIN = -36, VB_SIZE = 1072;       // viewBox: -36 -36 1072 1072
const CX = 500, CY = 500;                 // content center
const MID_R = (100 + 460) / 2;            // (innerR+outerR)/2 = 280
const PILL_R = MID_R + 50;                // pill radius = 330

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

// Load the 직장인 preset (many boundaries).
let card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
  await page.locator('button:has-text("프리셋")').first().click().catch(() => {});
  await page.waitForTimeout(400);
  card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
}
await card.click();
await page.locator('button:has-text("현재 창에 적용")').first().click().catch(() => {});
await page.waitForTimeout(700);

// Map content (x,y) → screen pixels using the <svg> client box.
const svgBox = await page.locator('svg[role="img"]').first().boundingBox();
const scale = svgBox.width / VB_SIZE; // square viewBox, xMidYMid meet
const toScreen = (cxContent, cyContent) => ({
  x: svgBox.x + (cxContent - VB_MIN) * scale,
  y: svgBox.y + (cyContent - VB_MIN) * scale,
});
const polar = (r, deg) => {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
};
// hhmmToAngle: 00:00 = -90 (top), clockwise.
const hhmmToAngle = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return ((h * 60 + m) / 1440) * 360 - 90;
};
// Screen point on the handle ring for a given time.
const ringScreen = (hhmm) => {
  const p = polar(MID_R, hhmmToAngle(hhmm));
  return toScreen(p.x, p.y);
};

// Grab the FIRST boundary handle (role=slider) at its current screen position.
const handle = page.locator('[role="slider"][aria-label*="경계"]').first();
const hb = await handle.boundingBox();
const grab = { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 };

const readPill = async () => page.evaluate(() => {
  const text = document.querySelector('[data-time-pill-text]');
  const rect = document.querySelector('[data-time-pill-rect]');
  if (!text || !rect) return null;
  const r = rect.getBoundingClientRect();
  return { label: text.textContent, cx: r.x + r.width / 2, cy: r.y + r.height / 2, visible: r.width > 0 };
});

// Start the drag: press on the handle, nudge past the 4px threshold.
await page.mouse.move(grab.x, grab.y);
await page.mouse.down();
await page.mouse.move(grab.x + 8, grab.y + 8, { steps: 3 });
await page.waitForTimeout(80);

// Drag to two distinct target times and sample the pill at each.
const targets = ['03:00', '09:00'];
const samples = [];
for (const tgt of targets) {
  const s = ringScreen(tgt);
  await page.mouse.move(s.x, s.y, { steps: 12 });
  await page.waitForTimeout(120);
  const pill = await readPill();
  // Expected pill-rect center on screen, derived from the time the pill SHOWS.
  let posErrPx = null;
  if (pill && /^\d{2}:\d{2}$/.test(pill.label)) {
    const ang = hhmmToAngle(pill.label === '00:00' ? '00:00' : pill.label);
    const pe = polar(PILL_R, ang);
    const exp = toScreen(pe.x, pe.y);
    posErrPx = Math.hypot(pill.cx - exp.x, pill.cy - exp.y);
  }
  samples.push({ target: tgt, label: pill?.label, visible: pill?.visible, posErrPx });
  if (tgt === '09:00') await page.screenshot({ path: path.join(DIR, 'drag-time.png') });
}

await page.mouse.up();
await page.waitForTimeout(300);
// After release, the boundary commits — pill should disappear (not hovered).
const afterRelease = await readPill();

await browser.close();

console.log('drag samples:', JSON.stringify(samples, null, 2));
console.log('pill after release (null/invisible expected):', JSON.stringify(afterRelease));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const bothVisible = samples.every((s) => s.visible && /^\d{2}:\d{2}$/.test(s.label || ''));
const followed = samples[0].label !== samples[1].label; // time changed as we dragged
const positionsAccurate = samples.every((s) => s.posErrPx !== null && s.posErrPx < 25 * scale + 12);
const ok = bothVisible && followed && positionsAccurate && errors.length === 0;
console.log('bothVisible:', bothVisible, '| followed:', followed, '| positionsAccurate:', positionsAccurate);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
