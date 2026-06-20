/**
 * Verify:
 *  1. Splitting a slice gives the new cell a SIBLING colour (same hue family as
 *     its parent), not a contrasting one.
 *  2. The center hub title is shown in full (wrapped), not hard-truncated to "…".
 * Offline single-file build, 직장인 preset (original colours).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];
const VB_MIN = -36, VB_SIZE = 1072, CX = 500, CY = 500, MID_R = 280;
const PARENT = [147, 197, 253]; // #93c5fd, the colour of 오전 업무

const hhmmToAngle = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return ((h * 60 + m) / 1440) * 360 - 90;
};
const hexToRgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

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

// ── 2. Hub title shown in full ────────────────────────────────────────────────
const titleText = await page.evaluate(() => {
  const t = [...document.querySelectorAll('main svg[role="img"] text')]
    .find((el) => (el.textContent || '').includes('직장인'));
  return t ? t.textContent.replace(/\s+/g, ' ').trim() : null;
});

// ── 1. Sibling colour on split ────────────────────────────────────────────────
const readFills = () => page.evaluate(() =>
  [...document.querySelectorAll('main svg[role="img"] [data-slice-id]')].map((p) => p.getAttribute('fill')));
const beforeFills = await readFills();

// Hover boundary at 12:00 (오전 업무 | 점심) and click the left "+" (splits 오전 업무).
const svgBox = await page.locator('svg[role="img"]').first().boundingBox();
const scale = svgBox.width / VB_SIZE;
const rad = (hhmmToAngle('12:00') * Math.PI) / 180;
const sx = svgBox.x + (CX + MID_R * Math.cos(rad) - VB_MIN) * scale;
const sy = svgBox.y + (CY + MID_R * Math.sin(rad) - VB_MIN) * scale;
await page.mouse.move(sx, sy);
await page.waitForTimeout(300);
await page.locator('[aria-label="왼쪽 칸에 일정 추가"]').first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(DIR, 'similar-title.png') });

const afterFills = await readFills();
const newColors = afterFills.filter((c) => !beforeFills.includes(c));

await browser.close();

console.log('hub title text:', JSON.stringify(titleText));
console.log('new slice colour(s) after split:', JSON.stringify(newColors));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const titleOk = titleText === '직장인 9 to 6'; // full, no ellipsis
let siblingOk = false;
if (newColors.length >= 1) {
  const [r, g, b] = hexToRgb(newColors[0]);
  const dist = Math.hypot(r - PARENT[0], g - PARENT[1], b - PARENT[2]);
  const blueDominant = b >= r && b >= g; // same (blue) hue family as #93c5fd
  siblingOk = blueDominant && dist > 0 && dist < 170;
  console.log(`new colour rgb=(${r},${g},${b}) dist-to-parent=${dist.toFixed(0)} blueDominant=${blueDominant}`);
}
console.log('titleOk:', titleOk, '| siblingOk:', siblingOk);
const ok = titleOk && siblingOk && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
