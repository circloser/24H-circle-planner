/**
 * Verify the export honours the selected font family AND size: exporting with
 * different prefs must produce different PNG bytes (before the fix everything
 * fell back to Pretendard @100%, so the bytes were identical). Offline build.
 */
import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const errors = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });

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

const setReactRange = (val) => page.evaluate((v) => {
  const el = document.querySelector('[role="dialog"] input[type=range]');
  if (!el) return false;
  const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
  desc.set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, val);

async function openFontDialog() {
  await page.locator('button[aria-label="설정"]').first().click();
  await page.waitForTimeout(200);
  await page.locator('[role="menuitem"]:has-text("폰트")').first().click();
  await page.waitForTimeout(250);
}
async function pickFont(label) {
  await openFontDialog();
  await page.locator(`[role="dialog"] button:has-text("${label}")`).first().click();
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

async function exportPngHash() {
  await page.getByRole('button', { name: '내보내기', exact: true }).first().click();
  await page.waitForTimeout(300);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.getByRole('button', { name: 'PNG 내보내기' }).first().click(),
  ]);
  const p = await download.path();
  const bytes = fs.readFileSync(p);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  return crypto.createHash('sha1').update(bytes).digest('hex');
}

// A: default Pretendard, scale 100%.
await pickFont('Pretendard');
const hashPretendard = await exportPngHash();

// B: Jua, scale 100% → must differ from A (family applied).
await pickFont('주아');
const hashJua = await exportPngHash();

// C: Jua, scale 150% → must differ from B (size applied).
await openFontDialog();
await setReactRange('1.5');
await page.waitForTimeout(150);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const hashJuaBig = await exportPngHash();

await browser.close();

console.log('hash Pretendard@100%:', hashPretendard);
console.log('hash Jua@100%       :', hashJua);
console.log('hash Jua@150%       :', hashJuaBig);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const familyApplied = hashPretendard !== hashJua;
const sizeApplied = hashJua !== hashJuaBig;
console.log('familyApplied (Pretendard≠Jua):', familyApplied, '| sizeApplied (100%≠150%):', sizeApplied);
const ok = familyApplied && sizeApplied && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
