/**
 * Verifies the settings "Reset all" flow (offline build, en-US):
 *  - gear menu has a "Reset all" item → opens a confirm warning;
 *  - confirming wipes all app data and reloads to a fresh first-launch state
 *    (preset gallery opens, schedule empty, memos gone).
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

// Create data: load a preset + add a memo.
await page.locator('button:has(h3)').first().click();
await page.getByRole('button', { name: 'Apply to current' }).first().click().catch(() => {});
await page.waitForTimeout(500);
await page.locator('button[aria-label="Add memo"]').last().click();
await page.waitForTimeout(150);
await page.getByText('Add memo').first().click().catch(() => {});
await page.waitForTimeout(300);
const dataBefore = await page.evaluate(() => ({
  slices: document.querySelectorAll('svg[role="img"] path[data-slice-id]').length,
  memos: document.querySelectorAll('.memo-note').length,
  keys: Object.keys(localStorage).filter((k) => k.startsWith('24h-circle-planner.')).length,
}));

// Open gear → Reset all → confirm warning.
await page.locator('button[aria-label="Settings"]').first().click();
await page.waitForTimeout(200);
await page.getByRole('menuitem', { name: 'Reset all' }).first().click();
await page.waitForTimeout(250);
const warningShown = await page.getByText('All data', { exact: false }).first().isVisible().catch(() => false);
await page.screenshot({ path: path.join(DIR, 'reset-confirm.png') });

// Confirm → wipes + reloads.
await page.getByRole('button', { name: 'Reset', exact: true }).first().click();
await page.waitForTimeout(400);
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.waitForTimeout(500);

const after = await page.evaluate(() => {
  const env = JSON.parse(localStorage.getItem('24h-circle-planner.memos') || '{"memos":[]}');
  return {
    galleryOpen: !!document.querySelector('button h3'), // first-launch gallery cards
    memosStored: Array.isArray(env.memos) ? env.memos.length : -1,
  };
});
// Dismiss the gallery → the schedule should be the empty initial (1 slice).
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(300);
const slicesAfter = await page.locator('svg[role="img"] path[data-slice-id]').count();

await browser.close();

console.log('before:', JSON.stringify(dataBefore));
console.log('warningShown:', warningShown);
console.log('after:', JSON.stringify(after), '| slicesAfter:', slicesAfter);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const ok =
  dataBefore.slices > 1 && dataBefore.memos >= 1 &&
  warningShown &&
  after.galleryOpen === true &&   // fresh first-launch
  after.memosStored === 0 &&      // memos wiped
  slicesAfter === 1 &&            // empty initial schedule
  errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
