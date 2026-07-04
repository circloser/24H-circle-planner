/**
 * Per-weekday default schedules: assign a saved slot to a weekday, and on opening
 * the app on an assigned weekday get a prompt to load it (or keep the current
 * schedule), asked at most once per day.
 */
import { makeReporter, launchPage, gotoApp, wait, isMain, runStandalone } from './_helpers.mjs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';

/** A saved slot whose schedule has a distinctive label, so a load is observable. */
const SLOT = {
  id: 's1', name: '요일 루틴', createdAt: '2026-07-01T00:00:00.000Z',
  schedule: { id: 'sc1', version: 1, name: '요일 루틴', presetSource: null, updatedAt: '2026-07-01T00:00:00.000Z',
    slices: [{ id: 'a', label: '요일테스트', startTime: '00:00', endTime: '24:00', color: '#a78bfa', icon: '', textPosition: 'inside' }] } };
/** The working day currently in the editor (distinct label so a replace shows). */
const DAY = { id: 'd1', schedule: { id: 'd1s', version: 1, name: '원본 시간표', presetSource: null, updatedAt: '2026-07-01T00:00:00.000Z',
  slices: [{ id: 'o', label: '원본라벨', startTime: '00:00', endTime: '24:00', color: '#60a5fa', icon: '', textPosition: 'inside' }] } };

const seedBase = (extra = {}) => `
  localStorage.setItem('24h-circle-planner.onboarded', '1');
  localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs: { language: 'ko' } }));
  localStorage.setItem('24h-circle-planner.slots', JSON.stringify({ version: 1, slots: { s1: ${JSON.stringify(SLOT)} } }));
  localStorage.setItem('24h-circle-planner.days', JSON.stringify({ version: 1, activeId: 'd1', days: [${JSON.stringify(DAY)}] }));
  ${extra.assignToday ? "localStorage.setItem('24h-circle-planner.weekday-schedules', JSON.stringify({ version: 1, byWeekday: { [new Date().getDay()]: 's1' } }));" : ''}
`;

export async function run() {
  const { pass, allOk } = makeReporter('weekday');

  // ── 1) Assignment dialog: pick a slot for Sunday, persisted to localStorage. ──
  {
    const { browser, page, errors } = await launchPage({ locale: 'ko-KR' });
    try {
      await page.addInitScript(seedBase());
      await gotoApp(page, FILE);

      await page.locator('button[aria-label="내 시간표"]').first().click();
      await wait(200);
      await page.locator('[role="menuitem"]:has-text("요일별 기본 시간표")').first().click();
      await wait(400);
      pass('assignment dialog opens with weekday rows', (await page.locator('select[aria-label="일요일"]').count()) > 0);

      await page.locator('select[aria-label="일요일"]').selectOption({ label: '요일 루틴' });
      await wait(200);
      const saved = await page.evaluate(() => {
        try { return JSON.parse(localStorage.getItem('24h-circle-planner.weekday-schedules')).byWeekday['0']; } catch { return null; }
      });
      pass('Sunday assignment persists to localStorage', saved === 's1', `got=${saved}`);
      pass('dialog: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    } finally {
      await browser.close();
    }
  }

  // ── 2) Prompt on an assigned weekday → LOAD replaces the working schedule;
  //       reload does NOT re-prompt the same day. ──
  {
    const { browser, page, errors } = await launchPage({ locale: 'ko-KR' });
    try {
      await page.addInitScript(seedBase({ assignToday: true }));
      await page.goto(FILE, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("svg[role='img']", { timeout: 15000 });
      await wait(400);

      pass('weekday prompt appears', (await page.locator('text=오늘의 기본 시간표').count()) > 0);
      pass('prompt names the assigned slot', (await page.locator('text=요일 루틴').count()) > 0);
      // Before loading, the working schedule shows its own label.
      pass('working schedule shown before load', (await page.locator('svg[role="img"] >> text=원본라벨').count()) > 0);

      await page.locator('[role="dialog"] button:has-text("불러오기")').last().click();
      await wait(600);
      pass("loading replaces the chart with the weekday's schedule", (await page.locator('svg[role="img"] >> text=요일테스트').count()) > 0);

      // Reload — already prompted today → no prompt.
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
      await wait(500);
      pass('no re-prompt after loading (same day)', (await page.locator('text=오늘의 기본 시간표').count()) === 0);
      pass('load flow: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    } finally {
      await browser.close();
    }
  }

  // ── 3) Prompt → "keep current": the working schedule is untouched. ──
  {
    const { browser, page, errors } = await launchPage({ locale: 'ko-KR' });
    try {
      await page.addInitScript(seedBase({ assignToday: true }));
      await page.goto(FILE, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("svg[role='img']", { timeout: 15000 });
      await wait(400);

      pass('prompt appears (keep scenario)', (await page.locator('text=오늘의 기본 시간표').count()) > 0);
      await page.locator('[role="dialog"] button:has-text("현재 유지")').last().click();
      await wait(400);
      pass('keeping leaves the original schedule', (await page.locator('svg[role="img"] >> text=원본라벨').count()) > 0);
      pass("keeping does NOT load the weekday's schedule", (await page.locator('svg[role="img"] >> text=요일테스트').count()) === 0);
      pass('keep flow: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    } finally {
      await browser.close();
    }
  }

  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
