/**
 * Verifies (offline single-file, en-US):
 *  #1 Clicking a slice's label (the name) opens the editor.
 *  #2 Hovering a slice shows a translucent cut-preview line at the cursor angle.
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

// Load a preset.
const card = page.locator('button:has(h3)').first();
await card.click();
await page.getByRole('button', { name: 'Apply to current' }).first().click().catch(() => {});
await page.waitForTimeout(700);

// ── #1 Click a slice label → editor opens ─────────────────────────────────────
const editorSel = '[role="dialog"][aria-label="슬라이스 편집"]';
await page.locator('g[data-label-kind="inside"]').first().click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(350);
const editorOpened = await page.locator(editorSel).isVisible().catch(() => false);
await page.screenshot({ path: path.join(DIR, 'cut2-label-edit.png') });
await page.keyboard.press('Escape').catch(() => {});
await page.mouse.click(5, 450).catch(() => {});
await page.waitForTimeout(250);

// ── #2 Hover a slice → cut preview line appears at the cursor angle ────────────
const pt = await page.evaluate(() => {
  const svg = document.querySelector('svg[role="img"]');
  const r = svg.getBoundingClientRect();
  const VB = { x: -36, y: -36, w: 1072, h: 1072 };
  const cx = 500, cy = 500, rad = 410, a = (-45 * Math.PI) / 180;
  const vx = cx + rad * Math.cos(a), vy = cy + rad * Math.sin(a);
  return { sx: r.left + ((vx - VB.x) / VB.w) * r.width, sy: r.top + ((vy - VB.y) / VB.h) * r.height };
});
await page.mouse.move(pt.sx, pt.sy);
await page.mouse.move(pt.sx + 2, pt.sy + 2); // ensure a pointermove fires
await page.waitForTimeout(150);
const previewShown = await page.evaluate(() => {
  const l = document.querySelector('.cut-preview');
  if (!l) return null;
  const cs = getComputedStyle(l);
  return {
    opacity: cs.opacity,
    x1: l.getAttribute('x1'), y1: l.getAttribute('y1'),
    x2: l.getAttribute('x2'), y2: l.getAttribute('y2'),
    len: Math.hypot((+l.getAttribute('x2')) - (+l.getAttribute('x1')), (+l.getAttribute('y2')) - (+l.getAttribute('y1'))),
  };
});
await page.screenshot({ path: path.join(DIR, 'cut2-preview.png') });
// Move off the chart → preview hides.
await page.mouse.move(20, 450);
await page.waitForTimeout(150);
const previewHidden = await page.evaluate(() => getComputedStyle(document.querySelector('.cut-preview')).opacity);

await browser.close();

console.log('#1 editorOpened:', editorOpened);
console.log('#2 previewShown:', JSON.stringify(previewShown), '| hidden opacity:', previewHidden);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const ok1 = editorOpened === true;
const ok2 = !!previewShown && previewShown.opacity === '1' && previewShown.len > 300 && previewHidden === '0';
console.log(`ok1:${ok1} ok2:${ok2}`);
const ok = ok1 && ok2 && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
