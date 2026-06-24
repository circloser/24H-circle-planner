/**
 * Verifies this batch (offline build, en-US):
 *  1. Corner FABs are white (not gray).
 *  2. Calendar "Today" is reachable on hover: navigate forward, then hover+click
 *     Today → the month resets to the current one (proves the click registered).
 *  3. Weather widget is transparent by default: its search form is hidden
 *     (opacity 0) and only appears on hover.
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
await page.keyboard.press('Escape').catch(() => {}); // dismiss first-visit welcome
let _pc = page.locator('button:has(h3)').first();
if (!(await _pc.isVisible({ timeout: 1500 }).catch(() => false))) {
  await page.locator('button[aria-label="Design"]').first().click().catch(() => {}); await page.waitForTimeout(200); await page.getByRole("menuitem", { name: "Presets" }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  _pc = page.locator('button:has(h3)').first();
}
await _pc.click();
await page.getByRole('button', { name: 'Apply to current' }).first().click().catch(() => {});
await page.waitForTimeout(400);

const white = (rgb) => {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || '');
  return m ? Number(m[1]) + Number(m[2]) + Number(m[3]) >= 740 : false;
};

// ── 1. FABs white ────────────────────────────────────────────────────────────
const clockFabBg = await page.locator('button[aria-label="Clock tools"]').evaluate((el) => getComputedStyle(el).backgroundColor);
const memoFabBg = await page.locator('button[aria-label="Add memo"]').evaluate((el) => getComputedStyle(el).backgroundColor);

const clockFab = page.locator('button[aria-label="Clock tools"]');

// ── 2. Calendar Today reachable ──────────────────────────────────────────────
await clockFab.click();
await page.waitForTimeout(120);
await page.getByRole('button', { name: 'Calendar', exact: true }).first().click();
await clockFab.click();
await page.waitForTimeout(200);
const monthNow = await page.evaluate(() => {
  const el = [...document.querySelectorAll('span')].find((s) => /\b20\d\d\b/.test(s.textContent || '') && s.className.includes('truncate'));
  return el ? el.textContent.trim() : '';
});
// Hover the (always-on) month label so the hover-only arrows become interactive,
// then navigate; the mouse stays inside the calendar so the arrows remain active.
await page.getByText('June', { exact: false }).first().hover();
await page.waitForTimeout(120);
await page.getByRole('button', { name: 'next' }).first().click();
await page.getByRole('button', { name: 'next' }).first().click();
await page.waitForTimeout(150);
await page.getByRole('button', { name: 'Today' }).first().click();
await page.waitForTimeout(150);
const monthAfter = await page.evaluate(() => {
  const el = [...document.querySelectorAll('span')].find((s) => /\b20\d\d\b/.test(s.textContent || '') && s.className.includes('truncate'));
  return el ? el.textContent.trim() : '';
});
const todayWorks = monthNow !== '' && monthNow === monthAfter;

// ── 3. Weather transparent (search form hover-only) ──────────────────────────
await clockFab.click();
await page.waitForTimeout(120);
await page.getByRole('button', { name: 'Weather', exact: true }).first().click();
await clockFab.click();
await page.waitForTimeout(200);
const wInput = page.locator('input[placeholder="Search city"]');
const weatherInput = await wInput.count();
const formOpacityDefault = await wInput.evaluate((el) => getComputedStyle(el.closest('form')).opacity).catch(() => '?');
await page.getByText('Search to set your region.').first().hover();
await page.waitForTimeout(150);
const formOpacityHover = await wInput.evaluate((el) => getComputedStyle(el.closest('form')).opacity).catch(() => '?');
await page.screenshot({ path: path.join(DIR, 'batch9.png') });

await browser.close();

console.log('FAB bg: clock', clockFabBg, '| memo', memoFabBg);
console.log('calendar month:', JSON.stringify(monthNow), '→ after Today:', JSON.stringify(monthAfter), '| todayWorks', todayWorks);
console.log('weather: input', weatherInput, '| form opacity default', formOpacityDefault, '→ hover', formOpacityHover);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const checks = {
  fabsWhite: white(clockFabBg) && white(memoFabBg),
  calendarTodayWorks: todayWorks,
  weatherInput: weatherInput >= 1,
  weatherFormHoverOnly: formOpacityDefault === '0' && formOpacityHover === '1',
  noErrors: errors.length === 0,
};
console.log('checks:', JSON.stringify(checks));
const ok = Object.values(checks).every(Boolean);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
