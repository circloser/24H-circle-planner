/**
 * Verifies the bottom-left Clock Tools (offline build, en-US):
 *  - a clock-icon FAB opens a popup to toggle Clock / Timer / Alarm;
 *  - the Clock widget shows an analog face and switches to a digital readout;
 *  - the Timer adds time (+1:00 → 06:00) and Start flips to Pause;
 *  - the Alarm widget exposes a time input;
 *  - no real app console errors.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];
const IGNORE = /favicon|manifest|icon-\d|pagead|googlesyndication|adsbygoogle|Failed to load resource/i;
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!IGNORE.test(e.message)) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

// Dismiss the first-launch preset gallery.
await page.locator('button:has(h3)').first().click();
await page.getByRole('button', { name: 'Apply to current' }).first().click().catch(() => {});
await page.waitForTimeout(400);

const fab = () => page.getByRole('button', { name: 'Clock tools' }).first();
const fabPresent = await fab().isVisible().catch(() => false);

// Open menu → toggle Clock on → close menu.
await fab().click();
await page.waitForTimeout(150);
await page.getByRole('button', { name: 'Clock', exact: true }).first().click();
await fab().click(); // close the popup menu
await page.waitForTimeout(200);
const analogShown = (await page.locator('svg[aria-label^="아날로그"]').count()) > 0;

// Switch analog → digital. Controls only appear (and accept clicks) on hover.
await page.locator('svg[aria-label^="아날로그"]').first().hover();
await page.waitForTimeout(150);
await page.getByRole('button', { name: 'Digital', exact: true }).first().click();
await page.waitForTimeout(150);
const analogGone = (await page.locator('svg[aria-label^="아날로그"]').count()) === 0;
const digitalShown = await page.getByRole('button', { name: 'Analog', exact: true }).first().isVisible().catch(() => false);

// Timer: toggle on, +1:00 → 06:00, Start → Pause.
await fab().click();
await page.waitForTimeout(120);
await page.getByRole('button', { name: 'Timer', exact: true }).first().click();
await fab().click();
await page.waitForTimeout(150);
await page.getByRole('button', { name: '+1:00' }).first().click();
const timerSix = await page.getByText('06:00').first().isVisible().catch(() => false);
await page.getByRole('button', { name: 'Start' }).first().click();
await page.waitForTimeout(150);
const timerRunning = await page.getByRole('button', { name: 'Pause' }).first().isVisible().catch(() => false);

// Alarm: toggle on → time input present.
await fab().click();
await page.waitForTimeout(120);
await page.getByRole('button', { name: 'Alarm', exact: true }).first().click();
await fab().click();
await page.waitForTimeout(150);
const alarmInput = (await page.locator('input[type="time"]').count()) > 0;

await page.screenshot({ path: path.join(DIR, 'clocktools.png') });
await browser.close();

console.log('fab', fabPresent, '| analog', analogShown, '| analogGone', analogGone, '| digital', digitalShown);
console.log('timer 06:00', timerSix, '| running', timerRunning, '| alarm input', alarmInput);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const checks = {
  fabPresent,
  analogClock: analogShown,
  switchToDigital: analogGone && digitalShown,
  timerAddsTime: timerSix,
  timerRuns: timerRunning,
  alarmInput,
  noErrors: errors.length === 0,
};
console.log('checks:', JSON.stringify(checks));
const ok = Object.values(checks).every(Boolean);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
