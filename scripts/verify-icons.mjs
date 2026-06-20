/**
 * Verify the three icon changes:
 *  1. Icon picker grid has no duplicate emoji within a category.
 *  2. Global "icons: hide" removes all slice icons from the chart; "show" restores.
 *  3. Editor "없음" (no-icon) clears a slice's icon.
 * Offline single-file build, 직장인 preset.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];

const countEmoji = (page) => page.evaluate(() => {
  const re = /\p{Extended_Pictographic}/u;
  return [...document.querySelectorAll('svg[role="img"] text')]
    .filter((t) => re.test(t.textContent || '')).length;
});

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

// Load 직장인 preset (slices have icons).
let card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('button:has-text("프리셋")').first().click().catch(() => {});
  await page.waitForTimeout(300);
  card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
}
await card.click();
await page.locator('button:has-text("현재 창에 적용")').first().click().catch(() => {});
await page.waitForTimeout(600);

const baseEmoji = await countEmoji(page);

// ── 1. Icon picker dedup ──────────────────────────────────────────────────────
await page.locator('[data-slice-id]').first().dblclick();
await page.waitForTimeout(300);
await page.locator('button:has-text("더보기")').first().click();
await page.waitForTimeout(300);
await page.locator('[role="tab"]:has-text("수면")').first().click();
await page.waitForTimeout(200);
const sleepEmojis = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('[role="dialog"]')]
    .find((d) => (d.textContent || '').includes('아이콘 선택'));
  if (!dlg) return [];
  return [...dlg.querySelectorAll('.grid button')].map((b) => (b.textContent || '').trim());
});
const dupCount = sleepEmojis.length - new Set(sleepEmojis).size;
await page.screenshot({ path: path.join(DIR, 'icons-picker.png') });
await page.keyboard.press('Escape'); // close picker
await page.waitForTimeout(200);
await page.keyboard.press('Escape'); // close editor
await page.waitForTimeout(200);

// ── 2. Global icons toggle ────────────────────────────────────────────────────
await page.locator('button[aria-label="설정"]').first().click();
await page.waitForTimeout(300);
await page.locator('[role="dialog"] button:has-text("숨김")').first().click();
await page.waitForTimeout(250);
const hiddenEmoji = await countEmoji(page);
await page.locator('[role="dialog"] button:has-text("표시")').first().click();
await page.waitForTimeout(250);
const shownEmoji = await countEmoji(page);
await page.keyboard.press('Escape'); // close settings
await page.waitForTimeout(200);

// ── 3. Editor "없음" clears the slice icon ────────────────────────────────────
const beforeNone = await countEmoji(page);
await page.locator('[data-slice-id]').first().dblclick();
await page.waitForTimeout(300);
const noneVisible = await page.locator('[aria-label="아이콘 없음"]').first().isVisible().catch(() => false);
await page.locator('[aria-label="아이콘 없음"]').first().click();
await page.waitForTimeout(150);
// commit via outside click (the header is outside the editor portal)
await page.locator('h1:has-text("24H Circle Planner")').first().click();
await page.waitForTimeout(300);
const afterNone = await countEmoji(page);

await browser.close();

console.log('sleep category emojis:', JSON.stringify(sleepEmojis));
console.log('duplicate emojis in 수면 grid:', dupCount, '(expect 0)');
console.log(`icons: base=${baseEmoji} hidden=${hiddenEmoji} shown=${shownEmoji}`);
console.log('"없음" chip visible:', noneVisible);
console.log(`none: before=${beforeNone} after=${afterNone} (expect after = before-1)`);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const dedupOk = sleepEmojis.length > 0 && dupCount === 0;
const toggleOk = baseEmoji > 0 && hiddenEmoji === 0 && shownEmoji === baseEmoji;
const noneOk = noneVisible && afterNone === beforeNone - 1;
console.log('dedupOk:', dedupOk, '| toggleOk:', toggleOk, '| noneOk:', noneOk);
const ok = dedupOk && toggleOk && noneOk && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
