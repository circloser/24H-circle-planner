/**
 * Google Calendar import (read-only, Pro). Mocks /api/me and /api/ical, then
 * checks that a free account is offered the upgrade instead of the field, that
 * a Pro account can paste an address and see the feed's events laid onto the
 * grid, that those events cannot be dragged, edited or deleted, that a bad
 * address says so, and that disconnecting clears them. Needs dist/ over http.
 */
import { makeReporter, launchPage, serveDist, seedBasicData, wait, isMain, runStandalone } from './_helpers.mjs';

const json = (data, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(data) });
const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const stamp = (key) => key.replace(/-/g, '');
const FEED_URL = 'https://calendar.google.com/calendar/ical/me%40example.com/private-abc/basic.ics';

export async function run() {
  const { pass, allOk } = makeReporter('ical');
  const { base, close } = await serveDist();
  const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 900 } });

  const today = new Date();
  const dayAfter = (n) => keyOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n));
  // A meeting every week from today, and a two-day trip starting the day after.
  const feed = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART;TZID=Asia/Seoul:${stamp(dayAfter(0))}T140000`,
    `DTEND;TZID=Asia/Seoul:${stamp(dayAfter(0))}T150000`,
    'RRULE:FREQ=WEEKLY',
    'UID:meeting@example.com',
    'SUMMARY:구글 주간 회의',
    'END:VEVENT',
    'BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${stamp(dayAfter(1))}`,
    `DTEND;VALUE=DATE:${stamp(dayAfter(3))}`,
    'UID:trip@example.com',
    'SUMMARY:구글 출장',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  let me = { user: { id: 'u1', email: 'me@example.com', provider: 'google' }, plan: 'free', admin: false };
  const asked = [];

  const cell = (key) => page.locator(`[data-day="${key}"]`).first();
  const chips = (key) => cell(key).locator('[data-event]').allInnerTexts();
  const openDialog = async () => {
    await page.locator('[data-ical-open]').click();
    await wait(400);
  };
  const connect = async (url) => {
    await page.locator('[data-ical-input]').fill(url);
    await page.locator('[data-ical-connect]').click();
    await wait(700);
  };
  const reloadCalendar = async () => {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('[data-calendar-view]', { timeout: 15000 });
    await wait(700);
  };

  try {
    // A signed-in account would otherwise be stopped by the sync privacy gate,
    // and an unstubbed /api/sync would answer with the SPA shell.
    await page.addInitScript(() => localStorage.setItem('24h-circle-planner.sync-consent', '1'));
    await page.route('**/api/sync*', (route) => route.fulfill(json({ version: 0, data: {}, updatedAt: 0 })));
    await page.route('**/api/me', (route) => route.fulfill(json(me)));
    await page.route('**/api/ical*', (route) => {
      const url = new URL(route.request().url());
      const target = url.searchParams.get('url') ?? '';
      asked.push(target);
      if (me.plan !== 'pro') return route.fulfill(json({ error: 'pro_required' }, 403));
      if (!target.startsWith('https://calendar.google.com/calendar/ical/')) return route.fulfill(json({ error: 'bad_url' }, 400));
      return route.fulfill({ status: 200, contentType: 'text/calendar; charset=utf-8', body: feed });
    });

    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await seedBasicData(page);
    await page.locator('[data-calendar-toggle]').click();
    await wait(600);

    // 1. Nothing is fetched on its own, and a free account is offered Pro.
    pass('nothing is fetched until an address is given', asked.length === 0, JSON.stringify(asked));
    await openDialog();
    pass('a free account sees the Pro card', (await page.locator('[data-ical-pro]').count()) === 1);
    pass('…and no address field', (await page.locator('[data-ical-input]').count()) === 0);
    await page.keyboard.press('Escape');
    await wait(300);

    // 2. Pro gets the field; a wrong address is reported, not swallowed.
    me = { ...me, plan: 'pro' };
    await reloadCalendar();
    await openDialog();
    pass('a Pro account gets the address field', (await page.locator('[data-ical-input]').count()) === 1);
    await connect('https://example.com/not-a-calendar.ics');
    pass('a wrong address is refused with a reason', (await page.locator('[data-ical-error]').count()) === 1,
      await page.locator('[data-ical-error]').first().innerText().catch(() => ''));

    // 3. The real feed lands on the grid.
    await connect(FEED_URL);
    await page.keyboard.press('Escape');
    await wait(500);
    pass('the feed is fetched through our worker', asked.includes(FEED_URL));
    const mine = dayAfter(0);
    pass('a timed event shows with its time', (await chips(mine)).some((x) => x.includes('14:00') && x.includes('구글 주간 회의')),
      JSON.stringify(await chips(mine)));
    pass('a weekly rule repeats', (await chips(dayAfter(7))).some((x) => x.includes('구글 주간 회의')));
    pass('a span covers its days and stops', (await chips(dayAfter(1))).length > 0 && (await chips(dayAfter(2))).length > 0
      && !(await chips(dayAfter(3))).some((x) => x.includes('구글 출장')),
      JSON.stringify([await chips(dayAfter(1)), await chips(dayAfter(2)), await chips(dayAfter(3))]));
    pass('imported chips are marked as imported', (await cell(mine).locator('[data-event][data-imported]').count()) >= 1);

    // 4. Read-only: not draggable, not editable, not deletable.
    pass('an imported chip has no drag handle', (await cell(dayAfter(1)).locator('[data-drag-handle]').count()) === 0);
    await cell(mine).click();
    await wait(400);
    const row = page.locator('[data-event-row]', { hasText: '구글 주간 회의' });
    pass('its row says it is read-only', (await row.locator('[data-row-imported]').count()) === 1);
    pass('…and offers no edit or delete', (await row.locator('[data-event-edit]').count()) === 0
      && (await row.locator('[data-event-del]').count()) === 0);
    await page.keyboard.press('Escape');
    await wait(300);

    // 5. It survives a reload (cached), and disconnecting removes it.
    await reloadCalendar();
    pass('imported events survive a reload', (await chips(mine)).some((x) => x.includes('구글 주간 회의')));
    const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('ical')));
    pass('the address is kept on the device only', JSON.stringify(stored) === '["24h-circle-planner.ical"]', JSON.stringify(stored));

    await openDialog();
    await page.locator('[data-ical-disconnect]').click();
    await wait(500);
    await page.keyboard.press('Escape');
    await wait(400);
    pass('disconnecting clears the imported events', !(await chips(mine)).some((x) => x.includes('구글 주간 회의')),
      JSON.stringify(await chips(mine)));

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
