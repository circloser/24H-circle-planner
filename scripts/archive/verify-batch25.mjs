/**
 * Batch 25 verification (offline, dist-single): table row ops + export.
 *  - Delete (✕) removes a row; a neighbour absorbs its time (stays contiguous).
 *  - Drag handle reorders the sequence and restacks the times (stays contiguous).
 *  - "+ 일정 추가" opens the time-block form.
 *  - CSV / 이미지 buttons download a .csv / .png.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1000, height: 1050 }, acceptDownloads: true })).newPage();
await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

const readSlices = () => page.evaluate(() =>
  JSON.parse(localStorage.getItem('24h-circle-planner.days')).days[0].schedule.slices.map((s) => ({ l: s.label, a: s.startTime, b: s.endTime })));
const contiguous = (sl) => {
  if (sl[0].a !== '00:00') return false;
  for (let i = 0; i < sl.length; i++) {
    const end = sl[i].b === '24:00' ? '00:00' : sl[i].b;
    if (end !== sl[(i + 1) % sl.length].a) return false;
  }
  return true;
};

// → table view (3 toggle clicks).
const toggle = page.locator('button[aria-label*="보기 전환"]').first();
for (let i = 0; i < 3; i++) { await toggle.click(); await wait(220); }
const before = await readSlices();
pass('table shows all demo rows', before.length === 7, `n=${before.length}`);

// Delete row 1 (기상·아침) → 6 rows, contiguous, label gone, neighbour absorbed.
await page.locator('button[aria-label="삭제"]').nth(1).click();
await wait(300);
const afterDel = await readSlices();
pass('delete removes a row + stays contiguous', afterDel.length === 6 && contiguous(afterDel) && !afterDel.some((s) => s.l === '기상·아침'), JSON.stringify(afterDel.map((s) => s.l)));

// Reorder: drag row 0 handle down onto row 3 → order changes, still contiguous,
// durations preserved (total 24h).
const h0 = await page.locator('button[aria-label="순서 변경"]').nth(0).boundingBox();
const row3 = await page.locator('ul li').nth(3).boundingBox();
await page.mouse.move(h0.x + h0.width / 2, h0.y + h0.height / 2);
await page.mouse.down();
await page.mouse.move(h0.x + h0.width / 2, h0.y + 25, { steps: 3 });
await page.mouse.move(row3.x + 30, row3.y + row3.height / 2, { steps: 6 });
await page.mouse.up();
await wait(350);
const afterReorder = await readSlices();
const order0Changed = afterReorder[0].l !== afterDel[0].l;
const sameSet = JSON.stringify([...afterReorder.map((s) => s.l)].sort()) === JSON.stringify([...afterDel.map((s) => s.l)].sort());
pass('drag reorders + restacks (contiguous, same items)', order0Changed && sameSet && contiguous(afterReorder), `order: ${afterReorder.map((s) => s.l).join(',')}`);

// Add row → opens the time-block form.
await page.locator('button:has-text("일정 추가")').first().click();
await wait(350);
const addDialog = await page.locator('[role="dialog"]').first().isVisible().catch(() => false);
pass('“+ 일정 추가” opens the add form', addDialog);
await page.keyboard.press('Escape').catch(() => {});
await wait(200);

// Export is integrated into 내보내기 (table view → 표 이미지 + CSV).
await page.locator('button[aria-label="내보내기"]').first().click();
await wait(400);
let pngOk = false;
try {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.locator('button:has-text("표 이미지로 저장")').first().click()]);
  pngOk = (await dl.suggestedFilename()).endsWith('.png');
} catch { pngOk = false; }
pass('내보내기 → 표 이미지 downloads .png', pngOk);

await page.locator('[role="tab"]:has-text("CSV")').first().click();
await wait(250);
let csvOk = false;
try {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.locator('button:has-text("CSV로 저장")').first().click()]);
  csvOk = (await dl.suggestedFilename()).endsWith('.csv');
} catch { csvOk = false; }
pass('내보내기 → CSV downloads .csv', csvOk);

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
