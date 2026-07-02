/**
 * Verify:
 *  1. Settings split into a gear dropdown of 5 focused dialogs.
 *  2. Slice label text stays dark (#1f2937) even in the dark theme.
 *  3. Editor bold / italic / text-colour apply to a slice label.
 * Offline single-file build, 직장인 preset.
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

let card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('button[aria-label="디자인"]').first().click().catch(() => {}); await page.waitForTimeout(200); await page.locator('[role="menuitem"]:has-text("프리셋")').first().click().catch(() => {});
  await page.waitForTimeout(300);
  card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
}
await card.click();
await page.locator('button:has-text("현재 창에 적용")').first().click().catch(() => {});
await page.waitForTimeout(600);

const labelAttrs = (needle) => page.evaluate((n) => {
  const t = [...document.querySelectorAll('svg[role="img"] text')]
    .find((el) => (el.textContent || '').trim() === n);
  return t ? { fill: t.getAttribute('fill'), weight: t.getAttribute('font-weight'), style: t.getAttribute('font-style') } : null;
}, needle);

// ── 2. Dark theme keeps label text dark ───────────────────────────────────────
const lightFill = (await labelAttrs('수면'))?.fill;
// Cycle the theme toggle (its aria-label reflects the *current* theme, and the
// default may be 'system') until the document is in the dark theme.
const themeToggle = page.locator(
  'button[aria-label="라이트 모드"], button[aria-label="다크 모드"], button[aria-label="시스템 설정"]',
);
let themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
for (let i = 0; i < 3 && themeAttr !== 'dark'; i++) {
  await themeToggle.first().click().catch(() => {});
  await page.waitForTimeout(200);
  themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
}
const darkFill = (await labelAttrs('수면'))?.fill;
await page.screenshot({ path: path.join(DIR, 'textstyle-dark.png') });

// ── 1. Settings gear dropdown → focused dialogs ───────────────────────────────
await page.locator('button[aria-label="디자인"]').first().click();
await page.waitForTimeout(250);
const menuItems = await page.locator('[role="menuitem"]').allTextContents();
await page.locator('[role="menuitem"]:has-text("배경")').first().click();
await page.waitForTimeout(300);
const dlgText = await page.locator('[role="dialog"]').first().innerText().catch(() => '');
const bgFocused = dlgText.includes('도트') && !dlgText.includes('한국어');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// ── 3. Editor bold + italic + text colour ─────────────────────────────────────
await page.locator('[data-slice-id]').first().dblclick();
await page.waitForTimeout(300);
await page.locator('[aria-label="굵게"]').first().click();
await page.locator('[aria-label="기울임"]').first().click();
await page.locator('[aria-label="글자색 #ef4444"]').first().click();
await page.waitForTimeout(150);
await page.locator('h1:has-text("24H Circle Planner")').first().click(); // commit (outside click)
await page.waitForTimeout(350);
const styled = await labelAttrs('수면');
await page.screenshot({ path: path.join(DIR, 'textstyle-editor.png') });

await browser.close();

console.log('label 수면 fill  light:', lightFill, ' dark:', darkFill, ' (theme=', themeAttr, ')');
console.log('settings menu items:', JSON.stringify(menuItems));
console.log('background dialog focused (도트 yes / 한국어 no):', bgFocused);
console.log('after editor styling:', JSON.stringify(styled));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const darkTextOk = lightFill === '#1f2937' && darkFill === '#1f2937' && themeAttr === 'dark';
const splitOk = menuItems.length === 5 && bgFocused;
const styleOk = styled?.fill === '#ef4444' && styled?.weight === '700' && styled?.style === 'italic';
console.log('darkTextOk:', darkTextOk, '| splitOk:', splitOk, '| styleOk:', styleOk);
const ok = darkTextOk && splitOk && styleOk && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
