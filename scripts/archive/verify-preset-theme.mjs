/**
 * Verify the preset gallery lets you pick a colour theme + content together:
 * selecting the Ocean theme recolours the previews, and applying a preset loads
 * it with the ocean palette. Offline single-file build.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];
const OCEAN = ['#bae6fd', '#7dd3fc', '#38bdf8', '#5eead4', '#2dd4bf', '#99f6e4', '#a5f3fc', '#67e8f9', '#93c5fd', '#818cf8'];

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

// First-launch gallery should be open; if not, open it.
if (!(await page.locator('[role="dialog"]:has-text("프리셋")').first().isVisible({ timeout: 2000 }).catch(() => false))) {
  await page.locator('button[aria-label="디자인"]').first().click().catch(() => {}); await page.waitForTimeout(200); await page.locator('[role="menuitem"]:has-text("프리셋")').first().click().catch(() => {});
  await page.waitForTimeout(400);
}

// Pick the Ocean (바다) theme — recolours all previews.
await page.locator('[role="dialog"] button:has-text("바다")').first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(DIR, 'preset-theme-gallery.png') });

// Read the 직장인 preview card's slice fills → should be the ocean palette.
const previewFills = await page.evaluate(() => {
  const card = [...document.querySelectorAll('button.glass-card')]
    .find((b) => (b.textContent || '').includes('직장인'));
  if (!card) return [];
  return [...card.querySelectorAll('svg [data-slice-id]')].map((p) => p.getAttribute('fill'));
});

// Apply the 직장인 preset with the ocean theme.
await page.locator('button.glass-card:has(h3:has-text("직장인"))').first().click();
await page.waitForTimeout(400);
await page.locator('button:has-text("현재 창에 적용")').first().click();
await page.waitForTimeout(600);
const appliedFills = await page.evaluate(() =>
  [...document.querySelectorAll('main svg[role="img"] [data-slice-id]')].map((p) => p.getAttribute('fill')));
await page.screenshot({ path: path.join(DIR, 'preset-theme-applied.png') });

await browser.close();

console.log('preview card fills:', JSON.stringify(previewFills));
console.log('applied chart fills:', JSON.stringify(appliedFills));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const isOcean = (fills) => fills.length > 0 && fills.every((c, i) => c?.toLowerCase() === OCEAN[i % OCEAN.length]);
const previewOk = isOcean(previewFills);
const appliedOk = isOcean(appliedFills);
console.log('previewRecolored:', previewOk, '| appliedThemed:', appliedOk);
const ok = previewOk && appliedOk && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
