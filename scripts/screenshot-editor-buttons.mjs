/**
 * Capture a screenshot of the slice editor showing 분할/삭제 buttons.
 * Loads the 직장인 preset, double-clicks the largest slice to open the editor,
 * then screenshots the result.
 *
 * Usage: node scripts/screenshot-editor-buttons.mjs
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_HTML = path.join(ROOT, 'dist-single', 'index.html');
const OUT = path.join(ROOT, '.omc', 'verification', 'editor-buttons-screenshot.png');
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
  await page.waitForSelector('svg[role="img"]', { timeout: 15000 });

  // Load the 직장인 preset
  let card = page.locator('button.glass-card:has(h3)').first();
  if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
    await page.locator('button:has-text("프리셋")').first().click();
    await page.waitForTimeout(400);
    card = page.locator('button.glass-card:has(h3)').first();
  }
  const worker = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
  const target = (await worker.isVisible({ timeout: 2000 }).catch(() => false)) ? worker : card;
  await target.click();

  const confirm = page.locator('button:has-text("확인")').first();
  if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) await confirm.click();

  await page.waitForTimeout(1200);

  // Double-click the largest slice path to open the editor
  const slicePath = page.locator('svg path[data-slice-id]').first();
  await slicePath.dblclick({ timeout: 5000 });

  // Wait for the editor dialog (portal into body)
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await page.waitForTimeout(300);

  // Verify 분할 and 삭제 buttons are present
  const splitBtn = page.locator('button:has-text("분할")').first();
  const deleteBtn = page.locator('button:has-text("삭제")').first();
  const hasSplit = await splitBtn.isVisible({ timeout: 2000 }).catch(() => false);
  const hasDelete = await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await page.screenshot({ path: OUT, fullPage: false });

  console.log(`split button visible: ${hasSplit}`);
  console.log(`delete button visible: ${hasDelete}`);
  console.log(`console errors: ${consoleErrors.length}`);
  consoleErrors.forEach((e) => console.log('  ', e));
  console.log(`screenshot: ${OUT}`);

  await browser.close();

  if (!hasSplit || !hasDelete) {
    console.error('FAIL: 분할/삭제 buttons not visible in editor.');
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
