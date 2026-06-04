/**
 * T13 Issue 1: Capture a wedge-shaped selection highlight screenshot.
 * Opens the 직장인 preset, double-clicks a slice to open the editor,
 * then screenshots to show the accent stroke follows the wedge — not a rectangle.
 *
 * Usage: node scripts/screenshot-t13-selection.mjs
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_HTML = path.join(ROOT, 'dist-single', 'index.html');
const OUT = path.join(ROOT, '.omc', 'verification', 't13-selection.png');
const FILE_URL = 'file:///' + DIST_HTML.replace(/\\/g, '/').replace(/^\//, '');

const consoleErrors = [];

async function run() {
  if (!fs.existsSync(DIST_HTML)) {
    console.error('FAIL: dist-single/index.html missing — run pnpm build:single first.');
    process.exit(1);
  }
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('favicon')) consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => {
    if (!e.message.includes('favicon')) consoleErrors.push('PAGE ERROR: ' + e.message);
  });

  await page.goto(FILE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg', { timeout: 15000 });

  // Load 직장인 preset
  let card = page.locator('button.glass-card:has(h3)').first();
  if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
    await page.locator('button:has-text("프리셋")').first().click();
    await page.waitForTimeout(400);
  }
  const worker = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
  const target = (await worker.isVisible({ timeout: 2000 }).catch(() => false)) ? worker : page.locator('button.glass-card:has(h3)').first();
  await target.click();
  const confirm = page.locator('button:has-text("확인")').first();
  if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) await confirm.click();
  await page.waitForTimeout(1200);

  // Double-click the first slice to open the editor (sets selectedSliceId)
  const firstSlice = page.locator('svg path[data-slice-id]').first();
  await firstSlice.dblclick();
  await page.waitForTimeout(400);

  // Check that the selected path has slice-path--selected class
  const selectedCount = await page.locator('svg path.slice-path--selected').count();
  console.log(`Selected paths with wedge highlight: ${selectedCount}`);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await page.screenshot({ path: OUT, fullPage: false });
  console.log(`screenshot: ${OUT}`);

  await browser.close();

  console.log(`console errors: ${consoleErrors.length}`);
  consoleErrors.forEach((e) => console.log('  ', e));

  if (selectedCount < 1) {
    console.error('FAIL: no slice-path--selected element found after opening editor');
    process.exit(1);
  }
  if (consoleErrors.length > 0) {
    console.error('FAIL: uncaught console errors.');
    process.exit(1);
  }
  console.log('PASS');
}
run().catch((e) => {
  console.error('FAIL (unexpected):', e);
  process.exit(1);
});
