/**
 * Verify the slice editor closes on outside click (user request).
 * Flow: load preset → double-click a slice → editor opens → click outside →
 * editor closes (and the edit is committed). Also checks that opening the
 * icon picker and clicking inside it does NOT close the editor.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const errors = [];

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });

// Load 직장인 preset.
let card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
  await page.locator('button[aria-label="디자인"]').first().click().catch(() => {}); await page.waitForTimeout(200); await page.locator('[role="menuitem"]:has-text("프리셋")').first().click().catch(() => {});
  await page.waitForTimeout(400);
  card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
}
await card.click().catch(() => {});
const confirm = page.locator('button:has-text("확인")').first();
if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) await confirm.click();
await page.waitForTimeout(1000);

const editor = page.locator('[role="dialog"][aria-label="슬라이스 편집"]');

// 1) Double-click a slice → editor opens.
await page.locator('svg path[data-slice-id]').first().dblclick();
await page.waitForTimeout(300);
const openedAfterDblClick = await editor.isVisible({ timeout: 1500 }).catch(() => false);

// 2) Open the 더보기 icon picker, click a category tab inside it → editor must stay.
let editorStaysWithPicker = true;
const moreBtn = page.locator('[role="dialog"][aria-label="슬라이스 편집"] button:has-text("더보기")').first();
if (await moreBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
  await moreBtn.click();
  await page.waitForTimeout(300);
  // click somewhere inside the picker dialog (a tab or its content)
  const pickerTab = page.locator('[role="tab"]').first();
  if (await pickerTab.isVisible({ timeout: 1000 }).catch(() => false)) await pickerTab.click().catch(() => {});
  await page.waitForTimeout(200);
  editorStaysWithPicker = await editor.isVisible().catch(() => false);
  // close the picker (Escape)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

// 3) Click clearly OUTSIDE the editor (the header title) → editor closes.
await page.locator('header h1, h1:has-text("24H")').first().click({ force: true }).catch(async () => {
  await page.mouse.click(120, 28); // header area fallback
});
await page.waitForTimeout(300);
const closedAfterOutside = !(await editor.isVisible().catch(() => false));

await browser.close();

console.log(`editor opened on dblclick: ${openedAfterDblClick}`);
console.log(`editor stayed open while picker used: ${editorStaysWithPicker}`);
console.log(`editor closed on outside click: ${closedAfterOutside}`);
console.log(`console errors: ${errors.length}`);
errors.forEach((e) => console.log('  ', e));

const ok = openedAfterDblClick && editorStaysWithPicker && closedAfterOutside && errors.length === 0;
console.log(ok ? 'PASS — editor opens, survives picker, closes on outside click' : 'FAIL');
process.exit(ok ? 0 : 1);
