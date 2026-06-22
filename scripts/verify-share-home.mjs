/**
 * Verifies (offline build, en-US):
 *  - the Google AdSense loader is present with the right publisher id;
 *  - the PWA manifest + apple-touch-icon are linked;
 *  - the gear menu exposes "Share" and "Add to home screen";
 *  - Share generates an image (desktop fallback = download) end-to-end;
 *  - "Add to home screen" opens a dialog with a copy-link action;
 *  - no real app console errors (offline 404s for ads/manifest/icons ignored).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];
// Offline-only noise: absolute /manifest, /icon-*, /favicon 404 and the external
// AdSense loader is 403'd from a file:// origin (its console line carries no URL).
const IGNORE = /favicon|manifest|icon-\d|pagead|googlesyndication|adsbygoogle|Failed to load resource/i;
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US', acceptDownloads: true });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!IGNORE.test(e.message)) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

// Static head checks.
const head = await page.evaluate(() => {
  const ad = document.querySelector('script[src*="adsbygoogle.js"]');
  const manifest = document.querySelector('link[rel="manifest"]');
  const apple = document.querySelector('link[rel="apple-touch-icon"]');
  return {
    adSrc: ad ? ad.getAttribute('src') : null,
    manifestHref: manifest ? manifest.getAttribute('href') : null,
    appleHref: apple ? apple.getAttribute('href') : null,
  };
});

// Dismiss the first-launch preset gallery (modal makes the header inert).
await page.locator('button:has(h3)').first().click();
await page.getByRole('button', { name: 'Apply to current' }).first().click().catch(() => {});
await page.waitForTimeout(400);

// Gear menu → assert the two new items.
await page.locator('button[aria-label="Settings"]').first().click();
await page.waitForTimeout(200);
const shareItem = await page.getByRole('menuitem', { name: 'Share' }).first().isVisible().catch(() => false);
const homeItem = await page.getByRole('menuitem', { name: 'Add to home screen' }).first().isVisible().catch(() => false);
await page.screenshot({ path: path.join(DIR, 'gear-menu.png') });

// Click Share → desktop fallback downloads the PNG (proves image generation).
let shared = false;
try {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 12000 }),
    page.getByRole('menuitem', { name: 'Share' }).first().click(),
  ]);
  shared = (await download.suggestedFilename()).endsWith('.png');
} catch { shared = false; }

// "Add to home screen" → dialog with copy-link.
await page.locator('button[aria-label="Settings"]').first().click();
await page.waitForTimeout(200);
await page.getByRole('menuitem', { name: 'Add to home screen' }).first().click();
await page.waitForTimeout(300);
const copyVisible = await page.getByRole('button', { name: 'Copy link' }).first().isVisible().catch(() => false);
await page.screenshot({ path: path.join(DIR, 'home-dialog.png') });

await browser.close();

console.log('head:', JSON.stringify(head));
console.log('menu: share', shareItem, '| home', homeItem, '| sharedPng', shared, '| copyVisible', copyVisible);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const checks = {
  adsenseTag: !!head.adSrc && head.adSrc.includes('ca-pub-6947130056543786'),
  manifestLinked: !!head.manifestHref && head.manifestHref.includes('manifest.webmanifest'),
  appleIcon: !!head.appleHref,
  shareMenuItem: shareItem === true,
  homeMenuItem: homeItem === true,
  shareGeneratesImage: shared === true,
  homeDialogCopy: copyVisible === true,
  noErrors: errors.length === 0,
};
console.log('checks:', JSON.stringify(checks));
const ok = Object.values(checks).every(Boolean);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
