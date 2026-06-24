/**
 * Verify the slice-editor recommendation chips (IconChips/suggestIcons) show no
 * duplicate emoji. Opens the editor on the 수면 slice (which previously showed 💤
 * twice). Offline single-file build.
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

// Open the editor on the first slice (수면, label 수면 → suggests 💤…).
await page.locator('[data-slice-id]').first().dblclick();
await page.waitForTimeout(300);

// Collect emoji-bearing recommendation buttons inside the editor (exclude 없음/더보기).
const chipEmojis = await page.evaluate(() => {
  const re = /\p{Extended_Pictographic}/u;
  const dlg = [...document.querySelectorAll('[role="dialog"]')]
    .find((d) => (d.getAttribute('aria-label') || '').includes('슬라이스 편집'));
  if (!dlg) return [];
  return [...dlg.querySelectorAll('button')]
    .map((b) => (b.textContent || '').trim())
    .filter((t) => re.test(t));
});
await page.screenshot({ path: path.join(DIR, 'suggest-chips.png') });

await browser.close();

const dup = chipEmojis.length - new Set(chipEmojis).size;
console.log('recommendation chip emojis:', JSON.stringify(chipEmojis));
console.log('duplicate emojis in chips:', dup, '(expect 0)');
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const ok = chipEmojis.length > 0 && dup === 0 && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
