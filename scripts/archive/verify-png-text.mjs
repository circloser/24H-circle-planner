/**
 * Diagnostic: does the exported PNG contain rendered text for EACH selectable
 * font? Counts near-black pixels (dark chart text on light/pastel fills).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
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

async function pickFont(label) {
  await page.locator('button[aria-label="디자인"]').first().click();
  await page.waitForTimeout(200);
  await page.locator('[role="menuitem"]:has-text("폰트")').first().click();
  await page.waitForTimeout(250);
  await page.locator(`[role="dialog"] button:has-text("${label}")`).first().click();
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

async function exportAndCount(tag) {
  await page.getByRole('button', { name: '내보내기', exact: true }).first().click();
  await page.waitForTimeout(300);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.getByRole('button', { name: 'PNG 내보내기' }).first().click(),
  ]);
  const outPng = path.join(DIR, `export-${tag}.png`);
  await download.saveAs(outPng);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const b64 = fs.readFileSync(outPng).toString('base64');
  const dark = await page.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const W = 500;
    const c = document.createElement('canvas');
    c.width = W; c.height = W;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0, W, W);
    const d = cx.getImageData(0, 0, W, W).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 70 && d[i + 1] < 70 && d[i + 2] < 70 && d[i + 3] > 200) dark++;
    }
    return dark;
  }, 'data:image/png;base64,' + b64);
  return dark;
}

const results = [];
for (const [tag, label] of [['pretendard', 'Pretendard'], ['jua', '주아'], ['blackhan', '검은고딕']]) {
  await pickFont(label);
  const dark = await exportAndCount(tag);
  results.push({ tag, dark, hasText: dark > 400 });
}

await browser.close();
results.forEach((r) => console.log(`${r.tag}: dark=${r.dark} -> ${r.hasText ? 'TEXT PRESENT' : 'TEXT MISSING'}`));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));
process.exit(0);
