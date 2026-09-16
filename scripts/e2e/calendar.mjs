/**
 * Calendar mode: its own button beside the timetable toggle, two months filling
 * the window, weekend colouring, day numbers centred at the top, all-day vs
 * timed plans, drag to block out several days, drag to move a plan, repeats with
 * per-occurrence deletes, a centred hover peek, and widgets hidden while it is on.
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
  const chips = (key) => cell(key).locator('[data-event]').allInnerTexts();
  const centre = async (key) => {
    const b = await cell(key).boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const dragFrom = async (a, toKey) => {
    const b = await centre(toKey);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
    await wait(400);
  };
  const dragChip = async (fromKey, toKey) => {
    const box = await cell(fromKey).locator('[data-drag-handle]').first().boundingBox();
    await dragFrom({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, toKey);
  };
  const dragCells = async (fromKey, toKey) => {
    const a = await centre(fromKey);
    const b = await centre(toKey);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
    await wait(400);
  };
  const fillPlan = async (text, { time, repeat } = {}) => {
    if (time) {
      await page.locator('[data-all-day-off]').click();
      await page.locator('[data-event-time]').fill(time);
    }
    if (repeat) await page.locator('[data-event-repeat]').selectOption(repeat);
    await page.locator('[data-event-input]').fill(text);
    await page.locator('[data-event-add]').click();
    await wait(250);
    await page.keyboard.press('Escape');
    await wait(300);
  };
  const addPlan = async (key, text, opts) => {
    await cell(key).click();
    await wait(350);
    await fillPlan(text, opts);
  };

  try {
    await gotoApp(page);
    await seedBasicData(page);
    const fabsBefore = await fabCount();

    // 1. Its own button in the header switches straight in and back.
    await page.locator('[data-calendar-toggle]').click();
    await wait(600);
    pass('the header button opens calendar mode', (await page.locator('[data-calendar-view]').count()) === 1);
    pass('…and reads as pressed', (await page.locator('[data-calendar-toggle]').getAttribute('aria-pressed')) === 'true');

    // 2. Two months filling the window, six rows each.
    const shown = await months();
    const nextMonth = (ym) => {
      const [y, m] = ym.split('-').map(Number);
      return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    };
    pass('two months, the second after the first', shown.length === 2 && shown[1] === nextMonth(shown[0]), JSON.stringify(shown));
    const fit = await page.evaluate(() => {
      const r = document.querySelector('[data-calendar-view]').getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), vw: window.innerWidth, vh: window.innerHeight };
    });
    pass('it fills the window', fit.w >= fit.vw - 60 && fit.h >= fit.vh * 0.55, JSON.stringify(fit));
    const rows = await page.$$eval('[data-calendar-month]', (els) => els.map((e) => e.querySelectorAll('[data-day]').length));
    pass('each month is a full six-week grid', JSON.stringify(rows) === '[42,42]', JSON.stringify(rows));

    // 3. Sunday red, Saturday blue (computed colours are oklch → paint to read).
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const tones = await page.evaluate((todayKey) => {
      const cells = [...document.querySelectorAll('[data-calendar-month]')[0].querySelectorAll('[data-day]')];
      const at = (mod) => cells.find((c, i) => i % 7 === mod && c.getAttribute('data-day') !== todayKey);
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

    const place = await page.evaluate((key) => {
      const c = document.querySelector(`[data-day="${key}"]`);
      const s = c.querySelector('span');
      const cr = c.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      return { dx: Math.abs((cr.left + cr.width / 2) - (sr.left + sr.width / 2)), dy: sr.top - cr.top };
    }, today);
    pass('the day number is centred at the top', place.dx <= 4 && place.dy <= 14, JSON.stringify(place));

    // 4. All-day vs timed.
    await addPlan(today, '워크숍');
    await addPlan(today, '팀 회의', { time: '09:30' });
    pass('an all-day plan is a filled chip', (await cell(today).locator('[data-event][data-all-day]').count()) === 1);
    const timed = await cell(today).locator('[data-event]:not([data-all-day])').allInnerTexts();
    pass('a timed plan shows its time with a dot', timed.some((x) => x.includes('09:30') && x.includes('팀 회의')), JSON.stringify(timed));
    pass('…title first, time last', timed.some((x) => x.indexOf('팀 회의') < x.indexOf('09:30')), JSON.stringify(timed));

    // The day editor reads top to bottom: the day's plans, a rule, the form, Add.
    await cell(today).click();
    await wait(350);
    const order = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      const y = (sel) => dlg?.querySelector(sel)?.getBoundingClientRect().top ?? -1;
      const form = dlg?.querySelector('[data-event-form]');
      return {
        list: y('[data-event-row]'),
        form: y('[data-event-form]'),
        input: y('[data-event-input]'),
        add: y('[data-event-add]'),
        rule: form ? getComputedStyle(form).borderTopWidth : '',
        addIsLast: form ? form.lastElementChild?.hasAttribute('data-event-add') : false,
      };
    });
    pass('the day editor lists the plans above the form',
      order.list >= 0 && order.list < order.form && order.form <= order.input && order.input < order.add,
      JSON.stringify(order));
    pass('…with a rule between them, and Add at the very bottom', order.rule === '1px' && order.addIsLast === true,
      JSON.stringify({ rule: order.rule, addIsLast: order.addIsLast }));
    await page.keyboard.press('Escape');
    await wait(300);

    // 5. Drag across days blocks out a span.
    // A week row that doesn't hold today, so the plans added above can't interfere.
    const week = await page.evaluate((todayKey) => {
      const cells = [...document.querySelectorAll('[data-calendar-month]')[0].querySelectorAll('[data-day]')]
        .map((e) => e.getAttribute('data-day'));
      for (let r = 0; r < 6; r++) {
        const row = cells.slice(r * 7, r * 7 + 7);
        if (!row.includes(todayKey)) return row;
      }
      return cells.slice(0, 7);
    }, today);
    await dragCells(week[1], week[3]);
    pass('dragging across days opens the editor for the span', (await page.locator('[data-span-days]').count()) === 1,
      await page.locator('[data-span-days]').first().innerText().catch(() => ''));
    await fillPlan('출장');
    const spanned = await Promise.all([chips(week[1]), chips(week[2]), chips(week[3]), chips(week[4])]);
    pass('the plan covers every dragged day', spanned.slice(0, 3).every((c) => c.length === 1) && spanned[3].length === 0, JSON.stringify(spanned));
    pass('…as one bar (only the first day carries the text)', spanned[0][0].includes('출장') && !spanned[1][0].includes('출장'), JSON.stringify(spanned.slice(0, 2)));

    const barFit = await page.evaluate((key) => {
      const c = document.querySelector(`[data-day="${key}"]`);
      const b = c.querySelector('[data-event][data-all-day]');
      return { cell: Math.round(c.getBoundingClientRect().width), bar: Math.round(b.getBoundingClientRect().width) };
    }, week[1]);
    pass('…running the full width of the day, like a real calendar', barFit.bar >= barFit.cell - 14, JSON.stringify(barFit));

    // 6. Drag a plan to another day.
    await addPlan(week[5], '이사');
    await dragChip(week[5], week[6]);
    pass('a move drag does not open the editor', (await page.locator('[data-event-input]').count()) === 0);
    pass('dragging a plan moves it to the day it is dropped on',
      (await chips(week[6])).some((x) => x.includes('이사')) && (await chips(week[5])).length === 0,
      JSON.stringify([await chips(week[5]), await chips(week[6])]));

    // …and a plain click on a plan (no move) opens that day.
    await cell(week[6]).locator('[data-drag-handle]').first().click();
    await wait(350);
    pass('clicking a plan opens its day', (await page.locator('[data-event-input]').count()) === 1);
    await page.keyboard.press('Escape');
    await wait(300);

    // 7. A repeat, then deleting one occurrence and the later ones.
    await addPlan(today, '스터디', { repeat: 'weekly' });
    const plus7 = keyOf(new Date(Date.now() + 7 * 86400000));
    const plus14 = keyOf(new Date(Date.now() + 14 * 86400000));
    pass('a weekly plan repeats', (await chips(plus7)).some((x) => x.includes('스터디')));

    await cell(plus7).click();
    await wait(350);
    await page.locator('[data-event-row]', { hasText: '스터디' }).locator('[data-event-del]').click();
    await wait(200);
    await page.locator('[data-del-one]').click();
    await wait(250);
    await page.keyboard.press('Escape');
    await wait(350);
    pass('"this day" drops one occurrence only',
      !(await chips(plus7)).some((x) => x.includes('스터디')) && (await chips(plus14)).some((x) => x.includes('스터디')),
      JSON.stringify([await chips(plus7), await chips(plus14)]));

    await cell(plus14).click();
    await wait(350);
    await page.locator('[data-event-row]', { hasText: '스터디' }).locator('[data-event-del]').click();
    await wait(200);
    await page.locator('[data-del-future]').click();
    await wait(250);
    await page.keyboard.press('Escape');
    await wait(350);
    pass('"this and later" keeps the earlier ones and stops the rest',
      !(await chips(plus14)).some((x) => x.includes('스터디')) && (await chips(today)).some((x) => x.includes('스터디')),
      JSON.stringify([await chips(today), await chips(plus14)]));

    // 7b. The day's list can be put in any order by its handles.
    await cell(today).click();
    await wait(350);
    const rowTexts = () => page.locator('[data-event-row]').allInnerTexts();
    const wasOrder = await rowTexts();
    const handleBox = await page.locator('[data-event-row]').last().locator('[data-row-handle]').boundingBox();
    const topBox = await page.locator('[data-event-row]').first().boundingBox();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(topBox.x + topBox.width / 2, topBox.y + 4, { steps: 8 });
    await page.mouse.up();
    await wait(400);
    const nowOrder = await rowTexts();
    pass('a row dragged by its handle lands at the top',
      nowOrder[0] === wasOrder[wasOrder.length - 1] && nowOrder.length === wasOrder.length,
      JSON.stringify([wasOrder, nowOrder]));
    await page.keyboard.press('Escape');
    await wait(350);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('[data-calendar-view]', { timeout: 15000 });
    await wait(700);
    await cell(today).click();
    await wait(400);
    pass('…and the order is still there after a reload', (await rowTexts())[0] === nowOrder[0],
      JSON.stringify(await rowTexts()));
    await page.keyboard.press('Escape');
    await wait(350);

    // 8. A crowded day shows +n, and the peek opens from the cell's middle.
    await addPlan(today, '장보기');
    await addPlan(today, '운동');
    pass('a crowded day shows a "+n" line', (await cell(today).locator('text=/^\\+\\d/').count()) === 1);
    await cell(today).hover();
    await wait(400);
    const peek = await page.evaluate((key) => {
      const c = document.querySelector(`[data-day="${key}"]`).closest('div');
      const p = document.querySelector('[data-day-peek]');
      if (!p) return null;
      const cr = c.getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      return { chips: p.querySelectorAll('[data-event]').length, dy: Math.round((pr.top + pr.height / 2) - (cr.top + cr.height / 2)) };
    }, today);
    pass('hovering lifts the whole list', !!peek && peek.chips === 5, JSON.stringify(peek));
    pass('…growing from the middle of the cell, not the bottom', !!peek && Math.abs(peek.dy) <= 8, JSON.stringify(peek));

    // …and a plan can be carried straight out of the open peek.
    const peekDrag = async (text, toKey) => {
      await cell(today).hover();
      await wait(400);
      const handles = await page.locator('[data-day-peek] [data-drag-handle]').allInnerTexts();
      const box = await page.locator('[data-day-peek] [data-drag-handle]', { hasText: text }).first().boundingBox();
      await dragFrom({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, toKey);
      return handles;
    };
    const moved = week[0];
    const peeked = await peekDrag('운동', moved);
    pass('the peek lists every plan of the day', peeked.length === 5, JSON.stringify(peeked));
    // The cell only ever draws three chips, so read the store for the real move.
    const after = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).events, EVENTS_KEY);
    const has = (key) => (after[key] ?? []).some((e) => e.text === '운동');
    pass('a plan can be dragged out of the expanded list', has(moved) && !has(today),
      JSON.stringify({ today: (after[today] ?? []).map((e) => e.text), moved: (after[moved] ?? []).map((e) => e.text) }));
    await page.mouse.move(5, 300);
    await wait(200);

    // 9. Everything persists, and the widgets stay away until the calendar closes.
    const saved = await page.evaluate((k) => localStorage.getItem(k), EVENTS_KEY);
    pass('plans are saved in their own store', !!saved && saved.includes('출장'), (saved ?? '').slice(0, 60));
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('[data-calendar-view]', { timeout: 15000 });
    await wait(700);
    pass('they survive a reload', (await cell(today).locator('[data-event]').count()) >= 3);
    pass('all widget buttons are hidden in calendar mode', (await fabCount()) === 0);

    // 10. The timetable button itself switches back without opening its menu.
    await page.locator('[data-view-toggle]').click();
    await wait(600);
    pass('the timetable button leaves the calendar in one press', (await page.locator('svg[data-circle-timeline]').count()) === 1);
    pass('…without opening a menu', (await page.locator('[role="menuitemradio"]').count()) === 0);

    await page.locator('[data-calendar-toggle]').click();
    await wait(600);
    await page.locator('[data-calendar-toggle]').click();
    await wait(600);
    pass('the same button returns to the timetable', (await page.locator('svg[data-circle-timeline]').count()) === 1);
    pass('the widgets come back', (await fabCount()) === fabsBefore, `${fabsBefore} → ${await fabCount()}`);

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
