/**
 * Verifies this batch (offline build, en-US):
 *  - ads.txt present with the AdSense publisher line;
 *  - Weather tool opens with a city search input;
 *  - Timeline settings: now-line colour applies + adding a world clock adds an
 *    extra time line on the chart;
 *  - Rim memos follow the time: a memo created in 24h moves when switching to the
 *    12h day view (time-linked, not angle-locked).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const adsTxt = fs.existsSync(path.resolve('dist/ads.txt')) ? fs.readFileSync(path.resolve('dist/ads.txt'), 'utf8') : '';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];
const IGNORE = /favicon|manifest|icon-\d|pagead|googlesyndication|adsbygoogle|open-meteo|geocoding|Failed to load resource/i;
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

// ── Weather tool ─────────────────────────────────────────────────────────────
const clockFab = page.locator('button[aria-label="Clock tools"]');
await clockFab.click();
await page.waitForTimeout(120);
await page.getByRole('button', { name: 'Weather', exact: true }).first().click();
await clockFab.click();
await page.waitForTimeout(200);
const weatherInput = await page.locator('input[placeholder="Search city"]').count();

// ── Timeline settings: now-line colour + world clock ─────────────────────────
const gear = page.locator('button[aria-label="Settings"]');
await gear.click();
await page.getByRole('menuitem', { name: 'Time lines' }).click();
await page.waitForTimeout(250);
const hasWorldSection = await page.getByText('World time lines').first().isVisible().catch(() => false);
await page.locator('[role="dialog"] input[type="color"]').first().fill('#0000ff');
await page.waitForTimeout(150);
const nowLinesBefore = await page.locator('svg[role="img"] g.now-indicator').count();
await page.locator('[role="dialog"] select').selectOption({ index: 0 });
await page.getByRole('button', { name: 'Add', exact: true }).click();
await page.waitForTimeout(200);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const nowLinesAfter = await page.locator('svg[role="img"] g.now-indicator').count();
const nowLineStroke = await page.locator('svg[role="img"] g.now-indicator line').first().getAttribute('stroke');

// ── Rim memo follows the time across a view switch ───────────────────────────
const pt = await page.evaluate(() => {
  const svg = document.querySelector('svg[role="img"]');
  const ctm = svg.getScreenCTM();
  const p = svg.createSVGPoint();
  p.x = 500 + 490; p.y = 500; // 3 o'clock rim band
  const s = p.matrixTransform(ctm);
  return { x: s.x, y: s.y };
});
await page.mouse.click(pt.x, pt.y);
await page.waitForTimeout(200);
await page.keyboard.type('T');
await page.locator('.rim-memo-text').first().evaluate((el) => el.blur()); // blur without a stray click
await page.waitForTimeout(200);
const boxA = await page.locator('.rim-memo-text').first().boundingBox().catch(() => null);
await page.getByRole('button', { name: /Switch view/ }).first().click();
await page.waitForTimeout(300);
const boxB = await page.locator('.rim-memo-text').first().boundingBox().catch(() => null);
await page.screenshot({ path: path.join(DIR, 'batch7.png') });

await browser.close();

const moved = boxA && boxB ? Math.hypot(boxA.x - boxB.x, boxA.y - boxB.y) : 0;
console.log('ads.txt:', JSON.stringify(adsTxt.trim()));
console.log('weatherInput:', weatherInput, '| worldSection:', hasWorldSection);
console.log('nowLines before/after:', nowLinesBefore, nowLinesAfter, '| stroke:', nowLineStroke);
console.log('rim move px:', Math.round(moved));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const checks = {
  adsTxt: adsTxt.includes('pub-6947130056543786') && adsTxt.includes('DIRECT'),
  weather: weatherInput >= 1,
  timelineSection: hasWorldSection,
  nowLineColor: nowLineStroke === '#0000ff' || nowLineStroke === 'rgb(0, 0, 255)',
  worldClockAddsLine: nowLinesAfter === nowLinesBefore + 1,
  rimFollowsTime: moved > 120,
  noErrors: errors.length === 0,
};
console.log('checks:', JSON.stringify(checks));
const ok = Object.values(checks).every(Boolean);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
