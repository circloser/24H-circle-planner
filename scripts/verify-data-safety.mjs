/**
 * Verifies the "1단계" data-safety features (offline single-file, en-US):
 *  - SaveIndicator: shows "Saved", flips to "Saving…" on an edit, back to "Saved".
 *  - Backup tab: "Export full backup" downloads a valid {app:'24h-circle-planner'}
 *    JSON containing the app's localStorage keys.
 *  - requestPersistentStorage runs without error (no console errors).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US', acceptDownloads: true });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

// Load a preset.
const card = page.locator('button:has(h3)').first();
if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
  await card.click();
  await page.getByRole('button', { name: 'Apply to current' }).first().click().catch(() => {});
}
await page.waitForTimeout(1600); // past the 800ms "saving" window

const indicator = () => page.locator('header [aria-live="polite"]').first().innerText().catch(() => '');
const savedInitial = await indicator();

// Trigger an edit: split via a boundary "+" affordance (aria-labels are KO even in EN).
await page.locator('[data-boundary-index="0"] circle[r="16"]').first().hover();
await page.waitForTimeout(150);
await page.locator('[aria-label="오른쪽 칸에 일정 추가"]').first().click({ timeout: 2000 }).catch(() => {});
await page.waitForTimeout(150);
const savingDuring = await indicator();
await page.waitForTimeout(1000);
const savedAfter = await indicator();
await page.screenshot({ path: path.join(DIR, 'save-indicator.png') });

// Backup export → capture download.
await page.getByRole('button', { name: 'Export' }).first().click();
await page.waitForTimeout(400);
await page.getByRole('tab', { name: 'Backup' }).first().click();
await page.waitForTimeout(200);
const noteVisible = await page.getByText('Your data lives only in this browser', { exact: false }).isVisible().catch(() => false);

let backupOk = false;
let backupInfo = {};
try {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }),
    page.getByRole('button', { name: 'Export full backup' }).click(),
  ]);
  const dlPath = await download.path();
  const content = fs.readFileSync(dlPath, 'utf8');
  const parsed = JSON.parse(content);
  const keys = Object.keys(parsed.data || {});
  backupInfo = { filename: download.suggestedFilename(), app: parsed.app, keyCount: keys.length, hasPrefs: keys.some((k) => k.includes('.prefs')) };
  backupOk = parsed.app === '24h-circle-planner' && parsed.version === 1 && keys.length >= 2 &&
    keys.every((k) => k.startsWith('24h-circle-planner.'));
} catch (e) {
  backupInfo = { error: String(e).split('\n')[0] };
}
await page.screenshot({ path: path.join(DIR, 'backup-tab.png') });

await browser.close();

console.log('savedInitial:', JSON.stringify(savedInitial));
console.log('savingDuring:', JSON.stringify(savingDuring), '| savedAfter:', JSON.stringify(savedAfter));
console.log('backup noteVisible:', noteVisible, '| backup:', JSON.stringify(backupInfo));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const indicatorOk = /Saved/.test(savedInitial) && /Saving/.test(savingDuring) && /Saved/.test(savedAfter);
const ok = indicatorOk && noteVisible && backupOk && errors.length === 0;
console.log(`indicatorOk:${indicatorOk} backupOk:${backupOk}`);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
