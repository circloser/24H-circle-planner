/**
 * Verify (1) language switch translates presets + chart labels + dialogs, and
 * (2) settings option highlight is now visible. Offline single-file build.
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

// First launch may auto-open the preset gallery; close it to reach the main UI.
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(300);

// ── Open settings, switch to English ──────────────────────────────────────────
await page.locator('button[aria-label="설정"]').first().click();
await page.waitForTimeout(300);
await page.locator('button:has-text("English")').first().click();
await page.waitForTimeout(300);

// #2 highlight: the selected language + a selected font must have a solid
// (non-transparent) background; an unselected one must be transparent.
await page.locator('button:has-text("Noto Sans KR")').first().click();
await page.waitForTimeout(150);
const highlight = await page.evaluate(() => {
  const bg = (el) => (el ? getComputedStyle(el).backgroundColor : null);
  const btns = [...document.querySelectorAll('.opt-chip')];
  const enBtn = btns.find((b) => b.textContent.trim() === 'English');
  const koBtn = btns.find((b) => b.textContent.trim() === '한국어');
  const fontBtn = btns.find((b) => b.textContent.includes('Noto Sans KR'));
  return { en: bg(enBtn), ko: bg(koBtn), jua: bg(fontBtn) };
});
await page.screenshot({ path: path.join(DIR, 'i18n-settings-en.png') });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// ── Header now English; open the preset gallery ("Presets") ───────────────────
const headerEnglish = (await page.locator('button:has-text("Presets")').count()) > 0;
await page.locator('button:has-text("Presets")').first().click();
await page.waitForTimeout(500);
const galleryNames = await page.locator('[role="dialog"] h3').allInnerTexts();
await page.screenshot({ path: path.join(DIR, 'i18n-gallery-en.png') });

// Pick the office-worker preset → confirm dialog should be English.
await page.locator('button:has(h3:has-text("Office Worker 9 to 6"))').first().click();
await page.waitForTimeout(400);
const confirmApply = (await page.locator('button:has-text("Apply to current")').count()) > 0;
await page.locator('button:has-text("Apply to current")').first().click();
await page.waitForTimeout(600);

// ── Chart slice labels should now be English ──────────────────────────────────
const svgTexts = await page.locator('svg[role="img"] text').allTextContents();
const joined = svgTexts.join(' | ');
const labelsEnglish = ['Sleep', 'Lunch', 'Morning Work', 'Exercise'].filter((w) => joined.includes(w));
await page.screenshot({ path: path.join(DIR, 'i18n-chart-en.png') });

await browser.close();

const transparent = (c) => !c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
console.log('highlight bg:', JSON.stringify(highlight));
console.log('header English (Presets):', headerEnglish);
console.log('gallery names:', JSON.stringify(galleryNames));
console.log('confirm "Apply to current":', confirmApply);
console.log('English labels found in chart:', JSON.stringify(labelsEnglish));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const highlightOk = !transparent(highlight.en) && !transparent(highlight.jua) && transparent(highlight.ko);
const galleryOk = galleryNames.some((n) => n.includes('Office Worker 9 to 6')) &&
  galleryNames.some((n) => n.includes('Student'));
const labelsOk = labelsEnglish.length >= 2;
const ok = highlightOk && headerEnglish && galleryOk && confirmApply && labelsOk && errors.length === 0;
console.log('highlightOk:', highlightOk, '| galleryOk:', galleryOk, '| labelsOk:', labelsOk);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
