/**
 * T18 verification: icon picker on-screen, boundary + above labels, bold
 * non-clipped hour labels, editor without hint.
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

// Load 직장인 preset.
let card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
  await page.locator('button:has-text("프리셋")').first().click().catch(() => {});
  await page.waitForTimeout(400);
  card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
}
await card.click();
await page.locator('button:has-text("현재 창에 적용")').first().click().catch(() => {});
await page.waitForTimeout(900);

// #3: main chart — bold hour labels not clipped.
await page.screenshot({ path: path.join(DIR, 't18-main.png') });

// #2: hover a boundary → + visible above slice labels.
await page.locator('[data-boundary-index="0"] circle[r="16"]').first().hover();
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(DIR, 't18-affordance.png') });

// #4 + #1: open slice editor (double-click), check no hint, then open icon picker.
await page.locator('svg path[data-slice-id]').first().dblclick();
await page.waitForTimeout(300);
const hintGone = (await page.locator('text=Enter 저장').count()) === 0;
await page.screenshot({ path: path.join(DIR, 't18-editor.png') });

// #1: click 더보기 → icon picker fully on-screen.
await page.locator('button:has-text("더보기")').first().click().catch(() => {});
await page.waitForTimeout(400);
const picker = page.locator('[role="dialog"][aria-label="아이콘 선택"], [role="dialog"]:has-text("아이콘 선택")').first();
let pickerOnScreen = false;
const box = await picker.boundingBox().catch(() => null);
if (box) {
  pickerOnScreen = box.x >= 0 && box.y >= 0 && box.x + box.width <= 1200 && box.y + box.height <= 900;
}
await page.screenshot({ path: path.join(DIR, 't18-picker.png') });

await browser.close();
console.log('editor hint removed:', hintGone);
console.log('icon picker box:', box ? `x=${Math.round(box.x)} y=${Math.round(box.y)} w=${Math.round(box.width)} h=${Math.round(box.height)}` : 'not found');
console.log('icon picker fully on-screen (1200x900):', pickerOnScreen);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));
console.log('screenshots: t18-main, t18-affordance, t18-editor, t18-picker');

const ok = hintGone && pickerOnScreen && errors.length === 0;
console.log(ok ? 'PASS' : 'PARTIAL/FAIL');
process.exit(ok ? 0 : 1);
