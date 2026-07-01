/**
 * LIVE check: the bilingual guide pages follow the app language + manual toggle.
 * prefs.language=ko → Korean shown; =en → English shown; header 한국어/EN switches.
 */
import { chromium } from 'playwright';

const URL = 'https://24houring.com/guides/time-blocking';
const results = [];
const pass = (n, ok, x = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${x}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });

async function trial(lang) {
  const ctx = await browser.newContext();
  if (lang) {
    await ctx.addInitScript((l) => {
      try { localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs: { language: l } })); } catch (e) {}
    }, lang);
  }
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await wait(800);
  const showEn = await page.evaluate(() => document.documentElement.classList.contains('show-en'));
  const koVis = await page.locator('main .lang-ko h1').first().isVisible().catch(() => false);
  const enVis = await page.locator('main .lang-en h1').first().isVisible().catch(() => false);
  await ctx.close();
  return { showEn, koVis, enVis };
}

const ko = await trial('ko');
pass('prefs=ko → Korean shown, English hidden', ko.koVis && !ko.enVis && !ko.showEn, JSON.stringify(ko));

const en = await trial('en');
pass('prefs=en → English shown, Korean hidden', en.enVis && !en.koVis && en.showEn, JSON.stringify(en));

// Manual toggle (start ko → click EN → click 한국어).
const ctx = await browser.newContext();
await ctx.addInitScript(() => { try { localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs: { language: 'ko' } })); } catch (e) {} });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
await wait(600);
await page.locator('.langswitch a:has-text("EN")').first().click();
await wait(300);
const afterEn = await page.locator('main .lang-en h1').first().isVisible().catch(() => false);
pass('click EN → English', afterEn);
await page.locator('.langswitch a:has-text("한국어")').first().click();
await wait(300);
const afterKo = await page.locator('main .lang-ko h1').first().isVisible().catch(() => false);
pass('click 한국어 → Korean', afterKo);
await ctx.close();

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
