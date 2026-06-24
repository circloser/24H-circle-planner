/**
 * Verify three polish changes:
 *  1. Slice labels follow a boundary drag (transform re-anchors live).
 *  2. Pretendard (default font) is actually loaded in the offline single-file.
 *  3. A color theme recolours all slices.
 * Offline single-file build, 직장인 preset.
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
const OCEAN = ['#bae6fd', '#7dd3fc', '#38bdf8', '#5eead4', '#2dd4bf', '#99f6e4', '#a5f3fc', '#67e8f9', '#93c5fd', '#818cf8'];

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
  await page.locator('button[aria-label="디자인"]').first().click().catch(() => {}); await page.waitForTimeout(200); await page.locator('[role="menuitem"]:has-text("프리셋")').first().click().catch(() => {});
  await page.waitForTimeout(300);
  card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
}
await card.click();
await page.locator('button:has-text("현재 창에 적용")').first().click().catch(() => {});
await page.waitForTimeout(700);

// ── 2. Pretendard loaded offline ──────────────────────────────────────────────
const pretendardLoaded = await page.evaluate(async () => {
  await document.fonts.ready;
  return [...document.fonts].some((f) => f.family === 'Pretendard' && f.status === 'loaded');
});

// ── 1. Labels follow a boundary drag ─────────────────────────────────────────
const getLabelTransform = (needle) => page.evaluate((n) => {
  const g = [...document.querySelectorAll('svg[role="img"] [data-label-id]')]
    .find((el) => (el.textContent || '').includes(n));
  return g ? g.getAttribute('transform') : null;
}, needle);

const svgBox = await page.locator('svg[role="img"]').first().boundingBox();
const scale = svgBox.width / VB_SIZE;
const ringScreen = (hhmm) => {
  const rad = (hhmmToAngle(hhmm) * Math.PI) / 180;
  return {
    x: svgBox.x + (CX + MID_R * Math.cos(rad) - VB_MIN) * scale,
    y: svgBox.y + (CY + MID_R * Math.sin(rad) - VB_MIN) * scale,
  };
};

const tBefore = await getLabelTransform('오전 업무');
const start = ringScreen('09:00');
const target = ringScreen('10:30');
await page.mouse.move(start.x, start.y);
await page.mouse.down();
await page.mouse.move(target.x, target.y, { steps: 14 });
await page.waitForTimeout(150);
const tDuring = await getLabelTransform('오전 업무');
const ccwDuring = await getLabelTransform('출근');
await page.screenshot({ path: path.join(DIR, 'polish-drag-labels.png') });
await page.mouse.up();
await page.waitForTimeout(300);

// ── 3. Color theme recolours slices ──────────────────────────────────────────
const readFills = () => page.evaluate(() =>
  [...document.querySelectorAll('svg[role="img"] [data-slice-id]')].map((p) => p.getAttribute('fill')));
const fillsBefore = await readFills();
await page.locator('button[aria-label="설정"]').first().click();
await page.waitForTimeout(300);
await page.locator('[role="dialog"] button:has-text("바다")').first().click();
await page.waitForTimeout(250);
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
const fillsAfter = await readFills();
await page.screenshot({ path: path.join(DIR, 'polish-theme.png') });

await browser.close();

console.log('Pretendard loaded offline:', pretendardLoaded);
console.log(`label 오전 업무 transform: before=${tBefore} during=${tDuring}`);
console.log(`label 출근 transform during drag: ${ccwDuring}`);
console.log('slice fills before:', JSON.stringify(fillsBefore));
console.log('slice fills after :', JSON.stringify(fillsAfter));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const labelsFollow = !!tBefore && !!tDuring && tDuring !== tBefore && !!ccwDuring;
const themeOk = fillsAfter.length > 0 &&
  JSON.stringify(fillsAfter) !== JSON.stringify(fillsBefore) &&
  fillsAfter.every((c, i) => c?.toLowerCase() === OCEAN[i % OCEAN.length]);
console.log('labelsFollow:', labelsFollow, '| pretendardLoaded:', pretendardLoaded, '| themeOk:', themeOk);
const ok = labelsFollow && pretendardLoaded && themeOk && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
