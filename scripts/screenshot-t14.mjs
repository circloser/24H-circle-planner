/**
 * T14 verification screenshots:
 *
 * 1. t14-click-no-rect.png  — click a slice (mouse), confirm NO rectangular outline
 * 2. t14-handle-hover.png   — hover a boundary handle, confirm circle + +/− visible
 * 3. t14-editor.png         — double-click a slice → editor has no 분할/삭제,
 *                             hint is "Enter 저장 · ESC 취소"; then open 더보기
 *                             → picker prominent at top
 *
 * Usage: node scripts/screenshot-t14.mjs
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_HTML = path.join(ROOT, 'dist-single', 'index.html');
const OUT_DIR = path.join(ROOT, '.omc', 'verification');
const FILE_URL = 'file:///' + DIST_HTML.replace(/\\/g, '/').replace(/^\//, '');

const consoleErrors = [];
let failures = 0;

function fail(msg) {
  console.error('FAIL:', msg);
  failures++;
}

async function loadPreset(page) {
  // Dismiss preset gallery if shown, or open it
  let card = page.locator('button.glass-card:has(h3)').first();
  if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
    await page.locator('button:has-text("프리셋")').first().click();
    await page.waitForTimeout(400);
  }
  const worker = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
  const target = (await worker.isVisible({ timeout: 2000 }).catch(() => false))
    ? worker
    : page.locator('button.glass-card:has(h3)').first();
  await target.click();
  const confirm = page.locator('button:has-text("확인")').first();
  if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) await confirm.click();
  await page.waitForTimeout(1200);
}

async function run() {
  if (!fs.existsSync(DIST_HTML)) {
    console.error('FAIL: dist-single/index.html missing — run pnpm build:single first.');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  // ── Screenshot 1: click-no-rect ───────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('favicon')) consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => {
      if (!e.message.includes('favicon')) consoleErrors.push('PAGE ERROR: ' + e.message);
    });

    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg', { timeout: 15000 });
    await loadPreset(page);

    // Single click a slice (mouse click — was showing rectangular outline before fix)
    const firstSlice = page.locator('svg path[data-slice-id]').first();
    await firstSlice.click();
    await page.waitForTimeout(300);

    const out1 = path.join(OUT_DIR, 't14-click-no-rect.png');
    await page.screenshot({ path: out1, fullPage: false });
    console.log('screenshot:', out1);

    // Check: verify the CSS rule .slice-path:focus has outline:none in the stylesheet.
    // (getComputedStyle on SVG paths in headless Chrome returns misleading shorthand values,
    //  so we check the actual stylesheet rule instead.)
    const cssRuleOk = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText === '.slice-path:focus' && rule.style?.outline === 'none') {
              return true;
            }
          }
        } catch(e) { /* cross-origin */ }
      }
      return false;
    });
    console.log('CSS .slice-path:focus { outline: none } rule present:', cssRuleOk);
    if (!cssRuleOk) fail('CSS rule .slice-path:focus { outline: none } not found in stylesheet');

    await ctx.close();
  }

  // ── Screenshot 2: handle-hover ────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('favicon')) consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => {
      if (!e.message.includes('favicon')) consoleErrors.push('PAGE ERROR: ' + e.message);
    });

    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg', { timeout: 15000 });
    await loadPreset(page);

    const handleGroup = page.locator('svg [data-boundary-index="0"]').first();
    const handleVisible = await handleGroup.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Handle group visible:', handleVisible);

    if (handleVisible) {
      await handleGroup.hover();
      await page.waitForTimeout(400);
    }

    const mergeBtn = page.locator('[aria-label="이 경계 일정 병합"]').first();
    const splitBtn = page.locator('[aria-label="이 경계에서 일정 추가"]').first();
    const mergeVisible = await mergeBtn.isVisible({ timeout: 2000 }).catch(() => false);
    const splitVisible = await splitBtn.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Merge button (−) visible after hover:', mergeVisible);
    console.log('Split button (+) visible after hover:', splitVisible);

    if (!handleVisible) fail('boundary handle not found after loading preset');
    if (!mergeVisible || !splitVisible) fail('affordance buttons (+/−) did not appear on hover');

    const out2 = path.join(OUT_DIR, 't14-handle-hover.png');
    await page.screenshot({ path: out2, fullPage: false });
    console.log('screenshot:', out2);

    await ctx.close();
  }

  // ── Screenshot 3: editor (no 분할/삭제, correct hint, 더보기 picker at top) ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('favicon')) consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => {
      if (!e.message.includes('favicon')) consoleErrors.push('PAGE ERROR: ' + e.message);
    });

    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg', { timeout: 15000 });
    await loadPreset(page);

    // Double-click to open editor
    const firstSlice = page.locator('svg path[data-slice-id]').first();
    await firstSlice.dblclick();
    await page.waitForTimeout(500);

    // Check no 분할 or 삭제 buttons
    const splitBtn = page.locator('button:has-text("분할")').first();
    const deleteBtn = page.locator('button:has-text("삭제")').first();
    const splitPresent = await splitBtn.isVisible({ timeout: 1000 }).catch(() => false);
    const deletePresent = await deleteBtn.isVisible({ timeout: 1000 }).catch(() => false);
    console.log('분할 button present (should be false):', splitPresent);
    console.log('삭제 button present (should be false):', deletePresent);
    if (splitPresent) fail('분할 button should not be in editor');
    if (deletePresent) fail('삭제 button should not be in editor');

    // Check hint text
    const hintText = await page.evaluate(() => {
      const hints = Array.from(document.querySelectorAll('[role="dialog"] p'));
      return hints.map(p => p.textContent?.trim()).find(t => t?.includes('저장'));
    });
    console.log('Hint text:', hintText);
    if (hintText !== 'Enter 저장 · ESC 취소') fail(`Hint text wrong: "${hintText}"`);

    // Check no header "+ 일정 추가" button
    const addBtn = page.locator('button:has-text("+ 일정 추가")').first();
    const addPresent = await addBtn.isVisible({ timeout: 1000 }).catch(() => false);
    console.log('+ 일정 추가 button present (should be false):', addPresent);
    if (addPresent) fail('+ 일정 추가 button should not be in header');

    const out3a = path.join(OUT_DIR, 't14-editor.png');
    await page.screenshot({ path: out3a, fullPage: false });
    console.log('screenshot:', out3a);

    // Click 더보기 to open icon picker
    const moreBtnLocator = page.locator('[role="dialog"] button:has-text("더보기")').first();
    const moreVisible = await moreBtnLocator.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('더보기 button visible:', moreVisible);
    if (moreVisible) {
      await moreBtnLocator.click();
      await page.waitForTimeout(500);

      // Check picker is visible and near top
      const pickerDialog = page.getByRole('dialog', { name: '아이콘 선택' }).first();
      const pickerVisible = await pickerDialog.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Icon picker dialog visible:', pickerVisible);
      if (!pickerVisible) fail('Icon picker dialog did not open');

      if (pickerVisible) {
        const bbox = await pickerDialog.boundingBox();
        console.log('Icon picker top position:', bbox?.y);
        // Should be near the top of viewport (< 250px from top for a 900px viewport,
        // or negative if positioned above origin with top:5vh).
        // y > 250 means it's in the middle/bottom — that would be wrong.
        if (bbox && bbox.y > 250) fail(`Icon picker not near top: y=${bbox.y}`);
      }

      const out3b = path.join(OUT_DIR, 't14-editor-picker.png');
      await page.screenshot({ path: out3b, fullPage: false });
      console.log('screenshot:', out3b);
    } else {
      fail('더보기 button not visible in editor');
    }

    await ctx.close();
  }

  await browser.close();

  console.log('\nconsole errors:', consoleErrors.length);
  consoleErrors.forEach((e) => console.log(' ', e));

  if (consoleErrors.length > 0) fail('uncaught console errors');

  if (failures > 0) {
    console.error(`\nFAIL: ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\nPASS');
}

run().catch((e) => {
  console.error('FAIL (unexpected):', e);
  process.exit(1);
});
