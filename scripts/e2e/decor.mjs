/**
 * Diary decorating (다꾸, Pro) and the calendar's colour theme. Mocks /api/me
 * (free, then Pro) over dist/, then checks: one 꾸미기 menu holds the theme,
 * the paper and the three tools; a free account may change the theme but is
 * offered Pro for everything else; stickers stamped onto days by the first
 * version move onto the free layer over the same day; a Pro account places
 * stickers, masking tape and photo stickers anywhere, resizes, rotates, drags
 * and peels them; placed items stay over the same spot of the same day when
 * the calendar is drawn at another size (a smaller window, a phone); paper
 * textures and the highlighter show; everything survives a reload; and decor
 * stored earlier is still shown once the account is no longer Pro.
 */
import { makeReporter, launchPage, serveDist, seedBasicData, wait, isMain, runStandalone } from './_helpers.mjs';

const json = (data, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(data) });
const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const DECOR_KEY = '24h-circle-planner.decor';
const LAYER_KEY = '24h-circle-planner.decor-layer';
/** A 1×1 red PNG. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

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

/** Where an item's centre sits inside a day's cell of the SAME month grid, as
 *  fractions of that cell (0..1 means inside it). */
const spotIn = (page, itemSel, day) => page.evaluate(([s, d]) => {
  const item = document.querySelector(s);
  const month = item?.closest('[data-calendar-month]');
  const cell = month?.querySelector(`[data-day="${d}"]`);
  if (!item || !cell) return null;
  const a = item.getBoundingClientRect();
  const b = cell.getBoundingClientRect();
  return {
    fx: +(((a.left + a.width / 2) - b.left) / b.width).toFixed(3),
    fy: +(((a.top + a.height / 2) - b.top) / b.height).toFixed(3),
    w: Math.round(a.width),
  };
}, [itemSel, day]);
const inside = (p) => !!p && p.fx > 0 && p.fx < 1 && p.fy > 0 && p.fy < 1;

