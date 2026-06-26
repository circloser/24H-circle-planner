/**
 * Batch 22 verification (offline, dist-single): rim memos belong to the diary date.
 *  - "오늘 저장" snapshots the current day's rim memos into the diary entry.
 *  - Loading a diary restores THAT date's rim memos (replacing the active day's),
 *    so they no longer persist across days.
 *  - While the loaded diary is locked, rim memos are read-only (no add ring,
 *    contentEditable off).
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

// Seed a rim memo on the active day, then reload so the layer hydrates it.
const dayId = await page.evaluate(() => JSON.parse(localStorage.getItem('24h-circle-planner.days')).activeId);
await page.evaluate((id) => {
  localStorage.setItem('24h-circle-planner.rimmemos', JSON.stringify({
    version: 1, byDay: { [id]: [{ id: 'rm1', minute: 600, text: 'MEMOA', createdAt: 1 }] },
  }));
}, dayId);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

const seenA = () => page.evaluate(() => [...document.querySelectorAll('.rim-memo-text')].some((b) => (b.innerText || '').includes('MEMOA')));
pass('seeded rim memo shows on chart', await seenA());

async function openDiary() {
  await page.locator('button[aria-label="내 시간표"]').first().click();
  await wait(250);
  await page.locator('[role="menuitem"]:has-text("일기")').first().click();
  await wait(350);
}

// Save today → the entry should capture the rim memo.
await openDiary();
await page.locator('[role="dialog"] button:has-text("오늘 저장")').first().click();
await wait(400);
const saved = await page.evaluate(() => {
  const e = Object.values(JSON.parse(localStorage.getItem('24h-circle-planner.diary')).entries)[0];
  return { n: e.rimMemos?.length ?? -1, t: e.rimMemos?.[0]?.text };
});
pass('diary save captures rim memos', saved.n === 1 && saved.t === 'MEMOA', JSON.stringify(saved));
await page.keyboard.press('Escape').catch(() => {});
await wait(250);

// Add a fresh day (duplicate copies slices only — new day has NO rim memos).
await page.locator('button[aria-label="날짜 추가"]').first().click().catch(() => {});
await wait(300);
await page.locator('[role="dialog"] button:has-text("현재 시간표 복제")').first().click().catch(() => {});
await wait(500);
pass('new day shows no rim memos (not carried over)', !(await seenA()));

// Load the saved diary → its rim memo is restored (belongs to that date).
await openDiary();
await page.locator('[role="dialog"] .grid button:has(svg)').first().click();
await wait(500);

const after = await page.evaluate(() => {
  const memoA = [...document.querySelectorAll('.rim-memo-text')].find((b) => (b.innerText || '').includes('MEMOA'));
  const layer = [...document.querySelectorAll('svg[aria-hidden="true"]')].find((s) => (s.getAttribute('viewBox') || '').startsWith('-36'));
  const band = layer ? layer.querySelector('path') : null;
  return {
    visible: !!memoA,
    editable: memoA ? memoA.getAttribute('contenteditable') : null,
    bandPE: band ? getComputedStyle(band).pointerEvents : null,
  };
});
pass('loading diary restores its rim memos', after.visible, JSON.stringify(after));
pass('locked diary: rim memos read-only', after.editable === 'false');
pass('locked diary: add-ring disabled', after.bandPE === 'none');

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
