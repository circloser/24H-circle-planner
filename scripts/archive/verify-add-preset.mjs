/**
 * Verifies the top-centre + has a 3rd "Choose a preset" option that adds a NEW
 * day from a preset (append mode, no overwrite confirm). Offline build, en-US.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

// Day 1: load a preset.
await page.locator('button:has(h3)').first().click();
await page.getByRole('button', { name: 'Apply to current' }).first().click().catch(() => {});
await page.waitForTimeout(700);

const thumbsBefore = await page.locator('button[aria-label^="Day "]').count();

// Open the add dialog and check the 3 options.
await page.getByRole('button', { name: 'Add day' }).first().click();
await page.waitForTimeout(250);
const optDup = await page.getByRole('button', { name: 'Duplicate current' }).first().isVisible().catch(() => false);
const optEmpty = await page.getByRole('button', { name: 'Empty schedule' }).first().isVisible().catch(() => false);
const optPreset = await page.getByRole('button', { name: 'Choose a preset' }).first().isVisible().catch(() => false);
await page.screenshot({ path: path.join(DIR, 'add-preset-menu.png') });

// Choose a preset → gallery opens (append mode).
await page.getByRole('button', { name: 'Choose a preset' }).first().click();
await page.waitForTimeout(400);
const galleryOpen = await page.getByText('Pick a preset', { exact: false }).first().isVisible().catch(() => false)
  || (await page.locator('button:has(h3)').count()) > 0;
// Pick a preset card → adds a NEW day immediately (no overwrite confirm).
await page.locator('button:has(h3)').first().click();
await page.waitForTimeout(600);
const thumbsAfter = await page.locator('button[aria-label^="Day "]').count();
const indicator = await page.getByText(/Day \d+ of \d+/).first().textContent().catch(() => '');
const activeSlices = await page.locator('svg[role="img"] path[data-slice-id]').count();
await page.screenshot({ path: path.join(DIR, 'add-preset-result.png') });

await browser.close();

console.log('thumbs', thumbsBefore, '->', thumbsAfter, '| indicator:', JSON.stringify(indicator));
console.log('options:', JSON.stringify({ optDup, optEmpty, optPreset }), '| galleryOpen:', galleryOpen, '| activeSlices:', activeSlices);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const ok =
  optDup && optEmpty && optPreset &&
  galleryOpen &&
  thumbsBefore === 0 && thumbsAfter === 2 &&  // 1 day → 2 days (strip appears)
  /Day 2 of 2/.test(indicator || '') &&
  activeSlices > 1 &&                          // the new day holds the preset content
  errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
