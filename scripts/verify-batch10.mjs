/**
 * Verifies this batch (offline build, en-US):
 *  1. The digital clock is gone: no center-hub clock element, no "Clock" item in
 *     the gear (settings) menu.
 *  2. Calendar month arrows are hover-only (opacity 0 by default → 1 on hover).
 *  3. Settings dialog reserves an ad slot ([data-ad-slot="settings"]).
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

// ── 1. No digital clock ───────────────────────────────────────────────────────
const centerClock = await page.locator('[data-clock]').count();
await page.locator('button[aria-label="Settings"]').click();
await page.waitForTimeout(150);
const clockMenuItem = await page.getByRole('menuitem', { name: 'Clock', exact: true }).count();
const timelineMenuItem = await page.getByRole('menuitem', { name: 'Time lines' }).count();

// ── 3. Settings dialog ad slot ───────────────────────────────────────────────
await page.getByRole('menuitem', { name: 'Time lines' }).click();
await page.waitForTimeout(250);
const adSlot = await page.locator('[role="dialog"] [data-ad-slot="settings"]').count();
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// ── 2. Calendar arrows hover-only ────────────────────────────────────────────
const clockFab = page.locator('button[aria-label="Clock tools"]');
await clockFab.click();
await page.waitForTimeout(120);
await page.getByRole('button', { name: 'Calendar', exact: true }).first().click();
await clockFab.click();
await page.waitForTimeout(200);
const prev = page.getByRole('button', { name: 'prev' }).first();
const arrowOpacityDefault = await prev.evaluate((el) => getComputedStyle(el).opacity).catch(() => '?');
await page.getByText('June', { exact: false }).first().hover();
await page.waitForTimeout(150);
const arrowOpacityHover = await prev.evaluate((el) => getComputedStyle(el).opacity).catch(() => '?');
await page.screenshot({ path: path.join(DIR, 'batch10.png') });

await browser.close();

console.log('centerClock:', centerClock, '| clockMenuItem:', clockMenuItem, '| timelineMenuItem:', timelineMenuItem);
console.log('settings adSlot:', adSlot);
console.log('calendar arrow opacity default:', arrowOpacityDefault, '→ hover:', arrowOpacityHover);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const checks = {
  noCenterClock: centerClock === 0,
  noClockMenuItem: clockMenuItem === 0,
  timelineStillThere: timelineMenuItem === 1,
  settingsAdSlot: adSlot >= 1,
  arrowsHoverOnly: arrowOpacityDefault === '0' && arrowOpacityHover === '1',
  noErrors: errors.length === 0,
};
console.log('checks:', JSON.stringify(checks));
const ok = Object.values(checks).every(Boolean);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
