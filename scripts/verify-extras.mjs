/**
 * Verifies the three new features (offline build, en-US):
 *  1. Mini calendar in the bottom-left clock tools (Today button + month grid).
 *  2. Rim memos: clicking near the chart rim creates an editable note with a
 *     leader line; typed text persists after blur.
 *  3. Memo archive list: add → list shows it; archiving the on-screen note keeps
 *     it in the list; deleting from the list removes it for good.
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
await page.locator('button:has(h3)').first().click();
await page.getByRole('button', { name: 'Apply to current' }).first().click().catch(() => {});
await page.waitForTimeout(400);

// ── 1. Calendar ────────────────────────────────────────────────────────────
const clockFab = page.locator('button[aria-label="Clock tools"]');
await clockFab.click();
await page.waitForTimeout(120);
await page.getByRole('button', { name: 'Calendar', exact: true }).first().click();
await clockFab.click(); // close the popup menu
await page.waitForTimeout(200);
const calendarToday = await page.getByRole('button', { name: 'Today' }).first().isVisible().catch(() => false);

// ── 2. Rim memo ──────────────────────────────────────────────────────────────
const pt = await page.evaluate(() => {
  const svg = document.querySelector('svg[role="img"]');
  const ctm = svg.getScreenCTM();
  const p = svg.createSVGPoint();
  p.x = 500 + 490; // 3 o'clock, within the rim hover band (460..518)
  p.y = 500;
  const s = p.matrixTransform(ctm);
  return { x: s.x, y: s.y };
});
await page.mouse.move(pt.x, pt.y);
await page.waitForTimeout(150);
await page.mouse.click(pt.x, pt.y);
await page.waitForTimeout(200);
const rimAfterClick = await page.locator('.rim-memo-text').count();
await page.keyboard.type('hello rim');
await page.waitForTimeout(120);
await page.mouse.click(640, 27); // click the header to blur
await page.waitForTimeout(200);
const rimText = rimAfterClick > 0 ? (await page.locator('.rim-memo-text').first().innerText()).trim() : '';
const rimPersists = (await page.locator('.rim-memo-text').count()) >= 1;
await page.screenshot({ path: path.join(DIR, 'extras.png') });

// ── 3. Memo archive list ──────────────────────────────────────────────────────
const memoFab = page.locator('button[aria-label="Add memo"]');
await memoFab.click(); // open menu
await page.getByRole('button', { name: 'Add memo', exact: true }).first().click(); // menu "Add memo"
await page.waitForTimeout(250);
const notesAfterAdd = await page.locator('.memo-note').count();

const openList = async () => {
  await memoFab.click();
  await page.getByRole('button', { name: 'Memo list' }).click();
  await page.waitForTimeout(200);
};
await openList();
const listAfterAdd = await page.locator('[role="dialog"] button[aria-label="Hide from screen"]').count();
await page.keyboard.press('Escape');
await page.waitForTimeout(150);

// Archive the on-screen note via its X → leaves the canvas, stays in the list.
await page.locator('.memo-note').first().hover();
await page.locator('.memo-note .memo-del').first().click();
await page.waitForTimeout(150);
const notesAfterArchive = await page.locator('.memo-note').count();
await openList();
const listAfterArchive = await page.locator('[role="dialog"] button[aria-label="Show on screen"]').count();

// Delete from the list → gone for good.
await page.locator('[role="dialog"] button[aria-label="Delete forever"]').first().click();
await page.waitForTimeout(150);
const listAfterDelete = await page.locator('[role="dialog"] [aria-label="Delete forever"]').count();

await browser.close();

console.log('calendarToday:', calendarToday);
console.log('rim: afterClick', rimAfterClick, '| text', JSON.stringify(rimText), '| persists', rimPersists);
console.log('memo: add', notesAfterAdd, '| listAfterAdd', listAfterAdd, '| afterArchive', notesAfterArchive, '| listAfterArchive', listAfterArchive, '| listAfterDelete', listAfterDelete);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const checks = {
  calendar: calendarToday === true,
  rimCreated: rimAfterClick >= 1,
  rimTextPersists: rimText.includes('hello') && rimPersists,
  memoAdded: notesAfterAdd === 1,
  listShowsAdded: listAfterAdd === 1,
  archiveKeepsInList: notesAfterArchive === 0 && listAfterArchive === 1,
  deleteRemovesFromList: listAfterDelete === 0,
  noErrors: errors.length === 0,
};
console.log('checks:', JSON.stringify(checks));
const ok = Object.values(checks).every(Boolean);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
