/**
 * Verify the "+" affordance: on BOTH sides of a boundary, pressing "+" creates a
 * new empty cell ADJACENT to the boundary and pushes the existing content away.
 * Measured via the content label's centroid angle moving away from the boundary.
 * Offline single-file build, 직장인 preset (boundary at 09:00 = 출근 | 오전 업무).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];

const VB_MIN = -36, VB_SIZE = 1072, CX = 500, CY = 500, MID_R = 280;
const hhmmToAngle = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return ((h * 60 + m) / 1440) * 360 - 90;
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });

// Read the centroid angle (deg, content coords) of the slice label containing `needle`.
const labelAngle = (page, needle) => page.evaluate((n) => {
  const texts = [...document.querySelectorAll('svg[role="img"] text')];
  const el = texts.find((t) => (t.textContent || '').includes(n));
  if (!el) return null;
  const x = parseFloat(el.getAttribute('x'));
  const y = parseFloat(el.getAttribute('y'));
  return (Math.atan2(y - 500, x - 500) * 180) / Math.PI;
}, needle);

async function loadPresetAndHoverBoundary(page, boundaryHhmm) {
  await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg', { timeout: 15000 });
  // First-launch gallery is already open; pick 직장인 directly.
  let card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
  if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.locator('button:has-text("프리셋")').first().click().catch(() => {});
    await page.waitForTimeout(300);
    card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
  }
  await card.click();
  await page.locator('button:has-text("현재 창에 적용")').first().click().catch(() => {});
  await page.waitForTimeout(600);

  // Hover the boundary handle to reveal the +/- affordances.
  const svgBox = await page.locator('svg[role="img"]').first().boundingBox();
  const scale = svgBox.width / VB_SIZE;
  const rad = (hhmmToAngle(boundaryHhmm) * Math.PI) / 180;
  const cxC = CX + MID_R * Math.cos(rad);
  const cyC = CY + MID_R * Math.sin(rad);
  const sx = svgBox.x + (cxC - VB_MIN) * scale;
  const sy = svgBox.y + (cyC - VB_MIN) * scale;
  await page.mouse.move(sx, sy);
  await page.waitForTimeout(250);
}

// ── Right "+" : CW content (오전 업무) should move CW (angle increases) ──────────
const pageR = await ctx.newPage();
pageR.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('R: ' + e.message); });
await loadPresetAndHoverBoundary(pageR, '09:00');
const rBefore = await labelAngle(pageR, '오전 업무');
await pageR.locator('[aria-label="오른쪽 칸에 일정 추가"]').first().click();
await pageR.waitForTimeout(400);
const rAfter = await labelAngle(pageR, '오전 업무');
await pageR.screenshot({ path: path.join(DIR, 'plus-right.png') });

// ── Left "+" : CCW content (오전 업무) should move CCW (angle decreases) ─────────
// Use boundary 12:00 (CCW = 오전 업무, 180 min) so the content half stays wide
// enough (90 min) to keep rendering its text label after the split.
const pageL = await ctx.newPage();
pageL.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('L: ' + e.message); });
await loadPresetAndHoverBoundary(pageL, '12:00');
const lBefore = await labelAngle(pageL, '오전 업무');
await pageL.locator('[aria-label="왼쪽 칸에 일정 추가"]').first().click();
await pageL.waitForTimeout(400);
const lAfter = await labelAngle(pageL, '오전 업무');
await pageL.screenshot({ path: path.join(DIR, 'plus-left.png') });

await browser.close();

console.log(`right "+": 오전 업무 angle ${rBefore?.toFixed(1)} -> ${rAfter?.toFixed(1)} (expect increase)`);
console.log(`left  "+": 오전 업무 angle ${lBefore?.toFixed(1)} -> ${lAfter?.toFixed(1)} (expect decrease)`);
console.log('errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const rightOk = rBefore != null && rAfter != null && rAfter > rBefore + 3;
const leftOk = lBefore != null && lAfter != null && lAfter < lBefore - 3;
console.log('rightOk (empty adjacent, content pushed CW):', rightOk);
console.log('leftOk  (empty adjacent, content pushed CCW):', leftOk);
const ok = rightOk && leftOk && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
