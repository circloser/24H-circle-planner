/**
 * Batch 42 (offline, dist-single): label icon-hide + no-truncation, and the
 * first-run default dashboard (left clock/calendar + right starter memo).
 *  1. A narrow inside slice HIDES its icon and shows the full name (no "…").
 *  2. A wide inside slice keeps its icon.
 *  3. On a fresh visit the clock + calendar float ON, on the LEFT.
 *  4. On a fresh visit one starter memo sits on the RIGHT with a localized hint.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });

// ── Part A: fresh-visit defaults (#3 clock/calendar left, #4 starter memo right) ──
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
  await page.keyboard.press('Escape').catch(() => {});
  await wait(700); // let the first-run seed effect + persistence settle

  const state = await page.evaluate(() => {
    const j = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
    const ct = j('24h-circle-planner.clocktools');
    const mm = j('24h-circle-planner.memos');
    const memoText = document.querySelector('.memo-text')?.textContent || '';
    return {
      clockOn: ct?.state?.clock?.on ?? null,
      calOn: ct?.state?.calendar?.on ?? null,
      clockX: ct?.state?.clock?.pos?.x ?? null,
      calX: ct?.state?.calendar?.pos?.x ?? null,
      memoCount: Array.isArray(mm?.memos) ? mm.memos.length : -1,
      memoX: mm?.memos?.[0]?.x ?? null,
      memoText: mm?.memos?.[0]?.text ?? '',
      domMemoText: memoText,
      vw: window.innerWidth,
    };
  });

  pass('clock + calendar default ON', state.clockOn === true && state.calOn === true, `clock=${state.clockOn} cal=${state.calOn}`);
  pass('clock + calendar sit on the LEFT', state.clockX != null && state.clockX < 300 && state.calX < 400, `clockX=${state.clockX} calX=${state.calX}`);
  pass('exactly one starter memo seeded', state.memoCount === 1, `count=${state.memoCount}`);
  pass('starter memo on the RIGHT half', state.memoX != null && state.memoX > state.vw / 2, `memoX=${state.memoX} vw=${state.vw}`);
  pass('starter memo has the localized hint', state.memoText.includes('메모') || state.memoText.toLowerCase().includes('memo'), `text=${state.memoText}`);
  pass('starter memo actually rendered on canvas', state.domMemoText.includes('메모') || state.domMemoText.toLowerCase().includes('memo'), `dom=${state.domMemoText}`);
  pass('no page errors (part A)', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ── Part B: label icon-hide (#1) + no truncation (#2) ──
{
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
  await page.keyboard.press('Escape').catch(() => {});
  await wait(300);

  await page.evaluate(() => {
    const slices = [
      { id: 'sleep', label: '수면', startTime: '00:00', endTime: '06:00', color: '#a78bfa', icon: '😴', textPosition: 'inside' },
      { id: 'meet', label: '팀회의보고', startTime: '06:00', endTime: '06:25', color: '#60a5fa', icon: '📅', textPosition: 'inside' },
      { id: 'work', label: '일', startTime: '06:25', endTime: '24:00', color: '#f472b6', icon: '💼', textPosition: 'inside' },
    ];
    const day = { id: 'd1', schedule: { id: 's', version: 1, name: '테스트', presetSource: null, updatedAt: '2026-07-01T00:00:00.000Z', slices } };
    localStorage.setItem('24h-circle-planner.days', JSON.stringify({ version: 1, activeId: 'd1', days: [day] }));
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
  await page.keyboard.press('Escape').catch(() => {});
  await wait(600);

  const info = await page.evaluate(() => {
    const g = (id) => document.querySelector(`[data-label-id="${id}"]`);
    const texts = (el) => (el ? [...el.querySelectorAll('text')].map((t) => t.textContent || '') : []);
    const sleepT = texts(g('sleep'));
    const meetT = texts(g('meet'));
    return {
      sleepJoined: sleepT.join('|'),
      sleepCount: sleepT.length,
      meetJoined: meetT.join('|'),
      meetCount: meetT.length,
    };
  });

  pass('wide slice keeps its icon', info.sleepCount === 2 && info.sleepJoined.includes('😴') && info.sleepJoined.includes('수면'), `[${info.sleepJoined}]`);
  pass('narrow slice HIDES its icon', info.meetCount === 1 && !info.meetJoined.includes('📅'), `count=${info.meetCount} [${info.meetJoined}]`);
  pass('narrow label shows FULL text (no "…")', info.meetJoined === '팀회의보고' && !info.meetJoined.includes('…'), `[${info.meetJoined}]`);
  pass('no page errors (part B)', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
