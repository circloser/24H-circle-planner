/**
 * T19 verification: settings dialog (language/font/background), language switch,
 * font + background apply. Offline single-file build.
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
await page.waitForSelector('svg', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

// Load a preset for context.
let card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
  await page.locator('button:has-text("프리셋")').first().click().catch(() => {});
  await page.waitForTimeout(400);
  card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
}
await card.click();
await page.locator('button:has-text("현재 창에 적용")').first().click().catch(() => {});
await page.waitForTimeout(800);

// Open Settings (gear button, aria-label "설정").
await page.locator('button[aria-label="설정"]').first().click();
await page.waitForTimeout(400);
const settingsVisible = await page.locator('[role="dialog"]:has-text("설정")').first().isVisible({ timeout: 1500 }).catch(() => false);
await page.screenshot({ path: path.join(DIR, 't19-settings.png') });

// Change font family to Jua + size large + background dots.
await page.locator('button:has-text("주아")').first().click().catch(() => {});
await page.locator('button:has-text("크게")').first().click().catch(() => {});
await page.locator('[role="dialog"] button:has-text("도트")').first().click().catch(() => {});
await page.waitForTimeout(300);

// Switch language to English.
await page.locator('button:has-text("English")').first().click().catch(() => {});
await page.waitForTimeout(300);
const headerEnglish = (await page.locator('button:has-text("Export")').count()) > 0;
await page.screenshot({ path: path.join(DIR, 't19-en-font-bg.png') });

// Close settings, screenshot chart with new font/bg.
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(DIR, 't19-chart.png') });

// Read applied CSS vars + bg.
const applied = await page.evaluate(() => {
  const root = document.documentElement;
  return {
    fontFamily: root.style.getPropertyValue('--app-font-family'),
    fontScale: root.style.getPropertyValue('--app-font-scale'),
    bg: root.getAttribute('data-bg'),
    lang: root.getAttribute('lang'),
  };
});

await browser.close();
console.log('settings dialog visible:', settingsVisible);
console.log('header switched to English:', headerEnglish);
console.log('applied prefs:', JSON.stringify(applied));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));
console.log('screenshots: t19-settings, t19-en-font-bg, t19-chart');

const ok = settingsVisible && headerEnglish && applied.bg === 'dots' && applied.fontScale === '1.2' && errors.length === 0;
console.log(ok ? 'PASS' : 'PARTIAL/FAIL');
process.exit(ok ? 0 : 1);
