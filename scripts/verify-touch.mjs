/**
 * Mobile / touch pass verification (offline single-file build):
 *  0. (pointer: coarse) is emulated → app is in touch mode.
 *  1. Header fits the viewport (no horizontal overflow, no 3-line wrap).
 *  2. Tapping a slice opens the editor (single tap, not double).
 *  3. Tapping a boundary reveals its +/− affordances (no hover needed).
 *  4. A new memo shows its delete (×) + grip controls without hovering.
 *  5. Zero console errors throughout.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

// 0. Touch mode active?
const coarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);

// Load the 직장인 preset from the first-launch gallery (or via header button).
async function loadPreset() {
  const card = page.locator('button:has(h3:has-text("직장인"))').first();
  if (await card.isVisible({ timeout: 1500 }).catch(() => false)) {
    await card.click();
    await page.getByRole('button', { name: '현재 창에 적용' }).first().click().catch(() => {});
    return;
  }
  await page.getByRole('button', { name: '프리셋' }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  const c2 = page.locator('button:has(h3:has-text("직장인"))').first();
  if (await c2.isVisible({ timeout: 1500 }).catch(() => false)) {
    await c2.click();
    await page.getByRole('button', { name: '현재 창에 적용' }).first().click().catch(() => {});
  }
}
await loadPreset();
await page.waitForTimeout(500);

// 1. Header fits.
const header = await page.evaluate(() => {
  const h = document.querySelector('header');
  const title = document.querySelector('header h1');
  return {
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    headerOverflow: h ? h.scrollWidth > h.clientWidth + 1 : true,
    titleHeight: title ? Math.round(title.getBoundingClientRect().height) : 0,
    titleLineish: title ? Math.round(title.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight || '20')) : 0,
  };
});
await page.screenshot({ path: path.join(DIR, 'touch-1-loaded.png') });

// 2. Single tap on a slice opens the editor.
const editorSel = '[role="dialog"][aria-label="슬라이스 편집"]';
const slice = page.locator('path[data-slice-id]').nth(2);
await slice.tap();
await page.waitForTimeout(350);
const editorOpened = await page.locator(editorSel).isVisible().catch(() => false);
await page.screenshot({ path: path.join(DIR, 'touch-2-edit.png') });
// dismiss editor
await page.keyboard.press('Escape').catch(() => {});
await page.mouse.click(5, 420).catch(() => {});
await page.waitForTimeout(250);

// 3. Tap a boundary → affordances appear.
const beforeAff = await page.locator('g.boundary-affordances').count();
const slider = page.locator('[aria-label="경계 1 드래그"]').first();
await slider.tap();
await page.waitForTimeout(300);
const afterAff = await page.locator('g.boundary-affordances').count();
// Are boundary dots visible without hover? (coarse keeps them on)
const dotsVisible = await page.evaluate(() => {
  const c = document.querySelector('.boundary-handles g[data-boundary-index] circle[r="6"]');
  return c ? getComputedStyle(c).opacity : 'none';
});
await page.screenshot({ path: path.join(DIR, 'touch-3-boundary.png') });

// 4. Add a memo → del + grip visible without hover.
await page.mouse.click(5, 700).catch(() => {});
await page.waitForTimeout(150);
await page.getByRole('button', { name: '메모 추가' }).first().tap();
await page.waitForTimeout(300);
const note = page.locator('.memo-note').last();
const delOpacity = await note.locator('.memo-del').evaluate((e) => getComputedStyle(e).opacity).catch(() => 'none');
const gripOpacity = await note.locator('.memo-grip').evaluate((e) => getComputedStyle(e).opacity).catch(() => 'none');
await page.screenshot({ path: path.join(DIR, 'touch-4-memo.png') });

await browser.close();

const r = {
  coarse,
  header,
  editorOpened,
  affordances: { before: beforeAff, after: afterAff },
  dotsVisible,
  memo: { delOpacity, gripOpacity },
  consoleErrors: errors.length,
};
console.log(JSON.stringify(r, null, 2));
errors.forEach((e) => console.log('  ERR', e));

const ok =
  coarse === true &&
  header.overflow === false &&
  header.headerOverflow === false &&
  header.titleLineish <= 1 &&
  editorOpened === true &&
  afterAff >= 1 &&
  dotsVisible === '1' &&
  delOpacity === '1' &&
  gripOpacity === '1' &&
  errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
