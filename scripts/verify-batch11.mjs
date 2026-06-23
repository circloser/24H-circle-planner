/**
 * Verifies this batch (offline build, en-US):
 *  1. "Save as…" dialog reserves an ad slot ([data-ad-slot="saveas"]).
 *  2. "Save as preset" dialog reserves an ad slot ([data-ad-slot="savepreset"]).
 *  3. Clicking the "24Houring" title opens the About dialog (manual + Circloser).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];
const IGNORE = /favicon|manifest|icon-\d|pagead|googlesyndication|adsbygoogle|open-meteo|geocoding|nominatim|Failed to load resource/i;
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

const mySchedules = page.getByRole('button', { name: 'My Schedules' });

// ── 2. Save as preset ad slot ────────────────────────────────────────────────
await mySchedules.click();
await page.getByRole('menuitem', { name: 'Save as preset' }).click();
await page.waitForTimeout(250);
const presetAd = await page.locator('[role="dialog"] [data-ad-slot="savepreset"]').count();
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// ── 1. Save as… ad slot ──────────────────────────────────────────────────────
await mySchedules.click();
await page.getByRole('menuitem', { name: /Save as/ }).first().click(); // "Save as…" (before "Save as preset")
await page.waitForTimeout(250);
const saveAsAd = await page.locator('[role="dialog"] [data-ad-slot="saveas"]').count();
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// ── 3. About dialog from the title ───────────────────────────────────────────
await page.getByRole('button', { name: /About 24Houring/ }).click();
await page.waitForTimeout(250);
const aboutBrand = await page.getByText('Circloser', { exact: true }).first().isVisible().catch(() => false);
const aboutFeatures = await page.getByText('Features', { exact: true }).first().isVisible().catch(() => false);
await page.screenshot({ path: path.join(DIR, 'batch11.png') });

await browser.close();

console.log('saveAsAd:', saveAsAd, '| presetAd:', presetAd);
console.log('about: brand', aboutBrand, '| features', aboutFeatures);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const checks = {
  saveAsAdSlot: saveAsAd >= 1,
  savePresetAdSlot: presetAd >= 1,
  aboutDialog: aboutBrand && aboutFeatures,
  noErrors: errors.length === 0,
};
console.log('checks:', JSON.stringify(checks));
const ok = Object.values(checks).every(Boolean);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
