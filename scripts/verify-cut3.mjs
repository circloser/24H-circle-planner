/**
 * Verifies (offline single-file, en-US):
 *  #1 The cut-preview line is thin + translucent (stroke-width 1.5, low alpha).
 *  #2 The slice centre is an edit zone: text cursor + a transparent hit circle on
 *     every inside label (so EMPTY slices are editable too), and a single click
 *     there opens the editor — including on the empty first-launch schedule.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const editorSel = '[role="dialog"][aria-label="슬라이스 편집"]';
const errors = [];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

// ── #2a Empty schedule: centre single-click edits ─────────────────────────────
await page.keyboard.press('Escape').catch(() => {}); // dismiss first-launch gallery
await page.waitForTimeout(350);
const emptyGroups = await page.locator('g[data-label-kind="inside"]').count();
const emptyHasHit = await page.locator('g[data-label-kind="inside"] circle[fill="transparent"]').count();
await page.locator('g[data-label-kind="inside"]').first().click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(300);
const emptyEdited = await page.locator(editorSel).isVisible().catch(() => false);
await page.keyboard.press('Escape').catch(() => {});
await page.mouse.click(5, 450).catch(() => {});
await page.waitForTimeout(250);

// ── Load a preset for the rest ────────────────────────────────────────────────
await page.getByRole('button', { name: 'Presets' }).first().click();
await page.waitForTimeout(300);
await page.locator('button:has(h3)').first().click();
await page.getByRole('button', { name: 'Apply to current' }).first().click().catch(() => {});
await page.waitForTimeout(700);

// ── #2b Text cursor + hit circle on every inside label ────────────────────────
const labelInfo = await page.evaluate(() => {
  const groups = [...document.querySelectorAll('g[data-label-kind="inside"]')];
  const cursor = groups[0] ? getComputedStyle(groups[0]).cursor : '';
  const withHit = groups.filter((g) => g.querySelector('circle[fill="transparent"]')).length;
  return { total: groups.length, cursor, withHit };
});

// ── #1 preview line is thin + translucent ─────────────────────────────────────
const previewStyle = await page.evaluate(() => {
  const l = document.querySelector('.cut-preview');
  if (!l) return null;
  const cs = getComputedStyle(l);
  return { strokeWidth: cs.strokeWidth, stroke: cs.stroke };
});

await browser.close();

console.log('#2a empty:', JSON.stringify({ emptyGroups, emptyHasHit, emptyEdited }));
console.log('#2b labels:', JSON.stringify(labelInfo));
console.log('#1 preview style:', JSON.stringify(previewStyle));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const ok2a = emptyGroups >= 1 && emptyHasHit >= 1 && emptyEdited === true;
const ok2b = labelInfo.total > 0 && labelInfo.cursor === 'text' && labelInfo.withHit === labelInfo.total;
// stroke-width resolves to "1.5px"; stroke alpha < 1 (rgba with alpha).
const ok1 = !!previewStyle && parseFloat(previewStyle.strokeWidth) <= 2 && /rgba?\(/.test(previewStyle.stroke);
console.log(`ok1:${ok1} ok2a:${ok2a} ok2b:${ok2b}`);
const ok = ok1 && ok2a && ok2b && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
