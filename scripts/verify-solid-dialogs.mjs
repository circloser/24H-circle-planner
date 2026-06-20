/**
 * Capture all dialog/popup surfaces to confirm they are SOLID (no see-through
 * transparency/blur): preset gallery cards, preset confirm, slice editor, export.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

// 1) Gallery (auto-opens). Solid cards?
let card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
  await page.locator('button:has-text("프리셋")').first().click().catch(() => {});
  await page.waitForTimeout(400);
  card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
}
await page.screenshot({ path: path.join(DIR, 'solid-1-gallery.png') });

// 2) Preset confirm.
await card.click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(DIR, 'solid-2-confirm.png') });

// Apply it so we have slices to edit/export.
await page.locator('button:has-text("현재 창에 적용")').first().click().catch(() => {});
await page.waitForTimeout(800);

// 3) Slice editor (double-click a slice).
await page.locator('svg path[data-slice-id]').first().dblclick();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(DIR, 'solid-3-editor.png') });
// close editor by clicking header
await page.mouse.click(120, 28);
await page.waitForTimeout(300);

// 4) Export dialog.
await page.locator('button:has-text("내보내기")').first().click().catch(() => {});
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(DIR, 'solid-4-export.png') });

await browser.close();
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));
console.log('screenshots: solid-1-gallery, solid-2-confirm, solid-3-editor, solid-4-export');
process.exit(errors.length === 0 ? 0 : 1);