export async function run() {
  const { pass, allOk } = makeReporter('decor');
  const { base, close } = await serveDist();
  const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 900 } });

  const today = new Date();
  // Days early in this month's grid, so every one of them is in the left month.
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const day = (n) => keyOf(new Date(first.getFullYear(), first.getMonth(), first.getDate() + n));
  const now = keyOf(today);
  let me = { user: { id: 'u1', email: 'me@example.com', provider: 'google' }, plan: 'free', admin: false };

  const leftMonth = () => page.locator('[data-calendar-month]').first();
  const cell = (key) => leftMonth().locator(`[data-day="${key}"]`).first();
  const wrap = (key) => leftMonth().locator(`div:has(> [data-day="${key}"])`).first();
  const count = (sel) => page.locator(sel).count();
  const openCalendar = async () => {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline], [data-calendar-view]', { timeout: 15000 });
    if ((await count('[data-calendar-view]')) === 0) await page.locator('[data-calendar-toggle]').click();
    await page.waitForSelector('[data-calendar-view]', { timeout: 15000 });
    await wait(700);
  };
  const closeDialog = async () => {
    await page.keyboard.press('Escape');
    await wait(350);
  };
  const menu = async () => {
    await page.locator('[data-decor-menu]').click();
    await wait(300);
  };
  const subPick = async (sub, option) => {
    await menu();
    await page.locator(`[data-decor-sub="${sub}"]`).click();
    await wait(300);
    await page.locator(option).click();
    await wait(400);
  };
  const tool = async (k) => {
    await menu();
    await page.locator(`[data-decor-tool="${k}"]`).click();
    await wait(400);
  };
  const tapCell = async (key, fx = 0.5, fy = 0.6) => {
    const b = await cell(key).boundingBox();
    await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
    await wait(300);
  };
  /** Drag the floating panel over the right-hand month, clear of the days
   *  the checks tap on the left. */
  const park = async () => {
    const bar = await page.locator('[data-decor-drag]').boundingBox();
    const right = await page.locator('[data-calendar-month]').nth(1).boundingBox();
    if (!bar || !right) return;
    await page.mouse.move(bar.x + 20, bar.y + bar.height / 2);
    await page.mouse.down();
    await page.mouse.move(right.x + 40, right.y + 80, { steps: 5 });
    await page.mouse.up();
    await wait(150);
  };
  const stored = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), LAYER_KEY);

  try {
    await page.addInitScript(() => {
      localStorage.setItem('24h-circle-planner.sync-consent', '1');
      // Count usage on this local server too, so the batches can be checked.
      localStorage.setItem('24h-metrics-debug', '1');
    });
    const counted = [];
    await page.route('**/api/metrics', async (route) => {
      try { counted.push(...(JSON.parse(route.request().postData() ?? '{}').e ?? [])); } catch { /* ignore */ }
      await route.fulfill({ status: 204, body: '' });
    });
    await page.route('**/api/sync*', (route) => route.fulfill(json({ version: 0, data: {}, updatedAt: 0 })));
    await page.route('**/api/me', (route) => route.fulfill(json(me)));

    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await seedBasicData(page);
    // A plan in the canonical red (for the theme check), and a day decorated by
    // the first version: stickers stamped onto it, and a highlighter.
    await page.evaluate(([k, old, key]) => {
      localStorage.setItem('24h-circle-planner.events', JSON.stringify({
        version: 1, events: { [k]: [{ id: 'red1', text: '빨간 일정', color: '#ef4444' }] },
      }));
      localStorage.setItem(key, JSON.stringify({ version: 1, days: { [old]: { s: ['heart', 'sun'], t: '#bfdbfe' } } }));
    }, [now, day(9), DECOR_KEY]);
    await openCalendar();

    // 1. One menu: theme, paper, then the three tools.
    await menu();
    const entries = await page.locator('[data-decor-menu-content] [data-decor-sub], [data-decor-menu-content] [data-decor-tool]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-decor-sub') ?? e.getAttribute('data-decor-tool')));
    pass('the 꾸미기 menu holds theme, paper and the three tools', JSON.stringify(entries) === '["theme","paper","sticker","tape","photo"]', JSON.stringify(entries));
    pass('the separate theme and sticker buttons are gone', (await count('[data-cal-theme], [data-sticker-tray-toggle]')) === 0);
    await page.keyboard.press('Escape');
    await wait(250);

    // 2. A free account: the theme is free, everything else offers Pro.
    await subPick('theme', '[data-cal-theme-option="pastel"]');
    pass('a free account can change the theme', (await page.locator('[data-calendar-view]').getAttribute('data-cal-look')) === 'pastel');
    await tool('sticker');
    pass('a free account gets no decorating tray', (await count('[data-decor-tray]')) === 0);
    pass('…and is offered Pro instead', (await count('[role="dialog"]')) === 1);
    await closeDialog();
    await subPick('paper', '[data-paper-option="grid"]');
    pass('a free account cannot change the paper', (await page.locator('[data-calendar-view]').getAttribute('data-paper')) === null
      && (await count('[role="dialog"]')) === 1);
    await closeDialog();
    await cell(day(10)).click();
    await wait(400);
    pass('the day editor shows 다꾸 as a Pro feature', (await count('[data-decor-locked]')) === 1 && (await count('[data-decor-editor]')) === 0);
    await closeDialog();

    // 3. The first version's day stickers moved onto the layer, over their day.
    const layer0 = await stored();
    const moved = layer0 ? Object.values(layer0.months).flat() : [];
    pass('old day stickers move onto the layer', moved.length === 2 && moved.every((i) => i.id.startsWith(`m-${day(9)}`)), JSON.stringify(moved).slice(0, 120));
    const dayStore = await page.evaluate((k) => localStorage.getItem(k), DECOR_KEY);
    pass('…leaving the highlighter where it was', !!dayStore && !dayStore.includes('heart') && dayStore.includes('#bfdbfe'), dayStore ?? '');
    const oldSpot = await spotIn(page, `[data-item-id="m-${day(9)}-0"]`, day(9));
    pass('…and are drawn over the same day', inside(oldSpot) && oldSpot.fy < 0.5, JSON.stringify(oldSpot));

    // 4. Pro: place a sticker anywhere.
    me = { ...me, plan: 'pro' };
    await openCalendar();
    const before = await leftMonth().evaluate((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(); });
    await tool('sticker');
    pass('a Pro account opens the decorating panel', (await count('[data-decor-tray="sticker"]')) === 1);
    const after = await leftMonth().evaluate((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(); });
    pass('…floating over the calendar, which keeps its size and place', before === after, `${before} → ${after}`);
    pass('…as a window of its own', (await page.locator('[data-decor-tray]').evaluate((e) => getComputedStyle(e).position)) === 'fixed');
    const p0 = await page.locator('[data-decor-tray]').boundingBox();
    const bar = await page.locator('[data-decor-drag]').boundingBox();
    await page.mouse.move(bar.x + 20, bar.y + bar.height / 2);
    await page.mouse.down();
    await page.mouse.move(bar.x - 80, bar.y + bar.height / 2 + 60, { steps: 6 });
    await page.mouse.up();
    await wait(200);
    const p1 = await page.locator('[data-decor-tray]').boundingBox();
    pass('the panel moves by its title bar', Math.abs(p1.x - (p0.x - 100)) < 3 && Math.abs(p1.y - (p0.y + 60)) < 3,
      JSON.stringify({ from: [p0.x, p0.y], to: [p1.x, p1.y] }));
    await page.locator('[data-decor-fold]').click();
    await wait(150);
    const foldedH = (await page.locator('[data-decor-tray]').boundingBox()).height;
    pass('…and folds down to its title bar', foldedH < 60 && (await count('[data-sticker-picker]')) === 0, String(foldedH));
    await page.locator('[data-decor-fold]').click();
    await wait(150);
    const groups = await count('[data-sticker-group]');
    pass('stickers come in categories', groups === 10, String(groups));
    await page.locator('[data-sticker-group="animal"]').click();
    await wait(100);
    const animals = await count('[data-decor-tray] [data-sticker]');
    pass('…showing one category at a time', animals >= 30 && (await count('[data-decor-tray] [data-sticker="panda"]')) === 1, String(animals));
    pass('the layer takes the pointer while decorating', (await count('[data-decor-layer][data-decorating]')) === 2);
    await page.locator('[data-sticker-group="moment"]').click();
    await page.locator('[data-decor-tray] [data-sticker="star"]').click();
    await wait(150);
    await tapCell(day(3), 0.3, 0.7);
    const star = '[data-decor-item="sticker"][data-selected]';
    const s1 = await spotIn(page, star, day(3));
    pass('a tap places the sticker where it was tapped', !!s1 && Math.abs(s1.fx - 0.3) < 0.04 && Math.abs(s1.fy - 0.7) < 0.04, JSON.stringify(s1));
    pass('…without opening the day or starting a span', (await count('[data-event-input], [data-span-days]')) === 0);
    const starId = await page.locator(star).getAttribute('data-item-id');

    // Size and rotation.
    await page.locator('[data-item-bigger]').click();
    await page.locator('[data-item-bigger]').click();
    await wait(200);
    const s2 = await spotIn(page, `[data-item-id="${starId}"]`, day(3));
    pass('the selected sticker grows', !!s2 && s2.w > s1.w * 1.3, `${s1?.w} → ${s2?.w}`);
    await page.locator('[data-item-rotate]').click();
    await wait(150);
    const tf = await page.locator(`[data-item-id="${starId}"]`).evaluate((e) => e.style.transform);
    pass('…and turns', tf.includes('rotate(15deg)'), tf);

    // 5. The spot holds when the calendar is drawn at another size.
    await page.setViewportSize({ width: 1000, height: 640 });
    await wait(600);
    const small = await spotIn(page, `[data-item-id="${starId}"]`, day(3));
    pass('a smaller window keeps it on the same spot of the same day',
      !!small && Math.abs(small.fx - s1.fx) < 0.05 && Math.abs(small.fy - s1.fy) < 0.05 && small.w < s2.w,
      JSON.stringify({ before: s1, after: small }));
    await page.setViewportSize({ width: 390, height: 844 });
    await wait(900);
    const phone = await spotIn(page, `[data-item-id="${starId}"]`, day(3));
    pass('…and so does a phone layout', !!phone && Math.abs(phone.fx - s1.fx) < 0.08 && Math.abs(phone.fy - s1.fy) < 0.08,
      JSON.stringify(phone));
    await page.setViewportSize({ width: 1440, height: 900 });
    await wait(900);

    // 6. Drag it to another day.
    if ((await count('[data-decor-tray]')) === 0) await tool('sticker');
    await park();
    const box = await page.locator(`[data-item-id="${starId}"]`).boundingBox();
    const to = await cell(day(12)).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();
    await wait(300);
    pass('dragging moves it onto another day', inside(await spotIn(page, `[data-item-id="${starId}"]`, day(12))),
      JSON.stringify(await spotIn(page, `[data-item-id="${starId}"]`, day(12))));

    // 7. Masking tape.
    await page.locator('[data-decor-tab="tape"]').click();
    await page.locator('[data-tape-pattern="dot"]').click();
    await wait(150);
    await tapCell(day(4), 0.5, 0.3);
    const tape = '[data-decor-item="tape"][data-selected]';
    pass('masking tape is laid where tapped', inside(await spotIn(page, tape, day(4))));
    const t1 = (await page.locator(tape).boundingBox())?.width ?? 0;
    for (let i = 0; i < 4; i++) await page.locator('[data-item-longer]').click();
    await wait(200);
    const t2 = (await page.locator(tape).boundingBox())?.width ?? 0;
    pass('…and can be made longer', t2 > t1 * 1.4, `${t1} → ${t2}`);
    await page.locator('[data-tape-color="#bbf7d0"]').click();
    await wait(150);
    const tapeItem = (await stored()).months;
    const tapes = Object.values(tapeItem).flat().filter((i) => i.k === 'tape');
    pass('…and takes a new colour and pattern', tapes.length === 1 && tapes[0].c === '#bbf7d0' && tapes[0].p === 'dot', JSON.stringify(tapes));

    // 8. A photo sticker.
    await page.locator('[data-decor-tab="photo"]').click();
    await page.locator('[data-decor-photo-input]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForSelector('[data-decor-tray] [data-photo-frame]', { timeout: 5000 }).catch(() => {});
    await wait(300);
    await tapCell(day(5), 0.5, 0.5);
    await wait(500);
    const photo = '[data-decor-layer] [data-decor-item="photo"]';
    pass('a photo sticker is placed', (await count(photo)) === 1 && inside(await spotIn(page, photo, day(5))));
    pass('…showing the picture', (await page.locator(`${photo} [data-photo-frame]`).getAttribute('data-photo-frame')) === 'shown');
    const phStored = Object.values((await stored()).months).flat().find((i) => i.k === 'photo');
    pass('…while only its id is synced, not the picture', !!phStored?.ph && !JSON.stringify(await stored()).includes('data:image'));
    await tapCell(day(6));
    pass('a photo is placed once, not stamped again', (await count(photo)) === 1);

    // 9. Paper.
    await subPick('paper', '[data-paper-option="grid"]');
    pass('a Pro account chooses the paper', (await page.locator('[data-calendar-view]').getAttribute('data-paper')) === 'grid');
    const texture = await cell(day(10)).evaluate((e) => getComputedStyle(e).backgroundImage);
    pass('…which is drawn on the days', texture.includes('linear-gradient'), texture.slice(0, 60));

    // The month as an image: decorations, photo and paper drawn in, saved as a file.
    const monthOf = await leftMonth().getAttribute('data-calendar-month');
    await page.locator('[data-cal-image-menu]').click();
    await wait(250);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.locator(`[data-cal-image="${monthOf}"]`).click(),
    ]);
    pass('the month is saved as an image file', download.suggestedFilename() === `24houring-${monthOf}.png`, download.suggestedFilename());
    const png = await download.path().then((f) => import('node:fs').then((fs) => fs.readFileSync(f)));
    const layerNow = (await stored()).months[monthOf] ?? [];
    const probe = await page.evaluate(async ([b64, items]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      // The image's grid: 40px margins, a 76px title and a 38px weekday row.
      const grid = { x: 40, y: 154, w: 1000, h: 800 };
      const at = (x, y) => [...g.getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3);
      const photoItem = items.find((i) => i.k === 'photo');
      const w = 9 * photoItem.s * 10;
      const cx = grid.x + photoItem.x * grid.w;
      const cy = grid.y + photoItem.y * grid.h;
      // The picture sits above the frame's centre (the caption strip is below).
      const photoPx = at(cx, cy - w * 0.07);
      const tapeItem = items.find((i) => i.k === 'tape');
      const tapePx = at(grid.x + tapeItem.x * grid.w, grid.y + tapeItem.y * grid.h);
      // A carried/neighbouring cell: the first cell when the month does not start on Sunday.
      const firstCell = at(grid.x + 20, grid.y + 150);
      const surface = at(grid.x + 3 * 142 + 20, grid.y + 2 * 160 + 150);
      return { width: img.width, height: img.height, photoPx, tapePx, firstCell, surface };
    }, [png.toString('base64'), layerNow]);
    pass('…at 1080 wide', probe.width === 1080 && probe.height > 900, `${probe.width}×${probe.height}`);
    pass('…with the photo sticker drawn in', probe.photoPx[0] > 180 && probe.photoPx[1] < 90 && probe.photoPx[2] < 90, JSON.stringify(probe.photoPx));
    pass('…and the masking tape', probe.tapePx.join() !== probe.surface.join(), JSON.stringify({ tape: probe.tapePx, surface: probe.surface }));

    // 10. Done: the calendar works as usual again.
    await page.locator('[data-decor-done]').click();
    await wait(300);
    pass('완료 closes the tray and frees the calendar', (await count('[data-decor-tray], [data-decor-layer][data-decorating]')) === 0);
    await cell(day(10)).click();
    await wait(400);
    pass('a tap opens the day again', (await count('[data-event-input]')) === 1);
    pass('the day editor keeps the highlighter only', (await count('[data-decor-editor] [data-tint]')) === 7 && (await count('[data-decor-editor] [data-sticker]')) === 0);
    await page.locator('[data-decor-editor] [data-tint="#fef08a"]').click();
    await wait(150);
    await closeDialog();
    pass('the highlighter tints the day', (await wrap(day(10)).getAttribute('data-decor-tint')) === '#fef08a');
    const tinted = await rgbOf(page, `[data-day="${day(10)}"]`);
    const plain = await rgbOf(page, `[data-day="${day(11)}"]`);
    pass('…visibly', !!tinted && !!plain && tinted.bg.join() !== plain.bg.join() && tinted.bg[2] < tinted.bg[0],
      JSON.stringify({ tinted: tinted?.bg, plain: plain?.bg }));

    // 11. The theme recolours plans and accents today.
    await subPick('theme', '[data-cal-theme-option="pastel"]');
    const redAfter = await rgbOf(page, `[data-day="${now}"] [data-event][data-all-day]`);
    pass('a theme shows the plan in its own red', !!redAfter && redAfter.bg.join() === '252,165,165', JSON.stringify(redAfter?.bg));
    pass('…with dark ink on the light colour', !!redAfter && redAfter.ink.join() === '31,41,55', JSON.stringify(redAfter?.ink));
    pass('…while the stored colour stays the same',
      (await page.evaluate(() => localStorage.getItem('24h-circle-planner.events'))).includes('#ef4444'));

    // 12. All of it survives a reload.
    await openCalendar();
    pass('layer items survive a reload', (await count('[data-decor-layer] [data-decor-item]')) === 5
      && inside(await spotIn(page, `[data-item-id="${starId}"]`, day(12))));
    pass('…the photo too', (await page.locator(`${photo} [data-photo-frame]`).getAttribute('data-photo-frame')) === 'shown');
    pass('paper, theme and highlighter survive a reload',
      (await page.locator('[data-calendar-view]').getAttribute('data-paper')) === 'grid'
      && (await page.locator('[data-calendar-view]').getAttribute('data-cal-look')) === 'pastel'
      && (await wrap(day(10)).getAttribute('data-decor-tint')) === '#fef08a');
    pass('the layer does not block the days when not decorating',
      (await page.locator('[data-decor-layer]').first().evaluate((e) => getComputedStyle(e).pointerEvents)) === 'none');

    // 13. Peeling off.
    await tool('photo');
    await park();
    await page.locator(photo).click();
    await wait(200);
    await page.locator('[data-item-delete]').click();
    await wait(300);
    pass('a selected item can be peeled off', (await count(photo)) === 0 && (await count('[data-decor-layer] [data-decor-item]')) === 4);
    await page.locator('[data-decor-done]').click();
    await wait(200);

    // 14. No longer Pro: what is there stays visible, but it cannot be changed.
    me = { ...me, plan: 'free' };
    await openCalendar();
    pass('decor stays visible after Pro ends', (await count('[data-decor-layer] [data-decor-item]')) === 4
      && (await page.locator('[data-calendar-view]').getAttribute('data-paper')) === 'grid');
    await tool('tape');
    pass('…but decorating offers Pro again', (await count('[data-decor-tray]')) === 0 && (await count('[role="dialog"]')) === 1);
    await closeDialog();
    await cell(day(10)).click();
    await wait(400);
    pass('…and the editor is locked again', (await count('[data-decor-locked]')) === 1);
    await closeDialog();

    // Usage counts: names only, tagged, delivered in batches.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await wait(800);
    const want = ['app_open', 'calendar_open', 'upgrade_open:decor', 'decor_tool:sticker', 'decor_place:sticker', 'decor_place:tape',
      'decor_place:photo', 'paper_set:grid', 'cal_image:downloaded'];
    const missing = want.filter((n) => !counted.includes(n));
    pass('usage is counted by name only', counted.length > 0 && missing.length === 0 && counted.every((n) => /^[a-z_]+(:[a-z0-9_-]+)?$/.test(n)),
      JSON.stringify({ missing, sample: [...new Set(counted)].slice(0, 14) }));

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
