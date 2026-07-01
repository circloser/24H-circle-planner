/**
 * Batch 44 (offline, dist-single): goals/mission floating window is TRANSPARENT
 * and DRAGGABLE.
 *  - Opening the widget shows a card with a transparent background.
 *  - The card has a grab cursor and can be dragged to a new spot; the position
 *    persists to localStorage and survives a reload.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 1000 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

// Seed one goal so the widget FAB appears, then reload.
await page.evaluate(() => {
  localStorage.setItem('24h-circle-planner.goals', JSON.stringify({ version: 1, goals: [{ id: 'g1', label: '공부', targetMinutes: 60, period: 'day' }] }));
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(500);

const fab = page.locator('button[aria-label="목표/미션"]').first();
pass('goals FAB present', await fab.isVisible().catch(() => false));
await fab.click();
await wait(300);

const card = page.locator('[data-goals-card="1"]').first();
pass('floating window opens', await card.isVisible().catch(() => false));

const style = await card.evaluate((el) => {
  const cs = getComputedStyle(el);
  return { bg: cs.backgroundColor, cursor: cs.cursor };
});
// Transparent background = rgba(0,0,0,0) (or the keyword 'transparent').
pass('window background is transparent', style.bg === 'rgba(0, 0, 0, 0)' || style.bg === 'transparent', `bg=${style.bg}`);
pass('window shows a grab cursor (movable on hover)', style.cursor === 'grab', `cursor=${style.cursor}`);

// Drag the card from its title area (avoids the close button) to a new spot.
const box0 = await card.boundingBox();
await page.mouse.move(box0.x + 40, box0.y + 12);
await page.mouse.down();
await page.mouse.move(box0.x + 40 - 220, box0.y + 12 - 120, { steps: 10 });
await page.mouse.up();
await wait(300);

const box1 = await card.boundingBox();
const moved = box1 && (Math.abs(box1.x - box0.x) > 100 && Math.abs(box1.y - box0.y) > 60);
pass('window moved after dragging', !!moved, `from=(${Math.round(box0.x)},${Math.round(box0.y)}) to=(${box1 ? Math.round(box1.x) : '?'},${box1 ? Math.round(box1.y) : '?'})`);

const persisted = await page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('24h-circle-planner.goalswidget')); } catch { return null; }
});
pass('dragged position persisted to storage', persisted && typeof persisted.x === 'number' && typeof persisted.y === 'number', JSON.stringify(persisted));

// Survives a reload (reopen → same spot).
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);
await page.locator('button[aria-label="목표/미션"]').first().click();
await wait(300);
const box2 = await page.locator('[data-goals-card="1"]').first().boundingBox();
pass('position restored after reload', box2 && Math.abs(box2.x - box1.x) < 4 && Math.abs(box2.y - box1.y) < 4, `reopened=(${box2 ? Math.round(box2.x) : '?'},${box2 ? Math.round(box2.y) : '?'})`);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
