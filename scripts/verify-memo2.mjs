/**
 * Verify the reworked post-it: page-curl folded corner (clipped paper + fold
 * flap), and text centred both axes. Offline single-file build.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1100, height: 800 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });
await page.keyboard.press('Escape').catch(() => {}); // close first-launch gallery
await page.waitForTimeout(300);

await page.getByRole('button', { name: '메모 추가' }).first().click();
await page.waitForTimeout(250);

// Type a short multi-line note.
await page.locator('.memo-text').first().click();
await page.keyboard.type('회의 준비\n자료 정리');
await page.waitForTimeout(200);
await page.mouse.move(600, 400); // move away so the toolbar hides for the screenshot
await page.waitForTimeout(200);

const info = await page.evaluate(() => {
  const paper = document.querySelector('.memo-paper');
  const text = document.querySelector('.memo-text');
  const fold = document.querySelector('.memo-fold');
  const cs = text ? getComputedStyle(text) : null;
  return {
    paperClipped: paper ? getComputedStyle(paper).clipPath.includes('polygon') : false,
    foldClipped: fold ? getComputedStyle(fold).clipPath.includes('polygon') : false,
    textAlign: cs?.textAlign,
    display: cs?.display,
    flexDirection: cs?.flexDirection,
    alignItems: cs?.alignItems,
    justifyContent: cs?.justifyContent,
    text: text?.textContent,
  };
});
await page.screenshot({ path: path.join(DIR, 'memo-fold.png'), clip: { x: 0, y: 60, width: 320, height: 320 } });
await page.screenshot({ path: path.join(DIR, 'memo-full.png') });

await browser.close();
console.log('memo info:', JSON.stringify(info, null, 2));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const ok =
  info.paperClipped &&
  info.foldClipped &&
  info.textAlign === 'center' &&
  info.display === 'flex' &&
  info.flexDirection === 'column' &&
  info.alignItems === 'center' &&
  info.justifyContent === 'center' &&
  (info.text || '').includes('회의 준비') &&
  errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
