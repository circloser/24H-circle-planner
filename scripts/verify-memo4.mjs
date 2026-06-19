/**
 * Verify:
 *  1. Hovering a memo reveals the top-centre grip.
 *  2. New memos spawn without overlapping the circular timetable.
 *  3. The show/hide toggle hides notes from view without deleting them (storage
 *     keeps the content; toggling back restores them).
 * Offline single-file build.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];
const intersects = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(300);

// ── 2. Spawn avoids the chart ─────────────────────────────────────────────────
const addBtn = page.getByRole('button', { name: '메모 추가' }).first();
for (let i = 0; i < 5; i++) { await addBtn.click(); await page.waitForTimeout(120); }

const overlap = await page.evaluate(() => {
  const chart = document.querySelector('svg[role="img"]').getBoundingClientRect();
  const cr = { x: chart.left, y: chart.top, w: chart.width, h: chart.height };
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  return [...document.querySelectorAll('.memo-note')]
    .map((n) => n.getBoundingClientRect())
    .map((r) => hit({ x: r.left, y: r.top, w: r.width, h: r.height }, cr));
});
void intersects;

// ── 1. Hover reveals the grip ─────────────────────────────────────────────────
const topNote = page.locator('.memo-note').last();
await topNote.hover();
await page.waitForTimeout(150);
const gripOpacity = await topNote.locator('.memo-grip').evaluate((g) => getComputedStyle(g).opacity);
await page.screenshot({ path: path.join(DIR, 'memo-grip.png') });

// ── 3. Hide / show toggle (content preserved) ─────────────────────────────────
const storedCount = () => page.evaluate(() => {
  try {
    const env = JSON.parse(localStorage.getItem('24h-circle-planner.memos') || '{}');
    return Array.isArray(env.memos) ? env.memos.length : -1;
  } catch { return -1; }
});
const beforeStored = await storedCount();
await page.getByRole('button', { name: '메모 숨기기' }).first().click();
await page.waitForTimeout(200);
const renderedWhenHidden = await page.locator('.memo-note').count();
const storedWhenHidden = await storedCount();
await page.getByRole('button', { name: '메모 보이기' }).first().click();
await page.waitForTimeout(200);
const renderedAfterShow = await page.locator('.memo-note').count();

await browser.close();

console.log('memo–chart overlaps:', JSON.stringify(overlap));
console.log('grip opacity on hover:', gripOpacity);
console.log(`stored before/whenHidden: ${beforeStored}/${storedWhenHidden}`);
console.log(`rendered whenHidden/afterShow: ${renderedWhenHidden}/${renderedAfterShow}`);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const spawnOk = overlap.length === 5 && overlap.every((o) => o === false);
const gripOk = gripOpacity === '1';
const toggleOk = beforeStored === 5 && storedWhenHidden === 5 && renderedWhenHidden === 0 && renderedAfterShow === 5;
console.log('spawnOk:', spawnOk, '| gripOk:', gripOk, '| toggleOk:', toggleOk);
const ok = spawnOk && gripOk && toggleOk && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
