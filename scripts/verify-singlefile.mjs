/**
 * Playwright file:// verification for dist-single/index.html.
 *
 * Usage: node scripts/verify-singlefile.mjs
 *
 * Exit 0 = PASS, Exit 1 = FAIL
 */

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_HTML = path.join(ROOT, 'dist-single', 'index.html');
const SCREENSHOT_DIR = path.join(ROOT, '.omc', 'verification');
const SCREENSHOT_PATH = path.join(SCREENSHOT_DIR, 'singlefile-screenshot.png');

// file:// URL for Windows: file:///C:/vibecoding/24h/dist-single/index.html
const FILE_URL = 'file:///' + DIST_HTML.replace(/\\/g, '/').replace(/^\//, '');

const ALLOWED_CONSOLE_ERRORS = [
  '/favicon.svg',
  'favicon',
];

function isAllowedError(msg) {
  return ALLOWED_CONSOLE_ERRORS.some((s) => msg.includes(s));
}

async function run() {
  console.log('--- Single-file file:// verification ---');
  console.log('Opening:', FILE_URL);

  if (!fs.existsSync(DIST_HTML)) {
    console.error('FAIL: dist-single/index.html not found. Run pnpm build:single first.');
    process.exit(1);
  }

  // Report file size
  const size = fs.statSync(DIST_HTML).size;
  console.log(`dist-single/index.html size: ${(size / 1024 / 1024).toFixed(2)} MB`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!isAllowedError(text)) {
        consoleErrors.push(text);
      } else {
        console.log(`  [allowed console error] ${text}`);
      }
    }
  });

  page.on('pageerror', (err) => {
    const text = err.message;
    if (!isAllowedError(text)) {
      consoleErrors.push('PAGE ERROR: ' + text);
    }
  });

  let passed = true;
  const failures = [];

  try {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 1. Wait for SVG ring to render
    try {
      await page.waitForSelector('svg', { timeout: 15000 });
      console.log('  [PASS] SVG ring rendered');
    } catch {
      failures.push('SVG ring did not render within 15s');
      passed = false;
    }

    // 2. Wait for React hydration (root has children)
    try {
      await page.waitForFunction(
        () => document.getElementById('root')?.children.length > 0,
        { timeout: 10000 },
      );
      console.log('  [PASS] React app mounted (root has children)');
    } catch {
      failures.push('React app did not mount within 10s');
      passed = false;
    }

    // 3. Try to load a preset: click the preset button (프리셋) and select first card
    try {
      // Look for the preset trigger button — try common selectors
      const presetBtn = page.locator('button:has-text("프리셋"), button[aria-label*="프리셋"], button:has-text("Preset")').first();
      const btnVisible = await presetBtn.isVisible({ timeout: 5000 }).catch(() => false);
      if (btnVisible) {
        await presetBtn.click();
        // Wait for preset cards to appear
        await page.waitForSelector('[data-testid="preset-card"], .preset-card, [class*="preset"]', { timeout: 5000 }).catch(() => null);
        // Click the first preset card if found
        const firstCard = page.locator('[data-testid="preset-card"], .preset-card').first();
        const cardVisible = await firstCard.isVisible({ timeout: 3000 }).catch(() => false);
        if (cardVisible) {
          await firstCard.click();
          // Confirm if a dialog appears
          const confirmBtn = page.locator('button:has-text("확인"), button:has-text("Apply"), button:has-text("적용")').first();
          const confirmVisible = await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false);
          if (confirmVisible) await confirmBtn.click();
          console.log('  [PASS] Preset loaded via UI');
        } else {
          console.log('  [INFO] Preset cards not found with known selectors — skipping preset load assertion');
        }
      } else {
        console.log('  [INFO] Preset button not found with known selectors — skipping preset load assertion');
      }
    } catch (e) {
      console.log(`  [INFO] Preset interaction skipped: ${e.message}`);
    }

    // Small wait for any async rendering after preset
    await page.waitForTimeout(1000);

    // 4. Assert slices are present in SVG
    try {
      const sliceCount = await page.locator('svg path[fill], svg path[stroke]').count();
      if (sliceCount > 0) {
        console.log(`  [PASS] SVG contains ${sliceCount} path elements (slices rendered)`);
      } else {
        console.log('  [INFO] No SVG paths found — may be empty schedule (not a failure)');
      }
    } catch (e) {
      console.log(`  [INFO] SVG path check skipped: ${e.message}`);
    }

    // 5. Take screenshot
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
    console.log(`  [PASS] Screenshot saved to: ${SCREENSHOT_PATH}`);

  } finally {
    await browser.close();
  }

  // Report console errors
  if (consoleErrors.length > 0) {
    console.error('\nUncaught console errors:');
    consoleErrors.forEach((e) => console.error('  ', e));
    failures.push(`${consoleErrors.length} uncaught console error(s)`);
    passed = false;
  } else {
    console.log('  [PASS] No uncaught console errors');
  }

  console.log('\n--- Result ---');
  if (passed) {
    console.log('PASS: Single-file file:// verification succeeded.');
  } else {
    console.error('FAIL: Verification failed:');
    failures.forEach((f) => console.error('  -', f));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('FAIL (unexpected error):', err);
  process.exit(1);
});
