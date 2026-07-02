/**
 * Batch 53 (offline, dist-single): goals window text/hover + diary-view write.
 *  2) "목표" label (no "미션").  3) diary hint removed.  4) background only on hover
 *  (transparent right after opening).  1) loading a diary writes the synced view
 *  cursor {diaryDate}; exiting clears it.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const VIEW_KEY = '24h-circle-planner.view';
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

const key = await page.evaluate(() => {
  const slices = [{ id: 'a', label: '수면', startTime: '00:00', endTime: '24:00', color: '#a78bfa', icon: '', textPosition: 'inside' }];
  const day = { id: 'd1', schedule: { id: 's', version: 1, name: '내 하루', presetSource: null, updatedAt: '2026-07-01T00:00:00.000Z', slices } };
  localStorage.setItem('24h-circle-planner.days', JSON.stringify({ version: 1, activeId: 'd1', days: [day] }));
  localStorage.setItem('24h-circle-planner.goals', JSON.stringify({ version: 1, goals: [{ id: 'g1', label: '수면', targetMinutes: 60, period: 'day' }] }));
  localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs: { language: 'ko' } }));
  const now = new Date();
  const k = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
  localStorage.setItem('24h-circle-planner.diary', JSON.stringify({ version: 1, entries: { [k]: { date: k, name: '내 하루', slices, note: '', savedAt: 1 } } }));
  return k;
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

// ── Task 2: FAB + card say just "목표" ──
pass('goals FAB labelled "목표"', await page.locator('button[aria-label="목표"]').first().isVisible().catch(() => false));
await page.locator('button[aria-label="목표"]').first().click();
await wait(300);
const card = page.locator('[data-goals-card="1"]').first();
const titleText = await card.locator('span').first().textContent();
pass('goals card title is "목표"', (titleText || '').trim() === '목표', `title=${titleText}`);

// ── Task 3: diary hint removed ──
pass('diary hint text removed from goals card', !(await card.locator('text=오늘 일기').count()));

// ── Task 4: transparent right after open; background only on hover ──
const bgOpen = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
pass('goals card transparent right after opening (no hover yet)', bgOpen === 'rgba(0, 0, 0, 0)' || bgOpen === 'transparent', `bg=${bgOpen}`);
await card.hover();
await page.mouse.move(820, 600);
await page.mouse.move(830, 610); // small move → pointermove over card
await wait(150);
const bgHover = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
pass('goals card background appears on hover', bgHover !== 'rgba(0, 0, 0, 0)' && bgHover !== 'transparent', `bg=${bgHover}`);
await page.keyboard.press('Escape').catch(() => {});
await page.locator('button[aria-label="목표"]').first().click(); // close card
await wait(200);

// ── Task 1: loading a diary writes the synced view cursor; exiting clears it ──
await page.locator('button[aria-label="내 시간표"]').first().click();
await wait(200);
await page.locator('[role="menuitem"]:has-text("일기")').first().click();
await wait(400);
await page.locator(`button[title="${key}"]`).first().click();
await wait(250);
await page.locator('[role="dialog"] button:has-text("불러오기")').last().click();
await wait(500);
const viewAfterLoad = await page.evaluate((vk) => localStorage.getItem(vk), VIEW_KEY);
pass('loading a diary writes view={diaryDate}', viewAfterLoad === JSON.stringify({ diaryDate: key }), `view=${viewAfterLoad}`);

await page.locator('text=일기 나가기').first().click();
await wait(400);
const viewAfterExit = await page.evaluate((vk) => localStorage.getItem(vk), VIEW_KEY);
pass('exiting the diary clears the view cursor', viewAfterExit === JSON.stringify({ diaryDate: null }), `view=${viewAfterExit}`);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
