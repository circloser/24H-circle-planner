/**
 * Verify the expanded settings: +3 fonts, font-size slider, solid-color picker,
 * image upload, +3 background patterns. Offline single-file build.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];
// 1x1 red PNG (the upload path downscales + re-encodes to JPEG).
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const setReactInput = ({ sel, val }) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
  desc.set.call(el, val);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
};

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

// Load a preset, then open settings.
let card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
  await page.locator('button:has-text("프리셋")').first().click().catch(() => {});
  await page.waitForTimeout(400);
  card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
}
await card.click();
await page.locator('button:has-text("현재 창에 적용")').first().click().catch(() => {});
await page.waitForTimeout(600);
await page.locator('button[aria-label="설정"]').first().click();
await page.waitForTimeout(400);

const read = () => page.evaluate(() => {
  const r = document.documentElement;
  return {
    family: r.style.getPropertyValue('--app-font-family'),
    scale: r.style.getPropertyValue('--app-font-scale'),
    bg: r.getAttribute('data-bg'),
    bgColor: r.style.getPropertyValue('--app-bg-color'),
    bgImage: r.style.getPropertyValue('--app-bg-image').slice(0, 24),
  };
});

// 1) New fonts present + selectable.
const newFontButtons = await page.locator('button:has-text("검은고딕"), button:has-text("고운돋움"), button:has-text("개구")').count();
await page.locator('button:has-text("검은고딕")').first().click();
await page.waitForTimeout(200);
const afterFont = await read();
const fontLoaded = await page.evaluate(() => document.fonts.check("24px 'Black Han Sans'"));

// 2) Font-size slider → 140%.
await page.evaluate(setReactInput, { sel: 'input[type=range]', val: '1.4' });
await page.waitForTimeout(200);
const afterScale = await read();

// 3) New pattern "체크".
await page.locator('button:has-text("체크")').first().click();
await page.waitForTimeout(150);
const afterChecker = await read();

// 4) Solid color picker.
await page.evaluate(setReactInput, { sel: 'input[type=color]', val: '#ff8800' });
await page.waitForTimeout(150);
const afterColor = await read();

// 5) Image upload.
await page.setInputFiles('input[type=file]', {
  name: 'bg.png', mimeType: 'image/png', buffer: Buffer.from(PNG_B64, 'base64'),
});
await page.waitForTimeout(500);
const afterImage = await read();
await page.screenshot({ path: path.join(DIR, 'bg-fonts-settings.png') });

await browser.close();

const result = {
  newFontButtons, afterFont, fontLoaded, afterScale, afterChecker, afterColor, afterImage,
};
console.log(JSON.stringify(result, null, 2));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const ok =
  newFontButtons === 3 &&
  afterFont.family === "'Black Han Sans'" &&
  fontLoaded === true &&
  afterScale.scale === '1.4' &&
  afterChecker.bg === 'checker' &&
  afterColor.bg === 'color' && afterColor.bgColor.trim() === '#ff8800' &&
  afterImage.bg === 'image' && afterImage.bgImage.startsWith('url("data:image/jpeg') &&
  errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
