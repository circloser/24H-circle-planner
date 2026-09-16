/**
 * Calendar mode (top view toggle): two months filling the window, weekend
 * colouring, day numbers centred at the top, all-day vs timed plans, repeats,
 * a hover peek for crowded days, the background setting, and every floating
 * widget hidden while it is on.
 */
import { makeReporter, launchPage, gotoApp, seedBasicData, wait, isMain, runStandalone } from './_helpers.mjs';

const EVENTS_KEY = '24h-circle-planner.events';
const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function run() {
  const { pass, allOk } = makeReporter('calendar');
  const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 900 } });

  const months = () => page.$$eval('[data-calendar-month]', (els) => els.map((e) => e.getAttribute('data-calendar-month')));
  const fabCount = () => page.locator('button[class*="bottom-5"]').count();
  const cell = (key) => page.locator(`[data-day="${key}"]`).first();
  const pickView = async (label) => {
    await page.locator('button[aria-label="보기 선택"]').first().click();
    await wait(250);
    await page.getByRole('menuitemradio', { name: label, exact: true }).click();
    await wait(600);
  };
  /** Add one plan to a day through the dialog. */
  const addPlan = async (key, text, { time, repeat } = {}) => {
    await cell(key).click();
    await wait(350);
    if (time) {
      await page.locator('[data-all-day-off]').click();
      await page.locator('[data-event-time]').fill(time);
    } else {
      await page.locator('[data-all-day-on]').click();
    }
    if (repeat) await page.locator('[data-event-repeat]').selectOption(repeat);
    await page.locator('[data-event-input]').fill(text);
    await page.locator('[data-event-add]').click();
    await wait(250);
    await page.keyboard.press('Escape');
    await wait(300);
  };

  try {
    await gotoApp(page);
    await seedBasicData(page);
    const fabsBefore = await fabCount();

    await pickView('캘린더');
    pass('the view toggle opens calendar mode', (await page.locator('[data-calendar-view]').count()) === 1);

    // 1. Two months, side by side, filling the window.
    const shown = await months();
    const next = (ym) => {
      const [y, m] = ym.split('-').map(Number);
      return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    };
    pass('two months, the second after the first', shown.length === 2 && shown[1] === next(shown[0]), JSON.stringify(shown));
    const fit = await page.evaluate(() => {
      const r = document.querySelector('[data-calendar-view]').getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), vw: window.innerWidth, vh: window.innerHeight };
    });
    pass('it fills the window width', fit.w >= fit.vw - 60, JSON.stringify(fit));
    pass('…and most of its height', fit.h >= fit.vh * 0.55, JSON.stringify(fit));
    const rows = await page.$$eval('[data-calendar-month]', (els) => els.map((e) => e.querySelectorAll('[data-day]').length));
    pass('each month is a full six-week grid', JSON.stringify(rows) === '[42,42]', JSON.stringify(rows));

    // 2. Sunday red, Saturday blue.
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const tones = await page.evaluate((todayKey) => {
      const cells = [...document.querySelectorAll('[data-calendar-month]')[0].querySelectorAll('[data-day]')];
      const at = (mod) => cells.find((c, i) => i % 7 === mod && c.getAttribute('data-day') !== todayKey);
      // Computed colours come back as oklch() in Tailwind v4 — paint each one to
      // read its actual channels.
      const channels = (el) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = getComputedStyle(el.querySelector('span')).color;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      return { sun: channels(at(0)), sat: channels(at(6)) };
    }, today);
    pass('Sunday numbers are red', tones.sun[0] > tones.sun[1] && tones.sun[0] > tones.sun[2], JSON.stringify(tones.sun));
    pass('Saturday numbers are blue', tones.sat[2] > tones.sat[0], JSON.stringify(tones.sat));

    // 3. The day number sits centred at the top of its cell.
    const place = await page.evaluate((key) => {
      const c = document.querySelector(`[data-day="${key}"]`);
      const s = c.querySelector('span');
      const cr = c.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      return { dx: Math.abs((cr.left + cr.width / 2) - (sr.left + sr.width / 2)), dy: sr.top - cr.top };
    }, today);
    pass('the day number is centred at the top', place.dx <= 4 && place.dy <= 14, JSON.stringify(place));

    // 4. All-day vs timed plans look different.
    await addPlan(today, '워크숍');
    await addPlan(today, '팀 회의', { time: '09:30' });
    const allDayChips = await cell(today).locator('[data-event][data-all-day]').count();
    const timed = await cell(today).locator('[data-event]:not([data-all-day])').allInnerTexts();
    pass('an all-day plan is a filled chip', allDayChips === 1);
    pass('a timed plan shows its time with a dot', timed.some((x) => x.includes('09:30') && x.includes('팀 회의')), JSON.stringify(timed));
    const chipBg = await cell(today).locator('[data-event][data-all-day]').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    pass('…and the all-day chip carries a colour', chipBg !== 'rgba(0, 0, 0, 0)', chipBg);

    // 5. A weekly plan shows up again seven days later.
    await addPlan(today, '스터디', { repeat: 'weekly' });
    const inAWeek = keyOf(new Date(Date.now() + 7 * 86400000));
    const weekLater = await cell(inAWeek).locator('[data-event]').allInnerTexts();
    pass('a weekly plan repeats on the next week', weekLater.some((x) => x.includes('스터디')), JSON.stringify(weekLater));

    // 6. A crowded day shows +n and lifts the full list on hover.
    await addPlan(today, '장보기');
    await addPlan(today, '운동');
    const more = await cell(today).locator('text=/^\\+\\d/').count();
    pass('a crowded day shows a "+n" line', more === 1);
    await cell(today).hover();
    await wait(400);
    const peeked = await page.locator('[data-day-peek] [data-event]').count();
    pass('hovering lifts the whole list above the grid', peeked === 5, `chips=${peeked}`);
    await page.mouse.move(5, 300);
    await wait(200);

    // 7. The background setting reaches the grid.
    const cellBg = () => cell(today).evaluate((el) => getComputedStyle(el).backgroundColor);
    const solid = await cellBg();
    await page.locator('[data-cal-bg="clear"]').click();
    await wait(300);
    const clear = await cellBg();
    pass('the transparent setting clears the cell background', clear === 'rgba(0, 0, 0, 0)' && solid !== clear, `${solid} → ${clear}`);
    await page.locator('[data-cal-bg="soft"]').click();
    await wait(300);
    const soft = await cellBg();
    pass('the translucent setting sits between the two', soft !== clear && soft !== solid, soft);
    await page.locator('[data-cal-bg="solid"]').click();
    await wait(300);

    // 8. Plans persist, and both months move together.
    const saved = await page.evaluate((k) => localStorage.getItem(k), EVENTS_KEY);
    pass('plans are saved in their own store', !!saved && saved.includes('스터디'), (saved ?? '').slice(0, 60));
    await page.locator('[data-cal-next]').click();
    await wait(300);
    const moved = await months();
    pass('the arrow moves BOTH months forward', moved[0] === next(shown[0]) && moved[1] === next(shown[1]), JSON.stringify(moved));
    await page.locator('[data-cal-today]').click();
    await wait(300);
    pass('"이번 달" returns to this month', JSON.stringify(await months()) === JSON.stringify(shown));

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('[data-calendar-view]', { timeout: 15000 });
    await wait(700);
    pass('they survive a reload', (await cell(today).locator('[data-event]').count()) >= 3);

    // 9. Widgets step aside while the calendar is on, and come back after.
    pass('all widget buttons are hidden in calendar mode', (await fabCount()) === 0);
    await pickView('24시간');
    pass('leaving calendar mode brings the widgets back', (await fabCount()) === fabsBefore, `${fabsBefore} → ${await fabCount()}`);
    pass('the chart is back', (await page.locator('svg[data-circle-timeline]').count()) === 1);

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
