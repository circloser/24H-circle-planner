/**
 * Diary decorating (다꾸, Pro) and the calendar's colour theme. Mocks /api/me
 * (free, then Pro) over dist/, then checks: a free account is offered Pro and
 * cannot stamp or edit; a Pro account stamps stickers onto days from the tray
 * (without opening the editor or starting a drag), edits a day's stickers and
 * highlighter in the editor; a colour theme recolours plans with readable ink
 * and accents today; everything survives a reload; and decor stored earlier is
 * still shown once the account is no longer Pro.
 */
import { makeReporter, launchPage, serveDist, seedBasicData, wait, isMain, runStandalone } from './_helpers.mjs';

const json = (data, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(data) });
const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const DECOR_KEY = '24h-circle-planner.decor';

/** A CSS colour as [r, g, b] (Tailwind v4 may hand back oklch, so paint it). */
const rgbOf = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const g = c.getContext('2d');
  const read = (prop) => {
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = '#000';
    g.fillStyle = getComputedStyle(el)[prop];
    g.fillRect(0, 0, 1, 1);
    return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  return { bg: read('backgroundColor'), ink: read('color') };
}, sel);

export async function run() {
  const { pass, allOk } = makeReporter('decor');
  const { base, close } = await serveDist();
  const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 900 } });

  const today = new Date();
  const day = (n) => keyOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n));
  let me = { user: { id: 'u1', email: 'me@example.com', provider: 'google' }, plan: 'free', admin: false };

  const cell = (key) => page.locator(`[data-day="${key}"]`).first();
  const wrap = (key) => page.locator(`div:has(> [data-day="${key}"])`).first();
  const stickersIn = (key) => wrap(key).locator('[data-cell-stickers]').innerText().catch(() => '');
  const openCalendar = async () => {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline], [data-calendar-view]', { timeout: 15000 });
    if ((await page.locator('[data-calendar-view]').count()) === 0) await page.locator('[data-calendar-toggle]').click();
    await page.waitForSelector('[data-calendar-view]', { timeout: 15000 });
    await wait(700);
  };
  const openDay = async (key) => {
    await cell(key).click();
    await wait(400);
  };
  const closeDialog = async () => {
    await page.keyboard.press('Escape');
    await wait(350);
  };

  try {
    await page.addInitScript(() => localStorage.setItem('24h-circle-planner.sync-consent', '1'));
    await page.route('**/api/sync*', (route) => route.fulfill(json({ version: 0, data: {}, updatedAt: 0 })));
    await page.route('**/api/me', (route) => route.fulfill(json(me)));

    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await seedBasicData(page);
    // A plan in the canonical red, for the theme check later.
    await page.evaluate((k) => {
      localStorage.setItem('24h-circle-planner.events', JSON.stringify({
        version: 1, events: { [k]: [{ id: 'red1', text: '빨간 일정', color: '#ef4444' }] },
      }));
    }, day(0));
    await openCalendar();

    // 1. A free account: offered Pro, cannot stamp or edit.
    await page.locator('[data-sticker-tray-toggle]').click();
    await wait(500);
    pass('a free account gets no sticker tray', (await page.locator('[data-sticker-tray]').count()) === 0);
    pass('…and is offered Pro instead', (await page.locator('[role="dialog"]').count()) === 1);
    await closeDialog();
    await openDay(day(1));
    pass('the day editor shows 다꾸 as a Pro feature', (await page.locator('[data-decor-locked]').count()) === 1
      && (await page.locator('[data-decor-editor]').count()) === 0);
    await closeDialog();

    // 2. Pro: arm a sticker and stamp three days.
    me = { ...me, plan: 'pro' };
    await openCalendar();
    await page.locator('[data-sticker-tray-toggle]').click();
    await wait(300);
    pass('a Pro account opens the sticker tray', (await page.locator('[data-sticker-tray]').count()) === 1);
    await page.locator('[data-sticker-tray] [data-sticker="sun"]').click();
    await wait(200);
    for (const k of [day(1), day(2), day(2)]) {
      await cell(k).click();
      await wait(250);
    }
    pass('tapping a day stamps the armed sticker', (await stickersIn(day(1))).includes('☀️'), await stickersIn(day(1)));
    pass('…as many times as it is tapped', (await stickersIn(day(2))).split('☀️').length - 1 === 2, await stickersIn(day(2)));
    pass('stamping neither opens the editor nor starts a span',
      (await page.locator('[data-event-input]').count()) === 0 && (await page.locator('[data-span-days]').count()) === 0);

    // Closing the tray puts taps back to normal.
    await page.locator('[data-sticker-tray-close]').click();
    await wait(250);
    await openDay(day(1));
    pass('with the tray closed a tap opens the day again', (await page.locator('[data-event-input]').count()) === 1);

    // 3. The editor: the day's stickers, add one, peel one off, a highlighter.
    pass('the editor lists the day\'s stickers', (await page.locator('[data-decor-editor] [data-day-sticker="sun"]').count()) === 1);
    await page.locator('[data-decor-add]').click();
    await page.locator('[data-decor-editor] [data-sticker="heart"]').click();
    await wait(150);
    await page.locator('[data-decor-editor] [data-day-sticker="sun"]').click();
    await wait(150);
    const onDay = await page.locator('[data-decor-editor] [data-day-sticker]').evaluateAll((els) => els.map((e) => e.getAttribute('data-day-sticker')));
    pass('stickers are added and peeled off in the editor', JSON.stringify(onDay) === '["heart"]', JSON.stringify(onDay));
    await page.locator('[data-decor-editor] [data-tint="#fef08a"]').click();
    await wait(150);
    await closeDialog();
    pass('the highlighter tints the day', (await wrap(day(1)).getAttribute('data-decor-tint')) === '#fef08a');
    const tinted = await rgbOf(page, `[data-day="${day(1)}"]`);
    const plain = await rgbOf(page, `[data-day="${day(3)}"]`);
    pass('…visibly', !!tinted && !!plain && tinted.bg.join() !== plain.bg.join() && tinted.bg[2] < tinted.bg[0],
      JSON.stringify({ tinted: tinted?.bg, plain: plain?.bg }));

    // 4. A colour theme recolours the plans and accents today.
    const redBefore = await rgbOf(page, `[data-day="${day(0)}"] [data-event][data-all-day]`);
    await page.locator('[data-cal-theme]').click();
    await wait(250);
    await page.locator('[data-cal-theme-option="pastel"]').click();
    await wait(400);
    const redAfter = await rgbOf(page, `[data-day="${day(0)}"] [data-event][data-all-day]`);
    pass('a theme shows the plan in its own red', !!redAfter && redAfter.bg.join() === '252,165,165',
      JSON.stringify({ before: redBefore?.bg, after: redAfter?.bg }));
    pass('…with dark ink on the light colour', !!redAfter && redAfter.ink.join() === '31,41,55', JSON.stringify(redAfter?.ink));
    pass('…while the stored colour stays the same',
      (await page.evaluate(() => localStorage.getItem('24h-circle-planner.events'))).includes('#ef4444'));
    pass('the theme is remembered as a preference',
      (await page.evaluate(() => JSON.parse(localStorage.getItem('24h-circle-planner.prefs')).prefs.colorTheme)) === 'pastel');

    // 5. All of it survives a reload.
    await openCalendar();
    pass('stickers survive a reload', (await stickersIn(day(1))).includes('❤️') && (await stickersIn(day(2))).includes('☀️'));
    pass('the highlighter survives a reload', (await wrap(day(1)).getAttribute('data-decor-tint')) === '#fef08a');
    pass('the theme survives a reload', (await page.locator('[data-calendar-view]').getAttribute('data-cal-look')) === 'pastel');
    const stored = await page.evaluate((k) => localStorage.getItem(k), DECOR_KEY);
    pass('decor lives in its own store', !!stored && stored.includes('heart') && stored.includes('#fef08a'), (stored ?? '').slice(0, 80));

    // 6. No longer Pro: what is there stays visible, but it cannot be changed.
    me = { ...me, plan: 'free' };
    await openCalendar();
    pass('decor stays visible after Pro ends', (await stickersIn(day(1))).includes('❤️'));
    await openDay(day(1));
    pass('…but the editor is locked again', (await page.locator('[data-decor-locked]').count()) === 1);
    await closeDialog();

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
