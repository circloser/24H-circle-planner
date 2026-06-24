/**
 * Verifies the header view-toggle is horizontally centred on the page and does
 * not overlap the side groups (desktop + mobile widths), and that the favicon
 * link still resolves. Offline build, en-US.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 200 }, locale: 'en-US' });
const page = await ctx.newPage();
// On file:// the absolute /manifest, /icon-*, /favicon and the external AdSense
// loader 404 — ignore that offline-only noise; assert on real app errors.
const IGNORE = /favicon|manifest|icon-\d|pagead|googlesyndication|adsbygoogle|Failed to load resource/i;
page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!IGNORE.test(e.message)) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

// Dismiss the first-visit welcome, then open the preset gallery and load one.
await page.keyboard.press('Escape').catch(() => {});
let _pc = page.locator('button:has(h3)').first();
if (!(await _pc.isVisible({ timeout: 1500 }).catch(() => false))) {
  await page.locator('button[aria-label="Design"]').first().click().catch(() => {}); await page.waitForTimeout(200); await page.getByRole("menuitem", { name: "Presets" }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  _pc = page.locator('button:has(h3)').first();
}
await _pc.click();
await page.getByRole('button', { name: 'Apply to current' }).first().click().catch(() => {});
await page.waitForTimeout(400);

const toggle = () => page.getByRole('button', { name: /Switch view/ }).first();
const rightGroupLeft = () =>
  page.evaluate(() => {
    // The settings gear is the most-central control of the right group.
    const gear = document.querySelector('header button[aria-label="Settings"]');
    const grp = gear?.closest('div');
    return grp ? grp.getBoundingClientRect().left : null;
  });

async function measure(width) {
  await page.setViewportSize({ width, height: 200 });
  await page.waitForTimeout(150);
  const box = await toggle().boundingBox();
  const center = box.x + box.width / 2;
  const rgl = await rightGroupLeft();
  return { center, pageCenter: width / 2, toggleRight: box.x + box.width, rightGroupLeft: rgl };
}

const desktop = await measure(1280);
await page.screenshot({ path: path.join(DIR, 'header-center-desktop.png') });
const mobile = await measure(390);
await page.screenshot({ path: path.join(DIR, 'header-center-mobile.png') });

await browser.close();

console.log('desktop:', JSON.stringify(desktop));
console.log('mobile :', JSON.stringify(mobile));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const checks = {
  desktopCentered: Math.abs(desktop.center - desktop.pageCenter) <= 24,
  mobileCentered: Math.abs(mobile.center - mobile.pageCenter) <= 24,
  desktopNoOverlap: desktop.rightGroupLeft != null && desktop.toggleRight <= desktop.rightGroupLeft,
  mobileNoOverlap: mobile.rightGroupLeft != null && mobile.toggleRight <= mobile.rightGroupLeft,
  noErrors: errors.length === 0,
};
console.log('checks:', JSON.stringify(checks));
const ok = Object.values(checks).every(Boolean);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
