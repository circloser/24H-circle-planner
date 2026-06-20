/**
 * Inspect the preset-card-click confirmation flow.
 * Opens the gallery (auto-opens on first launch), clicks the 학생 card,
 * screenshots, and reports whether a confirm dialog is visible/on-top and
 * whether clicking 확인 applies the preset.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const OUT = path.resolve('.omc/verification/preset-confirm.png');
const errors = [];

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });

// Gallery auto-opens on first launch; if not, click 프리셋.
let card = page.locator('button.glass-card:has(h3:has-text("학생"))').first();
if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
  await page.locator('button:has-text("프리셋")').first().click().catch(() => {});
  await page.waitForTimeout(400);
  card = page.locator('button.glass-card:has(h3:has-text("학생"))').first();
}
const galleryVisible = await card.isVisible().catch(() => false);

// Click the 학생 card → confirm dialog should appear.
await card.click();
await page.waitForTimeout(400);

// Look for the confirm dialog (sequential, non-nested): title "학생 적용" + apply button.
const confirmText = page.locator('text=적용할까요');
const confirmTextVisible = await confirmText.isVisible({ timeout: 1500 }).catch(() => false);
const confirmBtn = page.locator('button:has-text("현재 창에 적용")').first();
const confirmBtnVisible = await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
await page.screenshot({ path: OUT });

// Try clicking 확인 and see if the preset applies (slices appear on the main ring).
let applied = false;
let clickErr = '';
try {
  await confirmBtn.click({ timeout: 2000 });
  await page.waitForTimeout(800);
  const sliceCount = await page.locator('svg path[data-slice-id]').count();
  applied = sliceCount >= 9; // 학생 has 10 slices
} catch (e) {
  clickErr = e.message.split('\n')[0];
}

await browser.close();

console.log(`gallery visible: ${galleryVisible}`);
console.log(`confirm text "기존 시간표가 덮어쓰여집니다" visible: ${confirmTextVisible}`);
console.log(`확인 button visible: ${confirmBtnVisible}`);
console.log(`확인 click applied preset: ${applied}${clickErr ? ' (click error: ' + clickErr + ')' : ''}`);
console.log(`console errors: ${errors.length}`);
errors.forEach((e) => console.log('  ', e));
console.log(`screenshot: ${OUT}`);
