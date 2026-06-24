/**
 * Verify the boundary +/− affordance is actually CLICKABLE (T14 #3).
 * Reproduces the user's flow: hover a boundary handle, move to the "+" button,
 * click it, and assert a slice was added (split happened) — proving the hover
 * bridge keeps the buttons alive across the handle→button gap.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const OUT = path.resolve('.omc/verification/t14-affordance-click.png');
const errors = [];

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });

// Load 직장인 preset (gallery auto-opens on first launch).
let card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
  await page.locator('button[aria-label="디자인"]').first().click().catch(() => {}); await page.waitForTimeout(200); await page.locator('[role="menuitem"]:has-text("프리셋")').first().click().catch(() => {});
  await page.waitForTimeout(400);
  card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
}
await card.click().catch(() => {});
const confirm = page.locator('button:has-text("현재 창에 적용")').first();
if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) await confirm.click();
await page.waitForTimeout(1000);

const before = await page.locator('svg path[data-slice-id]').count();

// Hover boundary handle 0's hit-area to reveal the +/− affordances.
const hitArea = page.locator('[data-boundary-index="0"] circle[r="16"]').first();
await hitArea.hover();
await page.waitForTimeout(200);

const plusBtn = page.locator('[aria-label="오른쪽 칸에 일정 추가"]').first();
const plusVisibleAfterHover = await plusBtn.isVisible({ timeout: 1000 }).catch(() => false);

// Screenshot with the affordance shown.
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await page.screenshot({ path: OUT });

// The real test: click "+" (Playwright moves mouse handle→button across the gap).
let clicked = false;
try {
  await plusBtn.click({ timeout: 2000 });
  clicked = true;
} catch (e) {
  console.log('  click failed:', e.message.split('\n')[0]);
}
await page.waitForTimeout(600);
const after = await page.locator('svg path[data-slice-id]').count();

await browser.close();

console.log(`slices before: ${before}`);
console.log(`"+" visible after hover: ${plusVisibleAfterHover}`);
console.log(`"+" click succeeded: ${clicked}`);
console.log(`slices after click: ${after}`);
console.log(`console errors: ${errors.length}`);
errors.forEach((e) => console.log('  ', e));
console.log(`screenshot: ${OUT}`);

const ok = plusVisibleAfterHover && clicked && after === before + 1 && errors.length === 0;
console.log(ok ? 'PASS — affordance is clickable, split happened' : 'FAIL');
process.exit(ok ? 0 : 1);
