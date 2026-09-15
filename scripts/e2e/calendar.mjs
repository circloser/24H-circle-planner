/**
 * Calendar mode (top view toggle): two months side by side, one set of arrows
 * moving both, events typed into a day, and every floating widget hidden while
 * it is on. Events live in their own store, so they survive a reload.
 */
import { makeReporter, launchPage, gotoApp, seedBasicData, wait, isMain, runStandalone } from './_helpers.mjs';

const EVENTS_KEY = '24h-circle-planner.events';

export async function run() {
  const { pass, allOk } = makeReporter('calendar');
  const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 900 } });

  const months = () => page.$$eval('[data-calendar-month]', (els) => els.map((e) => e.getAttribute('data-calendar-month')));
  const fabCount = () => page.locator('button[class*="bottom-5"]').count();
  const pickView = async (label) => {
    await page.locator('button[aria-label="보기 선택"]').first().click();
    await wait(250);
    await page.getByRole('menuitemradio', { name: label, exact: true }).click();
    await wait(600);
  };

  try {
    await gotoApp(page);
    await seedBasicData(page);
    const fabsBefore = await fabCount();
    pass('the timetable view shows its floating widget buttons', fabsBefore > 0, `fabs=${fabsBefore}`);

    // 1. The toggle offers 캘린더 and switches to it.
    await pickView('캘린더');
    pass('the view toggle opens calendar mode', (await page.locator('[data-calendar-view]').count()) === 1);

    // 2. Two months, side by side, the second one after the first.
    const shown = await months();
    const next = (ym) => {
      const [y, m] = ym.split('-').map(Number);
      return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    };
    pass('two months are shown at once', shown.length === 2, JSON.stringify(shown));
    pass('the right one is the month after the left', shown[1] === next(shown[0]), JSON.stringify(shown));
    const side = await page.$$eval('[data-calendar-month]', (els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    pass('they sit left and right, not stacked', side[1] > side[0] + 200, JSON.stringify(side));

    // 3. Every floating widget (and the pet) steps aside.
    pass('all widget buttons are hidden in calendar mode', (await fabCount()) === 0);
    pass('no post-it is left on the canvas', (await page.locator('.memo-note').count()) === 0);

    // 4. Both months move together.
    await page.locator('[data-cal-next]').click();
    await wait(300);
    const moved = await months();
    pass('the arrow moves BOTH months forward', moved[0] === next(shown[0]) && moved[1] === next(shown[1]), JSON.stringify(moved));
    await page.locator('[data-cal-prev]').click();
    await page.locator('[data-cal-prev]').click();
    await wait(300);
    const back = await months();
    pass('and back again', back[0] !== shown[0] && next(back[0]) === shown[0], JSON.stringify(back));
    await page.locator('[data-cal-today]').click();
    await wait(300);
    pass('"이번 달" returns to this month', JSON.stringify(await months()) === JSON.stringify(shown));

    // 5. A plan typed into a day sticks.
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    await page.locator(`[data-day="${today}"]`).first().click();
    await wait(400);
    pass('clicking a day opens its editor', (await page.locator('[data-event-input]').count()) === 1);
    await page.locator('[data-event-input]').fill('치과 예약');
    await page.locator('[data-event-add]').click();
    await wait(300);
    pass('the plan is listed in the editor', (await page.locator('[data-event-row]').count()) === 1);
    await page.keyboard.press('Escape');
    await wait(400);
    const onCell = await page.locator(`[data-day="${today}"] [data-event]`).allInnerTexts();
    pass('…and shows on the day itself', onCell.includes('치과 예약'), JSON.stringify(onCell));

    const saved = await page.evaluate((k) => localStorage.getItem(k), EVENTS_KEY);
    pass('…and is saved in its own store', !!saved && saved.includes('치과 예약'), (saved ?? '').slice(0, 80));

    // 6. It is still there after a reload, and the view is still the calendar.
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('[data-calendar-view]', { timeout: 15000 });
    await wait(600);
    pass('the plan survives a reload', (await page.locator(`[data-day="${today}"] [data-event]`).count()) === 1);

    // 7. Deleting it empties the day again.
    await page.locator(`[data-day="${today}"]`).first().click();
    await wait(400);
    await page.locator('[data-event-del]').first().click();
    await wait(300);
    pass('deleting removes the plan', (await page.locator('[data-event-row]').count()) === 0);
    await page.keyboard.press('Escape');
    await wait(300);

    // 8. Back to the timetable: the widgets return.
    await pickView('24시간');
    pass('leaving calendar mode brings the widgets back', (await fabCount()) === fabsBefore);
    pass('the chart is back', (await page.locator('svg[data-circle-timeline]').count()) === 1);

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
