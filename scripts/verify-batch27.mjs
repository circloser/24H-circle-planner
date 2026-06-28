/**
 * Batch 27 verification (offline, dist-single): table font-scale + time lines.
 *  - The table text honours the font-size preference (--app-font-scale).
 *  - A horizontal current-time line is drawn in the table; a configured world
 *    clock adds its own labelled line too.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1000, height: 1050 } })).newPage();

const setPref = (patch) => page.evaluate((p) => {
  const KEY = '24h-circle-planner.prefs';
  let env;
  try { env = JSON.parse(localStorage.getItem(KEY)); } catch { /* ignore */ }
  if (!env || env.version !== 1 || !env.prefs) env = { version: 1, prefs: {} };
  Object.assign(env.prefs, p);
  localStorage.setItem(KEY, JSON.stringify(env));
}, patch);

async function gotoTable() {
  await page.waitForSelector('svg[role="img"], ul', { timeout: 15000 }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await wait(300);
  const tg = page.locator('button[aria-label*="보기 전환"]').first();
  for (let i = 0; i < 4; i++) {
    const l = await tg.textContent().catch(() => '');
    if ((l || '').includes('표')) break;
    await tg.click().catch(() => {});
    await wait(220);
  }
  await wait(200);
}
const labelFontPx = () => page.evaluate(() => {
  const el = document.querySelector('ul li span.truncate');
  return el ? parseFloat(getComputedStyle(el).fontSize) : -1;
});

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await gotoTable();

// ── #1 font scale ────────────────────────────────────────────────────────────
await setPref({ fontScale: 1 });
await page.reload({ waitUntil: 'domcontentloaded' });
await gotoTable();
const base = await labelFontPx();
await setPref({ fontScale: 1.6 });
await page.reload({ waitUntil: 'domcontentloaded' });
await gotoTable();
const scaled = await labelFontPx();
pass('table text scales with font-size pref', base > 0 && scaled > base * 1.4, `base=${base} scaled=${scaled}`);

// ── #2a current-time line ─────────────────────────────────────────────────────
const nowHHmm = await page.evaluate(() => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
});
const nowLine = await page.evaluate((hhmm) =>
  [...document.querySelectorAll('ul li span')].some((s) => (s.textContent || '').trim() === hhmm), nowHHmm);
pass('current-time horizontal line shown', nowLine, `now=${nowHHmm}`);

// ── #2b world-clock line ──────────────────────────────────────────────────────
await setPref({ worldClocks: [{ id: 'w1', tz: 'America/New_York', label: 'NYC', color: '#22c55e' }] });
await page.reload({ waitUntil: 'domcontentloaded' });
await gotoTable();
const worldLine = await page.evaluate(() =>
  [...document.querySelectorAll('ul li span')].some((s) => (s.textContent || '').includes('NYC')));
pass('world-clock line shown in table', worldLine);

await page.screenshot({ path: 'scripts/_table-lines.png' });
await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
