/**
 * T13 Issue 3: Capture a hover-affordance screenshot.
 * Loads 직장인 preset, hovers over a boundary handle,
 * and screenshots to confirm + and − buttons appear.
 *
 * Usage: node scripts/screenshot-t13-hover-affordance.mjs
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_HTML = path.join(ROOT, 'dist-single', 'index.html');
const OUT = path.join(ROOT, '.omc', 'verification', 't13-hover-affordance.png');
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

  // Locate the first boundary handle hit-area circle and hover over it
  const sliceCount = await page.locator('svg path[data-slice-id]').count();
  console.log(`Slice paths rendered: ${sliceCount}`);

  // The first boundary handle group
  const handleGroup = page.locator('svg [data-boundary-index="0"]').first();
  const handleVisible = await handleGroup.isVisible({ timeout: 3000 }).catch(() => false);
  console.log(`Handle group visible: ${handleVisible}`);

  if (handleVisible) {
    await handleGroup.hover();
    await page.waitForTimeout(400);
  }

  // Check affordance buttons appeared
  const mergeBtn = page.locator('[aria-label="이 경계 일정 병합"]').first();
  const splitBtn = page.locator('[aria-label="이 경계에서 일정 추가"]').first();
  const mergeVisible = await mergeBtn.isVisible({ timeout: 2000 }).catch(() => false);
  const splitVisible = await splitBtn.isVisible({ timeout: 2000 }).catch(() => false);
  console.log(`Merge button (−) visible: ${mergeVisible}`);
  console.log(`Split button (+) visible: ${splitVisible}`);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await page.screenshot({ path: OUT, fullPage: false });
  console.log(`screenshot: ${OUT}`);

  await browser.close();

  console.log(`console errors: ${consoleErrors.length}`);
  consoleErrors.forEach((e) => console.log('  ', e));

  if (!handleVisible) {
    console.error('FAIL: boundary handle not found after loading preset.');
    process.exit(1);
  }
  if (!mergeVisible || !splitVisible) {
    console.error('FAIL: affordance buttons (+/−) did not appear on hover.');
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
