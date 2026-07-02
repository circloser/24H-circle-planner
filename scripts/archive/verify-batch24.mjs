/**
 * Batch 24 verification (offline, dist-single): table view + linked time edits.
 *  - The view toggle cycles 24h → 12h day → 12h night → table → 24h.
 *  - The table lists one row per slice (start ~ end · label).
 *  - Editing a row's END time moves the next row's START (shared boundary);
 *    editing a START moves the previous row's END — neighbours stay linked.
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

const toggle = page.locator('button[aria-label*="보기 전환"]').first();
const ends = page.locator('input[aria-label="끝 시간"]');
const starts = page.locator('input[aria-label="시작 시간"]');
const chartVisible = () => page.locator('svg[role="img"]').first().isVisible().catch(() => false);

// Cycle: full → day → night → table (3 clicks).
for (let i = 0; i < 3; i++) { await toggle.click(); await wait(250); }
const rowCount = await ends.count();
pass('toggle reaches table after 3 clicks', rowCount >= 5, `rows=${rowCount}`);
pass('table hides the circular chart', !(await chartVisible()));
const label0 = (await toggle.textContent()) || '';
pass('toggle label shows 표', label0.includes('표'), `label="${label0.trim()}"`);

// Demo: row0 수면 00:00~07:00, row1 기상·아침 07:00~08:00.
const r0end = await ends.nth(0).inputValue();
const r1start = await starts.nth(1).inputValue();
pass('row0 end == row1 start (shared boundary)', r0end === r1start, `${r0end} / ${r1start}`);

// Edit row0 END 07:00 → 06:00; row1 START must follow to 06:00.
await ends.nth(0).fill('06:00');
await ends.nth(0).press('Enter');
await wait(300);
pass('editing END moves next row START', (await starts.nth(1).inputValue()) === '06:00', `r1start=${await starts.nth(1).inputValue()}`);

// Edit row2 START (오전 업무 08:00) → 09:00; row1 END must follow to 09:00.
await starts.nth(2).fill('09:00');
await starts.nth(2).press('Enter');
await wait(300);
pass('editing START moves prev row END', (await ends.nth(1).inputValue()) === '09:00', `r1end=${await ends.nth(1).inputValue()}`);

// Persisted to the store (schedule reflects the edits).
const slices = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('24h-circle-planner.days')).days[0].schedule.slices;
  return s.map((x) => `${x.startTime}-${x.endTime}`);
});
pass('store reflects linked edits', slices.includes('00:00-06:00') && slices.includes('06:00-09:00'), JSON.stringify(slices.slice(0, 3)));

await page.screenshot({ path: 'scripts/_table.png' });

// One more click → back to 24h chart.
await toggle.click();
await wait(300);
pass('next click returns to chart', (await chartVisible()) && (await ends.count()) === 0);

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
