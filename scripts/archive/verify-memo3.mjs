/**
 * Verify the post-it improvements:
 *  - new note seeded with a random quote (— author line)
 *  - spawns at a random viewport position (3 notes ⇒ different spots)
 *  - no grip dots
 *  - hover reveals a top-right × that deletes the note
 * Offline single-file build.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(300);

const addBtn = page.getByRole('button', { name: '메모 추가' }).first();
for (let i = 0; i < 3; i++) {
  await addBtn.click();
  await page.waitForTimeout(150);
}

const state = await page.evaluate(() => {
  const notes = [...document.querySelectorAll('.memo-note')];
  return {
    count: notes.length,
    positions: notes.map((n) => `${n.style.left},${n.style.top}`),
    texts: notes.map((n) => n.querySelector('.memo-text')?.innerText ?? ''),
    hasGrip: !!document.querySelector('.memo-grip'),
  };
});

// Hover the TOPMOST (last) note → its × becomes visible; clicking removes it.
// (Random notes can overlap; the last one paints on top, so its × is clickable.)
const topNote = page.locator('.memo-note').last();
await topNote.hover();
await page.waitForTimeout(150);
const delOpacity = await topNote.locator('.memo-del').evaluate((d) => getComputedStyle(d).opacity);
await page.screenshot({ path: path.join(DIR, 'memo-quote.png') });
await topNote.locator('.memo-del').click();
await page.waitForTimeout(200);
const countAfterDelete = await page.locator('.memo-note').count();

await browser.close();

console.log('count:', state.count);
console.log('positions:', JSON.stringify(state.positions));
console.log('texts:', JSON.stringify(state.texts));
console.log('hasGrip:', state.hasGrip, '| del opacity on hover:', delOpacity, '| count after delete:', countAfterDelete);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const quotesOk = state.texts.length === 3 && state.texts.every((t) => t.includes('—') && t.length > 6);
const randomOk = new Set(state.positions).size >= 2; // not all identical
const noGrip = state.hasGrip === false;
const deleteOk = delOpacity === '1' && countAfterDelete === 2;
console.log('quotesOk:', quotesOk, '| randomOk:', randomOk, '| noGrip:', noGrip, '| deleteOk:', deleteOk);
const ok = quotesOk && randomOk && noGrip && deleteOk && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
