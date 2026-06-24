/**
 * Batch 21 verification (offline, dist-single): diary protection + date.
 *  - Loading a saved diary enters a LOCKED, protected view; the bottom pill
 *    shows the record's date + an "잠금 해제" toggle.
 *  - While locked: no drag handles, editor won't open, edit attempts toast.
 *  - Unlock → drag handles return and the editor opens (editing re-enabled).
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

async function openDiary() {
  await page.locator('button[aria-label="내 시간표"]').first().click();
  await wait(250);
  await page.locator('[role="menuitem"]:has-text("일기")').first().click();
  await wait(350);
}

// Save today, then reopen and tap the saved day to load it (locked diary view).
await openDiary();
await page.locator('[role="dialog"] button:has-text("오늘 저장")').first().click();
await wait(400);
await page.keyboard.press('Escape').catch(() => {});
await wait(250);
await openDiary();
await page.locator('[role="dialog"] .grid button:has(svg)').first().click();
await wait(500);

// 1) Bottom pill shows the record's date + the unlock toggle (locked).
const pill = (await page.locator('.fixed.bottom-5').first().textContent().catch(() => '')) || '';
const y = await page.evaluate(() => String(new Date().getFullYear()));
const d = await page.evaluate(() => String(new Date().getDate()));
pass('diary date shown in bottom pill', pill.includes(y) && pill.includes(d), `pill="${pill.replace(/\s+/g, ' ').trim()}"`);
pass('lock toggle shows 잠금 해제 (locked)', pill.includes('잠금 해제'));

const slidersLocked = await page.locator('svg[role="img"] [role="slider"]').count();
pass('locked: no drag handles', slidersLocked === 0, `sliders=${slidersLocked}`);

// 2) Editing blocked: double-click a slice → no editor, protected toast.
const target = await page.evaluate(() => {
  const p = document.querySelector('svg[role="img"] path[data-slice-id]');
  const r = p.getBoundingClientRect();
  return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
});
await page.mouse.dblclick(target.cx, target.cy);
await wait(400);
const editorLocked = await page.locator('[role="dialog"][aria-label="슬라이스 편집"]').isVisible().catch(() => false);
const toastShown = await page.evaluate(() => /보호된 일기/.test(document.body.textContent || ''));
pass('locked: editor does not open', !editorLocked);
pass('locked: protected toast shown', toastShown);

// 3) Unlock → editing re-enabled.
await page.locator('button:has-text("잠금 해제")').first().click();
await wait(400);
const slidersUnlocked = await page.locator('svg[role="img"] [role="slider"]').count();
pass('unlock: drag handles return', slidersUnlocked > 0, `sliders=${slidersUnlocked}`);
await page.mouse.dblclick(target.cx, target.cy);
await wait(400);
const editorUnlocked = await page.locator('[role="dialog"][aria-label="슬라이스 편집"]').isVisible().catch(() => false);
pass('unlock: editor opens', editorUnlocked);

// Pill now offers re-lock ("잠금").
const pill2 = (await page.locator('.fixed.bottom-5').first().textContent().catch(() => '')) || '';
pass('unlocked: toggle offers 잠금', pill2.includes('잠금') && !pill2.includes('잠금 해제'));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
