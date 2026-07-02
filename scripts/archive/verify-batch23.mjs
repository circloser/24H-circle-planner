/**
 * Batch 23 verification (offline, dist-single): diary save/load confirmation.
 *  - Saving (오늘 저장 / tapping a date) asks "일기를 저장하시겠습니까?" first;
 *    cancel aborts, confirm saves.
 *  - Loading a saved day asks "일기를 불러오시겠습니까?" first; cancel keeps the
 *    diary open (not loaded/locked), confirm loads it (locked view).
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1000, height: 1050 } })).newPage();
await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

const entryCount = () => page.evaluate(() => {
  try { return Object.keys(JSON.parse(localStorage.getItem('24h-circle-planner.diary')).entries).length; } catch { return 0; }
});
const visible = (txt) => page.locator(`[role="dialog"]:has-text("${txt}")`).first().isVisible().catch(() => false);

async function openDiary() {
  await page.locator('button[aria-label="내 시간표"]').first().click();
  await wait(250);
  await page.locator('[role="menuitem"]:has-text("일기")').first().click();
  await wait(350);
}

// 1) Save asks first, and does not save until confirmed.
await openDiary();
await page.locator('[role="dialog"] button:has-text("오늘 저장")').first().click();
await wait(300);
pass('save asks for confirmation', await visible('일기를 저장하시겠습니까'));
pass('not saved before confirm', (await entryCount()) === 0, `count=${await entryCount()}`);

// 2) Cancel aborts the save.
await page.getByRole('button', { name: '취소', exact: true }).click();
await wait(300);
pass('cancel aborts save', (await entryCount()) === 0 && (await visible('시간표 일기')), `count=${await entryCount()}`);

// 3) Confirm actually saves.
await page.locator('[role="dialog"] button:has-text("오늘 저장")').first().click();
await wait(300);
await page.getByRole('button', { name: '저장', exact: true }).click();
await wait(400);
pass('confirm saves the entry', (await entryCount()) === 1, `count=${await entryCount()}`);

// 4) Load asks first; cancel keeps the diary open (not loaded/locked).
await page.locator('[role="dialog"] .grid button:has(svg)').first().click();
await wait(300);
pass('load asks for confirmation', await visible('일기를 불러오시겠습니까'));
await page.getByRole('button', { name: '취소', exact: true }).click();
await wait(300);
const lockedAfterCancel = await page.locator('.fixed.bottom-5:has-text("잠금")').first().isVisible().catch(() => false);
pass('cancel aborts load (diary still open, not locked)', (await visible('시간표 일기')) && !lockedAfterCancel);

// 5) Confirm loads it (diary closes, locked pill appears).
await page.locator('[role="dialog"] .grid button:has(svg)').first().click();
await wait(300);
await page.getByRole('button', { name: '불러오기', exact: true }).click();
await wait(500);
const closed = !(await visible('시간표 일기'));
const lockedPill = await page.locator('.fixed.bottom-5:has-text("잠금 해제")').first().isVisible().catch(() => false);
pass('confirm loads it (closed + locked)', closed && lockedPill, `closed=${closed} locked=${lockedPill}`);

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
