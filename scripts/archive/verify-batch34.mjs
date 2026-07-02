/**
 * Batch 34 (offline, dist-single): edit a loaded diary's note after unlocking.
 *  - Save today's diary with a note.
 *  - Load it (locked) → the note panel is read-only.
 *  - Press 잠금 해제 → the note becomes an editable textarea ("수정 가능").
 *  - Edit + blur → it saves back into the diary entry.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1100, height: 1000 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

// Save today's diary + a note.
await page.locator('button[aria-label="내 시간표"]').first().click();
await wait(200);
await page.locator('[role="menuitem"]:has-text("일기")').first().click();
await wait(350);
await page.locator('button:has-text("오늘 저장")').first().click();
await wait(250);
await page.getByRole('button', { name: '저장', exact: true }).first().click();
await wait(350);
await page.locator('[role="dialog"] textarea').first().fill('원본 노트');
await page.locator('button:has-text("노트 저장")').first().click();
await wait(400);

// Load the saved diary (the only calendar cell with a mini-chart).
await page.locator('[role="dialog"] .grid button').filter({ has: page.locator('svg') }).first().click();
await wait(250);
await page.getByRole('button', { name: '불러오기', exact: true }).first().click();
await wait(500);

// Locked → read-only (no editor textarea on the page now).
const editorWhileLocked = await page.locator('textarea').count();
pass('loaded diary note is read-only when locked', editorWhileLocked === 0, `textareas=${editorWhileLocked}`);

// Unlock via the date pill.
await page.locator('button:has-text("잠금 해제")').first().click();
await wait(400);

const editable = await page.locator('textarea').first().isVisible().catch(() => false);
const chip = await page.locator('text=수정 가능').first().isVisible().catch(() => false);
pass('unlock reveals an editable note + "수정 가능" chip', editable && chip);

// Edit + blur (Tab) → saves.
const ta = page.locator('textarea').first();
await ta.fill('수정된 노트입니다');
await ta.press('Tab');
await wait(450);

const persisted = await page.evaluate(() => {
  try {
    const entries = JSON.parse(localStorage.getItem('24h-circle-planner.diary')).entries;
    return Object.values(entries).some((e) => e.note === '수정된 노트입니다');
  } catch { return false; }
});
pass('edited note saved into the diary entry', persisted);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
