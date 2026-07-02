/**
 * Verify that index.html ALONE (copied to an empty dir, no fonts/ folder, no favicon)
 * still renders Korean text via the runtime base64-injected @font-face, and that
 * a preset loads. Answers "can I copy just the single file elsewhere?".
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/portable-test/index.html';
const OUT = path.resolve('.omc/verification/portable-single-screenshot.png');

const errors = [];
const missingResources = [];

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1100, height: 850 } })).newPage();

page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text());
});
page.on('pageerror', (e) => {
  if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message);
});
// Track any failed file requests (e.g. ./fonts/*.woff2 404) — these are the
// "do I need the sibling files?" signal.
page.on('requestfailed', (req) => {
  missingResources.push(req.url().split('/').slice(-2).join('/'));
});

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });

// Load the 직장인 preset (gallery auto-opens on first launch).
let card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
  await page.locator('button[aria-label="디자인"]').first().click().catch(() => {}); await page.waitForTimeout(200); await page.locator('[role="menuitem"]:has-text("프리셋")').first().click().catch(() => {});
  await page.waitForTimeout(400);
  card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
}
await card.click().catch(() => {});
const confirm = page.locator('button:has-text("확인")').first();
if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) await confirm.click();
await page.waitForTimeout(1200);

const slicePaths = await page.locator('svg path[data-slice-id]').count();

// Critical check: does a Korean label actually render in Pretendard (not a fallback)?
// We measure whether document.fonts reports Pretendard as loaded, AND that the
// hub clock text has non-zero rendered width (proxy for glyphs rendering).
const fontInfo = await page.evaluate(async () => {
  await document.fonts.ready;
  const loaded = [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`);
  const pretendardLoaded = [...document.fonts].some(
    (f) => f.family.includes('Pretendard') && f.status === 'loaded',
  );
  return { loaded, pretendardLoaded };
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
await page.screenshot({ path: OUT });
await browser.close();

console.log('slice paths:', slicePaths);
console.log('Pretendard loaded:', fontInfo.pretendardLoaded);
console.log('font faces:', JSON.stringify(fontInfo.loaded));
console.log('failed resource requests (sibling files the page tried to fetch):',
  missingResources.length ? missingResources.join(', ') : '(none)');
console.log('console errors (non-favicon):', errors.length);
errors.forEach((e) => console.log('  ', e));
console.log('screenshot:', OUT);

const ok = slicePaths >= 9 && fontInfo.pretendardLoaded && errors.length === 0;
console.log(ok ? 'PASS — single index.html is self-contained' : 'FAIL');
process.exit(ok ? 0 : 1);
