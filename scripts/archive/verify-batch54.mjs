/**
 * Batch 54 (offline, dist-single): desktop post-it can be MOVED by dragging when
 * not editing, and a plain click focuses it for editing.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(300);

// Seed one visible post-it at a known position.
await page.evaluate(() => {
  const memo = { id: 'm1', text: '드래그 테스트', x: 1250, y: 120, color: '#fef08a', fontFamily: 'Pretendard', align: 'center', createdAt: 1, onScreen: true };
  localStorage.setItem('24h-circle-planner.memos', JSON.stringify({ version: 1, memos: [memo], visible: true }));
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

const note = page.locator('.memo-note').first();
pass('post-it rendered', await note.isVisible().catch(() => false));
const box0 = await note.boundingBox();

// Drag from the CENTRE (over the text) — should move the note (not edit).
const cx = box0.x + box0.width / 2;
const cy = box0.y + box0.height / 2;
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx + 160, cy + 120, { steps: 10 });
await page.mouse.up();
await wait(250);
const box1 = await note.boundingBox();
const moved = box1 && Math.abs(box1.x - box0.x) > 100 && Math.abs(box1.y - box0.y) > 80;
pass('dragging the body (over text) moves the note', !!moved, `from=(${Math.round(box0.x)},${Math.round(box0.y)}) to=(${box1 ? Math.round(box1.x) : '?'},${box1 ? Math.round(box1.y) : '?'})`);
const persisted = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('24h-circle-planner.memos')).memos[0]; } catch { return null; } });
pass('moved position persisted', persisted && persisted.x > 300, `x=${persisted && persisted.x}`);

// A plain click (no drag) focuses the text for editing.
const box2 = await note.boundingBox();
await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 2);
await wait(200);
const editing = await page.evaluate(() => document.activeElement?.classList?.contains('memo-text') ?? false);
pass('a click (no drag) enters edit mode', editing);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
