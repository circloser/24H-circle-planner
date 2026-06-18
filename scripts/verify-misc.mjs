/**
 * Verify:
 *  1. Affordances appear when hovering anywhere NEAR a division line (not only
 *     the center dot).
 *  2. Theme toggle cycles light↔dark only (never "system").
 *  3. Post-it memo: add button creates a yellow note with a folded corner;
 *     colour can be changed.
 * Offline single-file build, 직장인 preset.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];
const VB_MIN = -36, VB_SIZE = 1072, CX = 500, CY = 500;
const hhmmToAngle = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return ((h * 60 + m) / 1440) * 360 - 90; };

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg', { timeout: 15000 });
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

// ── 1. Hover near the division line (radius 400, far from the midR=280 dot) ────
const svgBox = await page.locator('svg[role="img"]').first().boundingBox();
const scale = svgBox.width / VB_SIZE;
const ptAt = (radius, hhmm) => {
  const rad = (hhmmToAngle(hhmm) * Math.PI) / 180;
  return {
    x: svgBox.x + (CX + radius * Math.cos(rad) - VB_MIN) * scale,
    y: svgBox.y + (CY + radius * Math.sin(rad) - VB_MIN) * scale,
  };
};
await page.mouse.move(svgBox.x + 10, svgBox.y + 10); // neutral
await page.waitForTimeout(150);
const affBefore = await page.locator('svg .boundary-affordances').count();
const near = ptAt(400, '09:00'); // on the 09:00 line, near the rim (far from the dot)
await page.mouse.move(near.x, near.y);
await page.waitForTimeout(200);
const affNearLine = await page.locator('svg .boundary-affordances').count();
await page.screenshot({ path: path.join(DIR, 'misc-hover.png') });

// ── 2. Theme toggle: light↔dark only ──────────────────────────────────────────
const themeToggle = page.locator('button[aria-label="라이트 모드"], button[aria-label="다크 모드"], button[aria-label="시스템 설정"]');
const themeSeq = [];
themeSeq.push(await page.evaluate(() => document.documentElement.getAttribute('data-theme')));
for (let i = 0; i < 3; i++) {
  await themeToggle.first().click();
  await page.waitForTimeout(150);
  themeSeq.push(await page.evaluate(() => document.documentElement.getAttribute('data-theme')));
}

// ── 3. Post-it memo ───────────────────────────────────────────────────────────
await page.getByRole('button', { name: '메모 추가' }).first().click();
await page.waitForTimeout(250);
const memo = await page.evaluate(() => {
  const note = document.querySelector('.memo-note');
  if (!note) return null;
  const cs = getComputedStyle(note);
  const fold = note.querySelector('.memo-fold');
  return {
    bg: cs.backgroundColor,
    hasFold: !!fold,
    foldClip: fold ? getComputedStyle(fold).clipPath : null,
    hasTextarea: !!note.querySelector('textarea'),
  };
});
// change colour to the blue swatch (#bfdbfe) via the hover toolbar
await page.locator('.memo-note').first().hover();
await page.waitForTimeout(150);
await page.locator('.memo-toolbar button[aria-label="#bfdbfe"]').first().click();
await page.waitForTimeout(150);
const memoAfterColor = await page.evaluate(() => getComputedStyle(document.querySelector('.memo-note')).backgroundColor);
await page.screenshot({ path: path.join(DIR, 'misc-memo.png') });

await browser.close();

console.log('affordances before hover / near-line:', affBefore, '/', affNearLine);
console.log('theme sequence:', JSON.stringify(themeSeq));
console.log('memo:', JSON.stringify(memo));
console.log('memo bg after blue swatch:', memoAfterColor);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const hoverOk = affBefore === 0 && affNearLine >= 1;
const themeOk = themeSeq.every((tt) => tt === 'light' || tt === 'dark') &&
  themeSeq.slice(1).some((tt) => tt === 'dark') && themeSeq.slice(1).some((tt) => tt === 'light');
const memoOk = memo && memo.bg === 'rgb(254, 240, 138)' && memo.hasFold && memo.hasTextarea &&
  memoAfterColor === 'rgb(191, 219, 254)';
console.log('hoverOk:', hoverOk, '| themeOk:', themeOk, '| memoOk:', memoOk);
const ok = hoverOk && themeOk && memoOk && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
