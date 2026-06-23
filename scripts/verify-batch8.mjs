/**
 * Verifies this batch (offline build, en-US):
 *  1. Calendar hover controls float ABOVE the calendar (no overlap with nav).
 *  2. Rim memo can be dragged along the rim (grip → moves).
 *  3. Memo text is capped (no scrollbar): typing 200 chars keeps ≤ 140.
 *  4. Memo alignment: "Align left" sets text-align left.
 *  5. Memo font: picking "Noto Sans KR" applies that family.
 *  6. The two corner FABs are light (not the blue primary).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];
const IGNORE = /favicon|manifest|icon-\d|pagead|googlesyndication|adsbygoogle|open-meteo|geocoding|Failed to load resource/i;
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!IGNORE.test(e.message)) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });
await page.locator('button:has(h3)').first().click();
await page.getByRole('button', { name: 'Apply to current' }).first().click().catch(() => {});
await page.waitForTimeout(400);

const lightBg = (rgb) => {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || '');
  return m ? Number(m[1]) + Number(m[2]) + Number(m[3]) > 600 : false;
};

// ── 6. FAB colours ───────────────────────────────────────────────────────────
const clockFabBg = await page.locator('button[aria-label="Clock tools"]').evaluate((el) => getComputedStyle(el).backgroundColor);
const memoFabBg = await page.locator('button[aria-label="Add memo"]').evaluate((el) => getComputedStyle(el).backgroundColor);

// ── 1. Calendar controls float above the nav ─────────────────────────────────
const clockFab = page.locator('button[aria-label="Clock tools"]');
await clockFab.click();
await page.waitForTimeout(120);
await page.getByRole('button', { name: 'Calendar', exact: true }).first().click();
await clockFab.click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'next' }).first().hover(); // reveal hover controls
await page.waitForTimeout(150);
const todayBox = await page.getByRole('button', { name: 'Today' }).first().boundingBox();
const nextBox = await page.getByRole('button', { name: 'next' }).first().boundingBox();
const calendarNoOverlap = !!(todayBox && nextBox) && todayBox.y + todayBox.height <= nextBox.y + 2;

// ── 3/4/5. Memo limit + align + font ─────────────────────────────────────────
await page.locator('button[aria-label="Add memo"]').click();
await page.getByRole('button', { name: 'Add memo', exact: true }).first().click();
await page.waitForTimeout(250);
const memoText = page.locator('.memo-text').first();
await memoText.click();
await page.keyboard.press('Control+A');
await page.keyboard.insertText('a'.repeat(200));
await page.waitForTimeout(150);
const memoLen = await memoText.evaluate((el) => el.innerText.length);

await page.getByRole('button', { name: 'Align left' }).first().click();
await page.waitForTimeout(120);
const memoAlign = await memoText.evaluate((el) => getComputedStyle(el).textAlign);

await page.locator('.memo-toolbar select').first().selectOption({ label: 'Noto Sans KR' });
await page.waitForTimeout(150);
const memoFont = await memoText.evaluate((el) => getComputedStyle(el).fontFamily);

// ── 2. Rim memo drag along the rim ───────────────────────────────────────────
const rim3 = await page.evaluate(() => {
  const svg = document.querySelector('svg[role="img"]');
  const ctm = svg.getScreenCTM();
  const p = svg.createSVGPoint(); p.x = 990; p.y = 500; // 3 o'clock band
  const s = p.matrixTransform(ctm); return { x: s.x, y: s.y };
});
await page.mouse.click(rim3.x, rim3.y);
await page.waitForTimeout(200);
await page.keyboard.type('R');
await page.locator('.rim-memo-text').first().evaluate((el) => el.blur());
await page.waitForTimeout(150);
const rimBefore = await page.locator('.rim-memo-text').first().boundingBox();
// Hover the memo, grab the move grip, drag to the 6 o'clock band.
await page.locator('.rim-memo-text').first().hover();
await page.waitForTimeout(120);
const grip = await page.getByRole('button', { name: 'Drag along the rim' }).first().boundingBox();
const rim6 = await page.evaluate(() => {
  const svg = document.querySelector('svg[role="img"]');
  const ctm = svg.getScreenCTM();
  const p = svg.createSVGPoint(); p.x = 500; p.y = 990; // 6 o'clock band
  const s = p.matrixTransform(ctm); return { x: s.x, y: s.y };
});
if (grip) {
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(rim6.x, rim6.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}
const rimAfter = await page.locator('.rim-memo-text').first().boundingBox();
const rimMoved = rimBefore && rimAfter ? Math.hypot(rimBefore.x - rimAfter.x, rimBefore.y - rimAfter.y) : 0;
await page.screenshot({ path: path.join(DIR, 'batch8.png') });

await browser.close();

console.log('FAB bg: clock', clockFabBg, '| memo', memoFabBg);
console.log('calendarNoOverlap:', calendarNoOverlap, '| today.y', todayBox?.y, 'next.y', nextBox?.y);
console.log('memo len:', memoLen, '| align:', memoAlign, '| font:', memoFont);
console.log('rim moved px:', Math.round(rimMoved));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const checks = {
  fabsLight: lightBg(clockFabBg) && lightBg(memoFabBg),
  calendarNoOverlap,
  memoCharLimit: memoLen === 140,
  memoAlignLeft: memoAlign === 'left',
  memoFont: /Noto Sans KR/.test(memoFont),
  rimDrag: rimMoved > 150,
  noErrors: errors.length === 0,
};
console.log('checks:', JSON.stringify(checks));
const ok = Object.values(checks).every(Boolean);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
