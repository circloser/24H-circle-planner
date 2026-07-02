/**
 * Batch 48 (offline, dist-single): three diary/boundary UX changes.
 *  1. Saving a diary auto-loads it (locked view) instead of staying on calendar.
 *  2. The boundary "+" affordances are gone; only the "−" (merge) remains.
 *  3. When no diary is loaded (edit mode), a "편집 모드" badge shows at the bottom;
 *     it's replaced by the diary pill once a diary is loaded.
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
await wait(300);

// Seed a 3-slice schedule (so there are boundaries) and reload.
await page.evaluate(() => {
  const slices = [
    { id: 'a', label: '수면', startTime: '00:00', endTime: '08:00', color: '#a78bfa', icon: '', textPosition: 'inside' },
    { id: 'b', label: '일', startTime: '08:00', endTime: '18:00', color: '#f472b6', icon: '', textPosition: 'inside' },
    { id: 'c', label: '휴식', startTime: '18:00', endTime: '24:00', color: '#34d399', icon: '', textPosition: 'inside' },
  ];
  const day = { id: 'd1', schedule: { id: 's', version: 1, name: '테스트', presetSource: null, updatedAt: '2026-07-01T00:00:00.000Z', slices } };
  localStorage.setItem('24h-circle-planner.days', JSON.stringify({ version: 1, activeId: 'd1', days: [day] }));
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(500);

// ── (3) edit-mode badge visible when no diary loaded ──
pass('편집 모드 badge visible in edit mode', await page.locator('text=편집 모드').first().isVisible().catch(() => false));

// ── (2) boundary shows "−" but no "+" ──
await page.locator('[data-boundary-index="0"]').first().hover({ force: true });
await wait(300);
const minusN = await page.locator('[aria-label="이 경계 일정 병합"]').count();
const leftN = await page.locator('[aria-label="왼쪽 칸에 일정 추가"]').count();
const rightN = await page.locator('[aria-label="오른쪽 칸에 일정 추가"]').count();
pass('boundary keeps the "−" merge affordance', minusN >= 1, `minus=${minusN}`);
pass('boundary "+" affordances removed', leftN === 0 && rightN === 0, `left=${leftN} right=${rightN}`);
await page.mouse.move(10, 10);
await wait(200);

// ── (1) saving a diary auto-loads it ──
await page.locator('button[aria-label="내 시간표"]').first().click();
await wait(200);
await page.locator('[role="menuitem"]:has-text("일기")').first().click();
await wait(400);
await page.locator('[role="dialog"] button:has-text("오늘 저장")').first().click();
await wait(300);
// Confirm-save dialog → 저장
await page.locator('[role="dialog"]:has-text("일기 저장") button:has-text("저장")').last().click();
await wait(400);
// Note step → 건너뛰기
await page.locator('[role="dialog"] button:has-text("건너뛰기")').first().click();
await wait(600);

const exitVisible = await page.locator('text=일기 나가기').first().isVisible().catch(() => false);
const editGone = !(await page.locator('text=편집 모드').first().isVisible().catch(() => false));
const dialogGone = !(await page.locator('[role="dialog"]:has-text("오늘 저장")').first().isVisible().catch(() => false));
pass('after save, diary auto-loaded (exit-diary pill shown)', exitVisible);
pass('after save, edit-mode badge replaced by diary pill', editGone);
pass('after save, the calendar dialog closed', dialogGone);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
