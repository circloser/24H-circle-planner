/**
 * Verify:
 *  1. The clock settings section toggles the center digital clock and the red
 *     current-time line independently.
 *  2. The header has a solid/frosted (non-transparent) background.
 * Offline single-file build, 직장인 preset.
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
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

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

const counts = () => page.evaluate(() => ({
  clock: document.querySelectorAll('[data-clock]').length,
  nowLine: document.querySelectorAll('svg .now-indicator').length,
}));

// ── 2. Header background is non-transparent + frosted ─────────────────────────
const header = await page.evaluate(() => {
  const h = document.querySelector('header');
  if (!h) return null;
  const cs = getComputedStyle(h);
  return { bg: cs.backgroundColor, backdrop: cs.backdropFilter || cs.webkitBackdropFilter, position: cs.position };
});

// ── 1. Clock + now-line toggles ───────────────────────────────────────────────
const before = await counts();

async function openClockSettings() {
  await page.locator('button[aria-label="설정"]').first().click();
  await page.waitForTimeout(200);
  await page.locator('[role="menuitem"]:has-text("시계")').first().click();
  await page.waitForTimeout(250);
}

// Hide digital clock.
await openClockSettings();
// First section = 디지털 시계 → its 숨김 is the first 숨김 button.
await page.locator('[role="dialog"] button:has-text("숨김")').first().click();
await page.waitForTimeout(150);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const afterClockHidden = await counts();

// Hide now-line (second section's 숨김).
await openClockSettings();
await page.locator('[role="dialog"] button:has-text("숨김")').nth(1).click();
await page.waitForTimeout(150);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const afterBothHidden = await counts();
await page.screenshot({ path: path.join(DIR, 'clock-hidden.png') });

// Re-show both.
await openClockSettings();
await page.locator('[role="dialog"] button:has-text("표시")').nth(0).click();
await page.locator('[role="dialog"] button:has-text("표시")').nth(1).click();
await page.waitForTimeout(150);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const afterReshown = await counts();
await page.screenshot({ path: path.join(DIR, 'clock-header.png') });

await browser.close();

console.log('header:', JSON.stringify(header));
console.log('counts before     :', JSON.stringify(before));
console.log('counts clock hidden:', JSON.stringify(afterClockHidden));
console.log('counts both hidden :', JSON.stringify(afterBothHidden));
console.log('counts re-shown    :', JSON.stringify(afterReshown));
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const transparent = (c) => !c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
const headerOk = header && !transparent(header.bg) && (header.backdrop || '').includes('blur') && header.position === 'sticky';
const clockToggleOk = before.clock === 1 && afterClockHidden.clock === 0 && afterReshown.clock === 1;
const nowLineToggleOk = before.nowLine === 1 && afterClockHidden.nowLine === 1 && afterBothHidden.nowLine === 0 && afterReshown.nowLine === 1;
console.log('headerOk:', headerOk, '| clockToggleOk:', clockToggleOk, '| nowLineToggleOk:', nowLineToggleOk);
const ok = headerOk && clockToggleOk && nowLineToggleOk && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
