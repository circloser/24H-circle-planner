/**
 * Batch 30 (offline, dist-single): diary long-form note.
 *  - Save today's diary → the note step appears → write a note → save.
 *  - Saving auto-loads that diary, so its note shows immediately; exiting the
 *    diary returns to edit mode where the note panel is hidden. Persisted to entry.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const NOTE = '오늘은 A4 두 장 분량 노트 테스트입니다.\n둘째 줄도 보존되어야 합니다.';
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

// Open 내 시간표 → 일기.
await page.locator('button[aria-label="내 시간표"]').first().click();
await wait(200);
await page.locator('[role="menuitem"]:has-text("일기")').first().click();
await wait(400);

// Save today → confirm.
await page.locator('button:has-text("오늘 저장")').first().click();
await wait(300);
await page.getByRole('button', { name: '저장', exact: true }).first().click();
await wait(400);

// Note step appears.
const noteStepVisible = await page.locator('[role="dialog"]:has-text("노트 추가")').first().isVisible().catch(() => false);
pass('note step appears after saving', noteStepVisible);

await page.locator('[role="dialog"] textarea').first().fill(NOTE);
await wait(150);
await page.locator('button:has-text("노트 저장")').first().click();
await wait(600);

// Whether the read-only note panel currently renders the note's first line.
const noteShown = () => page.evaluate((needle) => {
  const els = [...document.querySelectorAll('div')];
  return !!els.find((e) => (e.className || '').includes('whitespace-pre-wrap') && (e.textContent || '').includes(needle.split('\n')[0]));
}, NOTE);

// Saving auto-loads that diary, so its note is shown right away.
pass('note shown right after saving (diary auto-loaded)', (await noteShown()) === true);

// Leave the diary → edit mode → the note panel must disappear.
await page.locator('text=일기 나가기').first().click();
await wait(500);
pass('note NOT shown in edit mode (only in a loaded diary)', (await noteShown()) === false);

// Persisted into the diary entry (+ multi-line preserved), verified via storage.
const stored = await page.evaluate(() => {
  try {
    const e = Object.values(JSON.parse(localStorage.getItem('24h-circle-planner.diary')).entries)[0];
    return e && typeof e.note === 'string' ? e.note : '';
  } catch { return ''; }
});
pass('note persisted in diary entry', stored.includes('A4 두 장'));
pass('multi-line note preserved', stored.includes('둘째 줄'));

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
