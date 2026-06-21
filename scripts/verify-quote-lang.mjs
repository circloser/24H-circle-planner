/**
 * Verify post-it seed quotes follow the UI language:
 *   - Default (Korean): a new memo contains Hangul.
 *   - After switching to English: a new memo contains NO Hangul (English quote).
 * Offline single-file build.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];
const HANGUL = /[가-힣]/;

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });
await page.keyboard.press('Escape').catch(() => {}); // dismiss first-launch gallery
await page.waitForTimeout(300);

const addBtn = page.locator('button:has(svg.lucide-sticky-note)').first();
const lastMemoText = () =>
  page.locator('.memo-note').last().locator('.memo-text').innerText();

// ── 1. Korean (default) ───────────────────────────────────────────────────────
await addBtn.click();
await page.waitForTimeout(300);
const koText = await lastMemoText();

// ── Switch language → English ─────────────────────────────────────────────────
await page.locator('button:has(svg.lucide-settings)').first().click();
await page.waitForTimeout(200);
await page.getByRole('menuitem').filter({ hasText: '언어' }).first().click();
await page.waitForTimeout(250);
await page.getByRole('button', { name: 'English', exact: true }).first().click();
await page.waitForTimeout(250);
await page.keyboard.press('Escape').catch(() => {}); // close settings dialog
await page.waitForTimeout(250);

// ── 2. English ────────────────────────────────────────────────────────────────
await addBtn.click();
await page.waitForTimeout(300);
const enText = await lastMemoText();
await page.screenshot({ path: path.join(DIR, 'quote-lang.png') });

await browser.close();

console.log('KO memo:', JSON.stringify(koText));
console.log('EN memo:', JSON.stringify(enText));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const koOk = HANGUL.test(koText) && koText.includes('—');
const enOk = !HANGUL.test(enText) && enText.includes('—') && /[A-Za-z]/.test(enText);
console.log('koOk:', koOk, '| enOk:', enOk);
const ok = koOk && enOk && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
