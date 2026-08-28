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

// The seed must run ONCE: addInitScript re-runs in EVERY new document, and the
// app spawns same-origin about:blank iframes (lib resize probes) whose re-run
// would silently reset storage to the seed mid-test — clobbering what the app
// itself persisted. A marker key makes it idempotent (and reloads keep state).
const seedBase = (extra = {}) => `
  if (!localStorage.getItem('24h-e2e-weekday-seeded')) {
    localStorage.setItem('24h-e2e-weekday-seeded', '1');
    localStorage.setItem('24h-circle-planner.onboarded', '1');
    localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs: { language: 'ko' } }));
    localStorage.setItem('24h-circle-planner.slots', JSON.stringify({ version: 1, slots: { s1: ${JSON.stringify(SLOT)} } }));
    localStorage.setItem('24h-circle-planner.days', JSON.stringify({ version: 1, activeId: 'd1', days: [${JSON.stringify(DAY)}] }));
    ${extra.assignToday ? "localStorage.setItem('24h-circle-planner.weekday-schedules', JSON.stringify({ version: 1, byWeekday: { [new Date().getDay()]: 's1' } }));" : ''}
    ${extra.promptedToday ? "{ const n = new Date(); localStorage.setItem('24h-circle-planner.weekday-prompted', n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0')); }" : ''}
  }
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

  // ── 2) Assigned weekday AUTO-LOADS on open (no prompt since the auto-load
  //       redesign): the chart shows the slot's schedule, a toast names the
  //       day, and the per-day guard key is written. ──
  {
    const { browser, page, errors } = await launchPage({ locale: 'ko-KR' });
    try {
      await page.addInitScript(seedBase({ assignToday: true }));
      await page.goto(FILE, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("svg[role='img']", { timeout: 15000 });
      await wait(600);

      pass('no prompt dialog (auto-load)', (await page.locator('text=오늘의 기본 시간표').count()) === 0);
      pass("chart auto-loads the weekday's schedule", (await page.locator('svg[role="img"] >> text=요일테스트').count()) > 0);
      // The toast is deliberately deferred ~600ms (fired before <Toaster>
      // mounts, sonner would drop it) — poll briefly instead of a one-shot count.
      const toastSeen = await page.waitForSelector('text=시간표를 불러왔어요', { timeout: 4000 }).then(() => true).catch(() => false);
      pass('toast announces the auto-load', toastSeen);
      const guard = await page.evaluate(() => localStorage.getItem('24h-circle-planner.weekday-prompted'));
      const today = await page.evaluate(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; });
      pass('per-day guard key written', guard === today, `got=${guard}`);

      // Reload — guard set → schedule stays, still no prompt. Persistence of
      // the loaded day is debounced, so poll storage until it lands (≤5s)
      // instead of guessing a delay.
      let persisted = false;
      for (let i = 0; i < 25 && !persisted; i++) {
        persisted = await page.evaluate(() => (localStorage.getItem('24h-circle-planner.days') || '').includes('요일테스트'));
        if (!persisted) await wait(200);
      }
      pass('loaded day flushed to storage', persisted);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
      await wait(500);
      pass('schedule persists across reload', (await page.locator('svg[role="img"] >> text=요일테스트').count()) > 0);
      pass('still no prompt after reload', (await page.locator('text=오늘의 기본 시간표').count()) === 0);
      pass('auto-load flow: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    } finally {
      await browser.close();
    }
  }

  // ── 3) Guard already set for today → auto-load is skipped and the working
  //       schedule is untouched. ──
  {
    const { browser, page, errors } = await launchPage({ locale: 'ko-KR' });
    try {
      await page.addInitScript(seedBase({ assignToday: true, promptedToday: true }));
      await page.goto(FILE, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("svg[role='img']", { timeout: 15000 });
      await wait(600);

      pass('guarded day keeps the original schedule', (await page.locator('svg[role="img"] >> text=원본라벨').count()) > 0);
      pass("guarded day does NOT load the weekday's schedule", (await page.locator('svg[role="img"] >> text=요일테스트').count()) === 0);
      pass('guarded flow: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    } finally {
      await browser.close();
    }
  }

  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
