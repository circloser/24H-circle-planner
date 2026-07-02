/**
 * Batch 35 (offline, dist-single): diary note-dot marker + prev/next navigation.
 *  - Seed two diary entries in the current month (one WITH a note, one without).
 *  - Calendar shows a dot only on the noted entry.
 *  - Loading the later one, ◀ goes to the earlier (prev enabled / next disabled),
 *    and at the earliest, ◀ is disabled / ▶ enabled.
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

// Seed two diary entries (current month) — day 05 has a note, day 15 doesn't.
await page.evaluate(() => {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const slice = [{ id: 's1', label: 'A', startTime: '00:00', endTime: '24:00', color: '#60a5fa', icon: '', textPosition: 'inside' }];
  const d1 = `${ym}-05`, d2 = `${ym}-15`;
  const entries = {
    [d1]: { date: d1, name: 'A', slices: slice, note: '노트있음', savedAt: 1 },
    [d2]: { date: d2, name: 'B', slices: slice, savedAt: 2 },
  };
  localStorage.setItem('24h-circle-planner.diary', JSON.stringify({ version: 1, entries }));
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

// Open diary calendar.
await page.locator('button[aria-label="내 시간표"]').first().click();
await wait(200);
await page.locator('[role="menuitem"]:has-text("일기")').first().click();
await wait(400);

const charts = await page.locator('[role="dialog"] .grid button svg').count();
const dots = await page.locator('[role="dialog"] span[aria-label="노트 있음"]').count();
pass('two diary entries shown', charts >= 2, `charts=${charts}`);
pass('only the noted entry has a dot', dots === 1, `dots=${dots}`);

// Load the later entry (day 15).
await page.locator('[role="dialog"] .grid button:has-text("15")').first().click();
await wait(250);
await page.getByRole('button', { name: '불러오기', exact: true }).first().click();
await wait(500);

const prevBtn = page.locator('button[aria-label="이전 일기"]').first();
const nextBtn = page.locator('button[aria-label="다음 일기"]').first();
const p1 = await prevBtn.isDisabled().catch(() => null);
const n1 = await nextBtn.isDisabled().catch(() => null);
pass('at latest diary: prev enabled, next disabled', p1 === false && n1 === true, `prevDis=${p1} nextDis=${n1}`);

await prevBtn.click();
await wait(450);
const p2 = await prevBtn.isDisabled().catch(() => null);
const n2 = await nextBtn.isDisabled().catch(() => null);
pass('after ◀: at earliest, prev disabled, next enabled', p2 === true && n2 === false, `prevDis=${p2} nextDis=${n2}`);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
