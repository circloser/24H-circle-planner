/**
 * Capture a preset-loaded screenshot of the pizza redesign on file://.
 * Loads the 직장인 preset (10 slices) so the wedges + hub are actually visible.
 *
 * Usage: node scripts/screenshot-pizza.mjs
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_HTML = path.join(ROOT, 'dist-single', 'index.html');
const OUT = path.join(ROOT, '.omc', 'verification', 'pizza-preset-screenshot.png');
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

  // The preset gallery auto-opens on first launch. If not open, click the 프리셋 button.
  let card = page.locator('button.glass-card:has(h3)').first();
  if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
    await page.locator('button:has-text("프리셋")').first().click();
    await page.waitForTimeout(400);
    card = page.locator('button.glass-card:has(h3)').first();
  }

  // Pick the 직장인 card specifically (10 slices, all 6 hues) for the richest pizza.
  const worker = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
  const target = (await worker.isVisible({ timeout: 2000 }).catch(() => false)) ? worker : card;
  await target.click();

  // Confirm the overwrite dialog.
  const confirm = page.locator('button:has-text("확인")').first();
  if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) await confirm.click();

  // Wait for the wedge paths to render (preset has 10 slices → ≥10 slice paths).
  await page.waitForTimeout(1200);
  const sliceCount = await page.locator('svg path[data-slice-id]').count();

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await page.screenshot({ path: OUT, fullPage: false });

  console.log(`slice paths rendered: ${sliceCount}`);
  console.log(`console errors: ${consoleErrors.length}`);
  consoleErrors.forEach((e) => console.log('  ', e));
  console.log(`screenshot: ${OUT}`);

  await browser.close();
  if (sliceCount < 9) {
    console.error('FAIL: expected ≥9 slice paths after loading a preset.');
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
