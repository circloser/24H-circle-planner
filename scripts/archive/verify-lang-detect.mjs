/**
 * #4 — First-launch language follows navigator.language:
 *   - locale ko-KR  → app starts in Korean.
 *   - locale en-US / fr-FR → app starts in English (non-Korean defaults to en).
 * Offline single-file build, fresh storage per context.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const browser = await chromium.launch({ headless: true });

async function langForLocale(locale) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale });
  const page = await ctx.newPage();
  await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
  // The export button's aria-label is the translated header.export string.
  const ko = await page.locator('button[aria-label="내보내기"]').count();
  const en = await page.locator('button[aria-label="Export"]').count();
  await ctx.close();
  return ko > 0 ? 'ko' : en > 0 ? 'en' : 'unknown';
}

const koKR = await langForLocale('ko-KR');
const enUS = await langForLocale('en-US');
const frFR = await langForLocale('fr-FR');

await browser.close();

console.log('ko-KR →', koKR);
console.log('en-US →', enUS);
console.log('fr-FR →', frFR);

const ok = koKR === 'ko' && enUS === 'en' && frFR === 'en';
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
