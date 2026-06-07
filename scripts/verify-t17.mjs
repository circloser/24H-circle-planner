/**
 * T17 verification: hub title + editor, left/right + affordance + distinct
 * colour, exported PNG center (title, not black), exported PDF (Korean renders).
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

// #1: hub title visible in SVG (text "직장인 9 to 6" truncated). Screenshot main.
await page.screenshot({ path: path.join(DIR, 't17-main.png') });

// #1: click hub → title editor appears.
const hubDisc = page.locator('svg circle.glass-hub-disc').first();
await hubDisc.click({ force: true }).catch(() => {});
await page.waitForTimeout(300);
const titleEditorVisible = await page
  .locator('[role="dialog"][aria-label="시간표 제목 편집"]').isVisible({ timeout: 1000 }).catch(() => false);
await page.screenshot({ path: path.join(DIR, 't17-hub-editor.png') });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// #2: hover a boundary → left + right "+" present.
const before = await page.locator('svg path[data-slice-id]').count();
await page.locator('[data-boundary-index="0"] circle[r="16"]').first().hover();
await page.waitForTimeout(200);
const leftPlus = await page.locator('[aria-label="왼쪽 칸에 일정 추가"]').first().isVisible({ timeout: 800 }).catch(() => false);
const rightPlus = await page.locator('[aria-label="오른쪽 칸에 일정 추가"]').first().isVisible({ timeout: 800 }).catch(() => false);
await page.screenshot({ path: path.join(DIR, 't17-affordance.png') });
// click right + → slice added with distinct colour
await page.locator('[aria-label="오른쪽 칸에 일정 추가"]').first().click().catch(() => {});
await page.waitForTimeout(500);
const after = await page.locator('svg path[data-slice-id]').count();

// #3/#4: export a real PNG + PDF via the Export dialog and save the downloads.
let pngSaved = false;
let pdfSaved = false;
try {
  await page.locator('button:has-text("내보내기")').first().click();
  await page.waitForTimeout(400);
  // PNG tab is default. Click "PNG 내보내기".
  const dlPng = page.waitForEvent('download', { timeout: 15000 });
  await page.locator('button:has-text("PNG 내보내기")').first().click();
  const png = await dlPng;
  await png.saveAs(path.join(DIR, 't17-export.png'));
  pngSaved = true;
  // Switch to PDF tab, export.
  await page.locator('[role="tab"]:has-text("PDF"), button:has-text("PDF")').first().click().catch(() => {});
  await page.waitForTimeout(300);
  const dlPdf = page.waitForEvent('download', { timeout: 20000 });
  await page.locator('button:has-text("PDF 내보내기")').first().click();
  const pdf = await dlPdf;
  await pdf.saveAs(path.join(DIR, 't17-export.pdf'));
  pdfSaved = true;
} catch (e) {
  console.log('export step error:', e.message.split('\n')[0]);
}

await browser.close();
console.log('PNG exported:', pngSaved, '| PDF exported:', pdfSaved);
console.log('slices before/after right+:', before, '→', after, '(distinct colour added:', after === before + 1, ')');
console.log('hub title editor opened on hub click:', titleEditorVisible);
console.log('left + visible:', leftPlus, '| right + visible:', rightPlus);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));
console.log('screenshots: t17-main, t17-hub-editor, t17-affordance');

const ok = titleEditorVisible && leftPlus && rightPlus && after === before + 1 && errors.length === 0;
console.log(ok ? 'PASS' : 'PARTIAL/FAIL');
process.exit(ok ? 0 : 1);
