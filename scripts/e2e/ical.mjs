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
const FEED2_URL = 'https://calendar.google.com/calendar/ical/team%40example.com/private-def/basic.ics';

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
    'X-WR-CALNAME:내 캘린더',
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
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20190105',
    'UID:ancient@example.com',
    'SUMMARY:오래전 일정',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  // A second calendar, shown beside the first in its own tone.
  const feed2 = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'X-WR-CALNAME:팀 캘린더',
    'BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${stamp(dayAfter(4))}`,
    'UID:team@example.com',
    'SUMMARY:팀 워크숍',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  let me = { user: { id: 'u1', email: 'me@example.com', provider: 'google' }, plan: 'free', admin: false };
  const asked = [];
  const urlLeaks = [];
  const windows = [];

  const cell = (key) => page.locator(`[data-day="${key}"]`).first();
  const chips = (key) => cell(key).locator('[data-event]').allInnerTexts();
  const openDialog = async () => {
    await page.locator('[data-ical-open]').click();
    await wait(400);
  };
  const connect = async (url) => {
    await page.locator('[data-ical-input]').fill(url);
    await page.locator('[data-ical-connect]').click();
    await wait(900);
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
      const req = route.request();
      const sent = (() => {
        try { return JSON.parse(req.postData() || '{}'); } catch { return {}; }
      })();
      const target = sent.url ?? '';
      asked.push(target);
      windows.push({ from: sent.from, to: sent.to });
      // The address is a credential: it must never ride in the URL.
      if (new URL(req.url()).search) urlLeaks.push(req.url());
      if (me.plan !== 'pro') return route.fulfill(json({ error: 'pro_required' }, 403));
      if (!target.startsWith('https://calendar.google.com/calendar/ical/')) return route.fulfill(json({ error: 'bad_url' }, 400));
      return route.fulfill({
        status: 200,
        contentType: 'text/calendar; charset=utf-8',
        body: target === FEED2_URL ? feed2 : feed,
      });
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

    // 2. Pro without a passphrase is asked for one FIRST — the address syncs,
    //    so it may only go up once this device can encrypt what it uploads.
    me = { ...me, plan: 'pro' };
    await reloadCalendar();
    await openDialog();
    pass('a Pro account with no passphrase is asked for one', (await page.locator('[data-ical-locked]').count()) === 1);
    pass('…and gets no address field until then', (await page.locator('[data-ical-input]').count()) === 0);
    await page.keyboard.press('Escape');
    await wait(300);

    // 3. With the diary lock on, the field appears.
    await page.evaluate(() => {
      localStorage.setItem('24h-circle-planner.e2ee-key', JSON.stringify({ keyB64: 'x', saltB64: 'y' }));
      window.dispatchEvent(new Event('24h:e2ee-changed'));
    });
    await reloadCalendar();
    await openDialog();
    pass('a locked device gets the address field', (await page.locator('[data-ical-input]').count()) === 1);
    await connect('https://example.com/not-a-calendar.ics');
    pass('a wrong address is refused with a reason', (await page.locator('[data-ical-error]').count()) === 1,
      await page.locator('[data-ical-error]').first().innerText().catch(() => ''));
    pass('…and is not left behind as a calendar', (await page.locator('[data-ical-row]').count()) === 0);

    // 3. The real feed lands on the grid.
    await connect(FEED_URL);
    await page.keyboard.press('Escape');
    await wait(500);
    pass('the feed is fetched through our worker', asked.includes(FEED_URL));
    // The feed arrives whole; the device keeps only the months around today.
    const kept = await page.evaluate(() => localStorage.getItem('24h-circle-planner.ical-cache') ?? '');
    pass('the device keeps only the months around today, not years of history',
      kept.includes('meeting@example.com') && !kept.includes('ancient@example.com'),
      JSON.stringify({ hasCurrent: kept.includes('meeting@example.com'), hasAncient: kept.includes('ancient@example.com') }));
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

    // 4b. A second calendar joins the first, in its own tone.
    await openDialog();
    await connect(FEED2_URL);
    pass('both calendars are listed', (await page.locator('[data-ical-row]').count()) === 2);
    const names = await page.locator('[data-ical-row]').allInnerTexts();
    pass('…by the names the feeds give', names.join(' ').includes('내 캘린더') && names.join(' ').includes('팀 캘린더'),
      JSON.stringify(names));
    await page.keyboard.press('Escape');
    await wait(500);
    pass('the second calendar shows on the grid too', (await chips(dayAfter(4))).some((x) => x.includes('팀 워크숍')),
      JSON.stringify(await chips(dayAfter(4))));
    // The outline is painted as a box-shadow, so that is where the tone lives.
    const tones = await page.evaluate(([a, b]) => {
      const at = (key) => document.querySelector(`[data-day="${key}"] [data-event][data-imported]`);
      const tone = (el) => (el ? getComputedStyle(el).boxShadow : '');
      return [tone(at(a)), tone(at(b))];
    }, [dayAfter(1), dayAfter(4)]);
    pass('each calendar gets its own colour', tones[0] !== tones[1] && !!tones[0] && !!tones[1], JSON.stringify(tones));
    pass('the outline is one weight all round (no thick left edge)',
      tones.every((t) => !/(?:^|[ ,])[2-9]px 0px 0px 0px inset/.test(t)), JSON.stringify(tones[0]));

    // A span must read as ONE bar: its parts touch the edges of their cells.
    const seam = await page.evaluate(([a, b]) => {
      const bar = (key) => document.querySelector(`[data-day="${key}"] [data-event][data-all-day]`);
      const one = bar(a); const two = bar(b);
      if (!one || !two) return null;
      const r1 = one.getBoundingClientRect(); const r2 = two.getBoundingClientRect();
      const cell = document.querySelector(`[data-day="${a}"]`).getBoundingClientRect();
      return { gap: Math.round(r2.left - r1.right), rightEdge: Math.round(cell.right - r1.right) };
    }, [dayAfter(1), dayAfter(2)]);
    pass('a span has no break between its days', !!seam && seam.gap <= 2 && seam.rightEdge <= 1, JSON.stringify(seam));

    // 5. It survives a reload (cached), and removing one keeps the other.
    await reloadCalendar();
    pass('imported events survive a reload', (await chips(mine)).some((x) => x.includes('구글 주간 회의')));
    // The address list travels with the account; the downloaded text stays here.
    const stored = await page.evaluate(() => {
      const addr = localStorage.getItem('24h-circle-planner.ical');
      const cache = localStorage.getItem('24h-circle-planner.ical-cache');
      return { addr: addr ?? '', cachedFeeds: cache ? Object.keys(JSON.parse(cache).byId ?? {}).length : 0 };
    });
    pass('the addresses are kept apart from the downloaded text',
      stored.addr.includes('calendar.google.com') && !stored.addr.includes('BEGIN:VCALENDAR') && stored.cachedFeeds >= 1,
      JSON.stringify({ addr: stored.addr.slice(0, 70), cachedFeeds: stored.cachedFeeds }));

    await openDialog();
    await page.locator('[data-ical-row]').first().locator('button').click();
    await wait(500);
    pass('removing one leaves the other connected', (await page.locator('[data-ical-row]').count()) === 1);
    await page.keyboard.press('Escape');
    await wait(400);
    pass('its events are gone from the grid', !(await chips(mine)).some((x) => x.includes('구글 주간 회의')),
      JSON.stringify(await chips(mine)));
    pass('…and the other calendar still shows', (await chips(dayAfter(4))).some((x) => x.includes('팀 워크숍')));

    pass('the address never appears in a request URL', urlLeaks.length === 0, JSON.stringify(urlLeaks.slice(0, 2)));
    pass('the server is asked for the address alone', windows.every((w) => w.from === undefined && w.to === undefined),
      JSON.stringify(windows.slice(0, 1)));
    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
