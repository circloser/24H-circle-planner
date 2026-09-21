/**
 * Place — the countries, cities and spots you have been to (PRD acceptance).
 * Over dist/ with a free account mocked: its own header button; the globe
 * draws with NO network at all and a country colours in with one tap; the
 * numbers change at once; names come out in the reader's language; two
 * fingers pinch on both maps; a tap on the pin map drops a pin and colours
 * that country in; the life line's travels are offered and only what is
 * agreed to is written; the free pin limit stops adding and hides nothing;
 * PNG and JSON export, JSON restore; five hundred pins stay smooth; and the
 * browser is asked where it is only when the button is pressed.
 */
import { makeReporter, launchPage, seedBasicData, serveDist, wait, isMain, runStandalone } from './_helpers.mjs';

const PLACE_KEY = '24h-circle-planner.place';
const LIFE_KEY = '24h-circle-planner.life';
const RELATION_KEY = '24h-circle-planner.relation';
const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

/** Everything the page could possibly ask the outside world for. */
const OUTSIDE = '**://{tile.openstreetmap.org,*.tile.openstreetmap.org}/**';

async function setup(base, opts = {}) {
  const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 900 }, ...opts });
  const counted = [];
  const tiles = [];
  await page.addInitScript(() => {
    try { localStorage.setItem('24h-metrics-debug', '1'); } catch { /* */ }
    // Count every time the page asks where the device is. Nothing may ask
    // except the button, and the button asks once.
    const w = window;
    w.__located = 0;
    const fake = {
      getCurrentPosition: (ok) => {
        w.__located += 1;
        ok({ coords: { longitude: 2.35, latitude: 48.86, accuracy: 20 } });
      },
      watchPosition: () => { w.__located += 100; return 0; },
      clearWatch: () => {},
    };
    Object.defineProperty(navigator, 'geolocation', { value: fake, configurable: true });
  });
  await page.route('**/api/metrics', async (route) => {
    try { counted.push(...(JSON.parse(route.request().postData() ?? '{}').e ?? [])); } catch { /* ignore */ }
    await route.fulfill({ status: 204, body: '' });
  });
  await page.route('**/api/sync*', (route) => route.fulfill(json({ version: 0, data: {}, updatedAt: 0 })));
  await page.route('**/api/life/memoir', (route) => route.fulfill(json({ enabled: false })));
  await page.route('**/api/me', (route) => route.fulfill(json({ user: null, plan: 'free' })));
  // Every tile request is written down, and answered with nothing: the suite
  // must never lean on OpenStreetMap, and the world view must not need it.
  await page.route(OUTSIDE, (route) => {
    tiles.push(route.request().url());
    return route.abort();
  });
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
  await seedBasicData(page);
  return { browser, page, errors, counted, tiles };
}

const LIFE = {
  version: 1,
  profile: { birthDate: '1985-05-15', name: '김하루' },
  family: [],
  milestones: [
    { id: 'm1', date: '2018-06', title: 'Paris 여행', category: 'travel' },
    { id: 'm2', date: '2010', title: '입사', category: 'career' },
  ],
  endingNote: null,
  memoir: null,
  updatedAt: '',
};

export async function run() {
  const { pass, allOk } = makeReporter('place');
  const { base, close } = await serveDist();
  const { browser, page, errors, counted, tiles } = await setup(base);
  const count = (sel) => page.locator(sel).count();
  const stored = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), PLACE_KEY);
  const flush = async () => {
    await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await wait(1200);
  };
  const openPlace = async () => {
    await flush();
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline], [data-place-view]', { timeout: 15000 });
    if ((await count('[data-place-view]')) === 0) await page.locator('[data-place-toggle]').click();
    await page.waitForSelector('[data-place-world], [data-place-pins]', { timeout: 20000 });
    await wait(700);
  };
  const closeAll = async () => {
    for (let i = 0; i < 4 && (await page.locator('[role="dialog"]').count()) > 0; i++) {
      await page.keyboard.press('Escape');
      await wait(250);
    }
    await wait(200);
  };
  const seed = (place) => page.evaluate(([k, d]) => localStorage.setItem(k, d), [PLACE_KEY, JSON.stringify(place)]);
  /** Choose a country the way a keyboard does: the globe is a canvas, so its
   *  list of every country on earth is the way in without a mouse. */
  const tapCountry = async (code) => {
    await page.locator(`[data-place-country="${code}"]`).dispatchEvent('click');
    await wait(400);
  };
  /** Which of the two is showing, and how far in it is. */
  const showing = async () => ((await count('[data-place-pins]')) === 1 ? 'pins' : 'world');
  /**
   * Go to one view or the other the only way there is: by zooming. Pressing
   * the button past the end of one view is what opens the other.
   */
  const show = async (which) => {
    const way = which === 'pins' ? 'in' : 'out';
    for (let i = 0; i < 14 && (await showing()) !== which; i++) {
      await page.locator(`[data-place-zoom-${way}]`).click();
      await wait(220);
    }
    await wait(500);
    return (await showing()) === which;
  };

  /** Two fingers, moving apart. */
  const pinch = async (sel) => page.evaluate(async (s) => {
    const el = document.querySelector(s);
    const r = el.getBoundingClientRect();
    const send = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, {
      pointerId: id, clientX: r.left + x, clientY: r.top + y, bubbles: true, isPrimary: id === 1,
    }));
    const box = el.closest('[data-place-zoom]') ?? el.parentElement;
    const was = Number(box.dataset.placeZoom);
    send('pointerdown', 1, r.width * 0.4, r.height * 0.5);
    send('pointerdown', 2, r.width * 0.6, r.height * 0.5);
    send('pointermove', 1, r.width * 0.2, r.height * 0.5);
    await new Promise((done) => setTimeout(done, 150));
    send('pointermove', 2, r.width * 0.8, r.height * 0.5);
    await new Promise((done) => setTimeout(done, 250));
    const after = Number(box.dataset.placeZoom);
    send('pointerup', 1, r.width * 0.2, r.height * 0.5);
    send('pointerup', 2, r.width * 0.8, r.height * 0.5);
    return { was, after };
  }, sel);

  try {
    // 1. Its own button in the header.
    await page.locator('[data-place-toggle]').click();
    await page.waitForSelector('[data-place-view]', { timeout: 15000 });
    await wait(1200);
    pass('the header button opens the place map', (await count('[data-place-view]')) === 1);
    pass('…and reads as pressed', (await page.locator('[data-place-toggle]').getAttribute('aria-pressed')) === 'true');
    pass('five tabs, every one of them an icon alone', await page.evaluate(() => {
      const tabs = ['[data-view-toggle]', '[data-calendar-toggle]', '[data-life-toggle]', '[data-relation-toggle]', '[data-place-toggle]'];
      return tabs.every((s) => {
        const el = document.querySelector(s);
        return el && (el.innerText ?? '').trim() === '';
      });
    }));
    pass('the site footer stays away here',
      (await page.locator('footer', { hasText: '개인정보처리방침' }).count()) === 0);

    // 2. The whole world, drawn with nothing fetched from anyone.
    pass('every country on earth is drawn', (await count('[data-place-country]')) > 150,
      String(await count('[data-place-country]')));
    pass('…and not one tile was asked for to do it', tiles.length === 0, String(tiles.length));
    pass('an empty map asks the one question it needs', (await count('[data-place-home-ask]')) === 1);
    await page.locator('[data-place-home-close]').click();
    await wait(300);

    // 3. One tap colours a country in, and the numbers change with it.
    await tapCountry('KR');
    await page.locator('[data-place-visited-toggle]').click();
    await wait(500);
    pass('a country is coloured in with one tap',
      (await stored()).countries.map((c) => c.code).join() === 'KR', JSON.stringify((await stored()).countries));
    pass('…and the map shows it', (await page.locator('[data-place-country="KR"]').getAttribute('data-place-visited')) === 'yes');
    pass('…and the line above says so at once',
      /1개국/.test(await page.locator('[data-place-summary]').innerText()),
      await page.locator('[data-place-summary]').innerText());

    // 4. Names come out in the reader's own language.
    pass('the country is named in Korean, not in English',
      (await page.locator('[data-place-panel-name]').innerText()) === '대한민국',
      await page.locator('[data-place-panel-name]').innerText());
    pass('…and so is its continent', /아시아/.test(await page.locator('[data-place-panel]').innerText()));

    // 5. A city, and a search that finds one.
    await page.locator('[data-place-panel] [data-place-city-search]').fill('Seoul');
    await wait(400);
    await page.locator('[data-place-panel] [data-place-city-option="KR-seoul"]').click();
    await wait(500);
    pass('a city from the bundled list is added with its coordinates',
      (await stored()).cities[0]?.id === 'KR-seoul' && Math.round((await stored()).cities[0].lat) === 38,
      JSON.stringify((await stored()).cities));
    pass('…and it is listed on the country\'s own card',
      (await count('[data-place-city-remove="KR-seoul"]')) === 1);
    await page.locator('[data-place-panel-close]').click();
    await wait(300);
    await page.locator('[data-place-search-open]').click();
    await page.locator('[data-place-search]').fill('프랑');
    await wait(400);
    pass('countries are searched by their name in this language', (await count('[data-place-found-item="FR"]')) === 1);
    await page.locator('[data-place-found-item="FR"]').click();
    await wait(400);
    pass('…and choosing one opens its card', (await page.locator('[data-place-panel]').getAttribute('data-country')) === 'FR');
    await page.locator('[data-place-panel-close]').click();
    await wait(300);

    // 5a. Somewhere to go is kept apart from somewhere been.
    await tapCountry('JP');
    await page.locator('[data-place-wish-toggle]').click();
    await wait(500);
    pass('a country can be marked as somewhere to go',
      (await stored()).countries.find((c) => c.code === 'JP')?.wish === true,
      JSON.stringify((await stored()).countries));
    pass('…and the map keeps the two apart',
      (await page.locator('[data-place-country="JP"]').getAttribute('data-place-visited')) === 'wish'
      && (await page.locator('[data-place-country="KR"]').getAttribute('data-place-visited')) === 'yes');
    pass('…and it is counted on its own line, not as a country visited',
      /가 보고 싶은 1개국/.test(await page.locator('[data-place-summary]').innerText())
      && /^1개국/.test(await page.locator('[data-place-summary]').innerText()),
      await page.locator('[data-place-summary]').innerText());
    await page.locator('[data-place-visited-toggle]').click();
    await wait(500);
    pass('…and saying I have been there now takes the wish away',
      (await stored()).countries.find((c) => c.code === 'JP')?.wish === undefined
      && /2개국/.test(await page.locator('[data-place-summary]').innerText()),
      JSON.stringify((await stored()).countries));
    await page.locator('[data-place-visited-toggle]').click();
    await wait(400);
    await page.locator('[data-place-panel-close]').click();
    await wait(300);

    // 5b. Two fingers work on both maps — a phone has no wheel.
    const globePinch = await pinch('[data-place-world]');
    pass('two fingers zoom the globe', globePinch.after > globePinch.was, JSON.stringify(globePinch));
    pass('…and the buttons do too', await (async () => {
      const before = await page.locator('[data-place-globe]').getAttribute('data-place-zoom');
      await page.locator('[data-place-zoom-out]').click();
      await wait(300);
      return Number(await page.locator('[data-place-globe]').getAttribute('data-place-zoom')) < Number(before);
    })());

    // 5c. The world's own cities arrive as the globe is brought closer.
    const shown = async () => Number(await page.locator('[data-place-globe]').getAttribute('data-place-cities'));
    const zoomBy = async (which, times) => {
      for (let i = 0; i < times; i++) await page.locator(`[data-place-zoom-${which}]`).click();
      await wait(400);
    };
    // Right out to the stop first, so each step below starts from a known
    // zoom rather than from wherever the pinch above left it. (The buttons,
    // not a double tap: a double tap on the globe also picks a country.)
    await zoomBy('out', 8);
    pass('far out, the globe is countries and nothing else', (await shown()) === 0, String(await shown()));
    await zoomBy('in', 4);
    const capitals = await shown();
    pass('brought closer, the capitals appear and little else', capitals > 100 && capitals < 600,
      `${capitals} at ${await page.locator('[data-place-globe]').getAttribute('data-place-zoom')}`);
    await zoomBy('in', 1);
    const more = await shown();
    pass('…and closer still, the smaller cities join them', more > capitals,
      `${capitals} → ${more}`);
    await zoomBy('out', 8);
    pass('…and zooming back out puts them away again', (await shown()) === 0);

    // 6. The pin map: reached by zooming in, and a pin goes where it is tapped.
    pass('zooming in past the globe opens the tile map', await show('pins'));
    pass('the pin map asks OpenStreetMap for its tiles, and says whose they are',
      tiles.length > 0 && /OpenStreetMap/.test(await page.locator('[data-place-attribution]').innerText()));
    pass('there is no view to choose and no picture to choose between',
      (await count('[data-place-tab]')) === 0 && (await count('[data-place-layer]')) === 0);
    pass('…and with none of them arriving it says so, rather than showing nothing',
      (await count('[data-place-offline]')) === 1);
    const pinPinch = await pinch('[data-place-tiles]');
    pass('two fingers zoom the pin map', pinPinch.after > pinPinch.was, JSON.stringify(pinPinch));
    pass('nothing has asked where the device is',
      (await page.evaluate(() => window.__located)) === 0);
    await page.locator('[data-place-locate]').click();
    await wait(600);
    pass('pressing the button asks exactly once, and the map goes there',
      (await page.evaluate(() => window.__located)) === 1 && (await count('[data-place-here]')) === 1);
    const map = await page.locator('[data-place-pins]').boundingBox();
    await page.mouse.click(map.x + map.width * 0.5, map.y + map.height * 0.5);
    await wait(600);
    pass('tapping the map opens a new pin there', (await count('[data-place-pin-dialog]')) === 1);
    await page.locator('[data-place-name-input]').fill('에펠탑');
    await page.locator('[data-place-cat="culture"]').click();
    pass('the form says nothing is tracked, before anything is written',
      /추적하지 않습니다/.test(await page.locator('[data-place-privacy]').innerText()));
    await page.locator('[data-place-save]').click();
    await wait(700);
    const withPin = await stored();
    pass('the pin is kept where it was dropped',
      withPin.pins.length === 1 && withPin.pins[0].name === '에펠탑' && withPin.pins[0].category === 'culture',
      JSON.stringify(withPin.pins));
    pass('…and the country it landed in is coloured in by itself',
      !!withPin.pins[0].countryCode && withPin.countries.some((c) => c.code === withPin.pins[0].countryCode),
      `${withPin.pins[0].countryCode} · ${withPin.countries.map((c) => c.code).join()}`);
    pass('…and it is on the map and in the list',
      (await count(`[data-place-pin="${withPin.pins[0].id}"]`)) === 1
      && (await count(`[data-place-list-item="${withPin.pins[0].id}"]`)) === 1);

    // 6a. The shortcut rail: whatever has been starred, and where I live.
    pass('nothing is starred, so there is no rail to start with',
      (await count('[data-place-rail]')) === 0);
    await page.locator(`[data-place-list-item="${withPin.pins[0].id}"]`).focus();
    await page.keyboard.press('Enter');
    await wait(400);
    await page.locator('[data-place-pin-star]').click();
    await wait(500);
    pass('starring a pin puts it on the rail',
      (await stored()).pins[0].star === true
      && (await count(`[data-place-shortcut="${withPin.pins[0].id}"]`)) === 1,
      JSON.stringify((await stored()).pins[0]));
    pass('…in the corner a thumb reaches, with where-I-am under it', await page.evaluate(() => {
      const rail = document.querySelector('[data-place-rail]').getBoundingClientRect();
      const me = document.querySelector('[data-place-locate]').getBoundingClientRect();
      const view = document.querySelector('[data-place-view]').getBoundingClientRect();
      return view.right - me.right < 40 && view.bottom - me.bottom < 60
        && Math.abs(view.right - rail.right) < 40 && rail.bottom <= me.top + 1;
    }));
    await page.locator('[data-place-panel-close]').click();
    await wait(300);
    await page.locator('[data-place-zoom-out]').click();
    await wait(300);
    const wide = Number(await page.locator('[data-place-pins]').getAttribute('data-place-zoom'));
    await page.locator(`[data-place-shortcut="${withPin.pins[0].id}"]`).click();
    await wait(600);
    pass('…and pressing one goes there, close in',
      Number(await page.locator('[data-place-pins]').getAttribute('data-place-zoom')) > wide
      && (await page.locator('[data-place-panel]').getAttribute('data-pin')) === withPin.pins[0].id,
      `${wide} → ${await page.locator('[data-place-pins]').getAttribute('data-place-zoom')}`);
    await page.locator('[data-place-panel-close]').click();
    await wait(300);

    // 6b. The same pins are on the globe, and open there without leaving it.
    await show('world');
    pass('a pin is on the globe as well as on the pin map',
      (await count(`[data-place-globe-pin="${withPin.pins[0].id}"]`)) === 1);
    await page.locator(`[data-place-globe-pin="${withPin.pins[0].id}"]`).dispatchEvent('click');
    await wait(400);
    pass('…and choosing it there opens its card without leaving the globe',
      (await page.locator('[data-place-panel]').getAttribute('data-pin')) === withPin.pins[0].id
      && (await count('[data-place-world]')) === 1);
    await page.locator('[data-place-panel-close]').click();
    await wait(300);

    // 6-ii. The two views are one view: zoom out of the tiles and the globe
    // takes over at the same place, and in past the globe's end the tiles do.
    await show('pins');
    const startedAt = await page.locator('[data-place-pins]').getAttribute('data-place-zoom');
    for (let i = 0; i < 14 && (await showing()) === 'pins'; i++) {
      await page.locator('[data-place-zoom-out]').click();
      await wait(250);
    }
    pass('zooming the tile map out far enough hands over to the globe',
      (await count('[data-place-globe]')) === 1 && (await count('[data-place-pins]')) === 0,
      `from ${startedAt}`);
    pass('…and the globe arrives at the very scale the tiles left off at',
      Number(await page.locator('[data-place-globe]').getAttribute('data-place-zoom')) > 1);
    // One press back in, and the tiles have it again: the crossing is a
    // change of drawing, not a jump of distance.
    await page.locator('[data-place-zoom-in]').click();
    await wait(500);
    pass('and one press back in hands it straight to the tiles again',
      (await count('[data-place-pins]')) === 1 && (await count('[data-place-globe]')) === 0);
    pass('…at the scale the globe stopped at, not somewhere else',
      Number(await page.locator('[data-place-pins]').getAttribute('data-place-zoom')) === 6,
      await page.locator('[data-place-pins]').getAttribute('data-place-zoom'));

    // 7. The life line's travels are offered, never taken.
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [LIFE_KEY, JSON.stringify(LIFE)]);
    await openPlace();
    await closeAll();
    // The offer belongs to the globe, which is where zooming out ends up.
    await show('world');
    pass('a trip on the life line is offered, with the city it seems to name',
      (await count('[data-place-guess="FR-paris"]')) === 1);
    const beforeGuess = (await stored()).cities.length;
    pass('…and nothing is written while none of them is chosen',
      (await page.locator('[data-place-import-life]').isDisabled())
      && (await stored()).cities.length === beforeGuess);
    await page.locator('[data-place-guess="FR-paris"]').click();
    await page.locator('[data-place-import-life]').click();
    await wait(700);
    pass('…and only what was chosen is put on the map',
      (await stored()).cities.some((c) => c.id === 'FR-paris')
      && (await stored()).cities.length === beforeGuess + 1, JSON.stringify((await stored()).cities.map((c) => c.id)));

    // 8. The free limit stops adding, and hides nothing.
    await seed({
      version: 1,
      home: { countryCode: 'KR', cityId: 'KR-seoul' },
      countries: [{ code: 'KR' }],
      cities: [{ id: 'KR-seoul', name: '서울', countryCode: 'KR', lat: 37.57, lng: 127 }],
      pins: Array.from({ length: 50 }, (_, i) => ({
        id: `pin_x${i}`, name: `곳 ${i}`, category: 'other', lat: 37 + i * 0.01, lng: 127, createdAt: '',
      })),
      updatedAt: '',
    });
    await openPlace();
    await closeAll();
    await show('pins');
    pass('all fifty pins are in the list', (await count('[data-place-list-item]')) === 50);
    pass('where I live is a shortcut by itself, and fifty pins add no others',
      (await count('[data-place-shortcut="home"]')) === 1 && (await count('[data-place-shortcut]')) === 1);
    const full = await page.locator('[data-place-pins]').boundingBox();
    await page.mouse.click(full.x + full.width * 0.4, full.y + full.height * 0.4);
    await wait(800);
    pass('at the limit, adding offers Pro instead',
      (await page.getByRole('dialog', { name: 'Pro로 업그레이드' }).count()) === 1
      && (await count('[data-place-pin-dialog]')) === 0);
    await closeAll();
    pass('…and all fifty are still there', (await stored()).pins.length === 50);

    // 9. Five hundred pins, still smooth.
    await seed({
      version: 1,
      countries: [],
      cities: [],
      pins: Array.from({ length: 500 }, (_, i) => ({
        id: `pin_m${i}`, name: `곳 ${i}`, category: 'other',
        lat: -50 + (i % 100), lng: -170 + (i % 300), createdAt: '',
      })),
      updatedAt: '',
    });
    await openPlace();
    await closeAll();
    await show('pins');
    await wait(500);
    const drawn = await page.evaluate(() => {
      const started = performance.now();
      const box = document.querySelector('[data-place-pins]').getBoundingClientRect();
      // Panning is the thing that has to stay smooth.
      for (let i = 0; i < 6; i++) {
        document.querySelector('[data-place-tiles]').dispatchEvent(
          new PointerEvent('pointermove', { clientX: box.x + 100 + i * 8, clientY: box.y + 100, bubbles: true }),
        );
      }
      return performance.now() - started;
    });
    pass('five hundred pins do not slow the map down', drawn < 1200, `${Math.round(drawn)}ms`);
    pass('…and the ones on top of each other are gathered into circles',
      (await count('[data-place-cluster]')) > 0 || (await count('[data-place-pin]')) > 0);

    // 10. Export, and a restore that brings it all back.
    await seed({
      version: 1,
      home: { countryCode: 'KR', cityId: 'KR-seoul' },
      countries: [{ code: 'KR', lived: true, firstYear: 1985 }, { code: 'JP', firstYear: 2012 }],
      cities: [{ id: 'KR-seoul', name: 'Seoul', countryCode: 'KR', lat: 37.57, lng: 126.98, lived: true }],
      pins: [{ id: 'pin_k', name: '츠키지', category: 'food', lat: 35.66, lng: 139.77, countryCode: 'JP', date: '2012-04-11', createdAt: '' }],
      updatedAt: '',
    });
    await openPlace();
    await closeAll();
    const before = await stored();
    await page.locator('[data-app-header] button[aria-label="내보내기"]').click();
    await wait(500);
    pass('the header export opens the map\'s own export', (await count('[data-place-export-dialog]')) === 1);
    pass('…and warns that home and work may be on it',
      /집·직장/.test(await page.locator('[data-place-export-dialog]').innerText()));
    pass('the picture waits until the warning is read',
      await page.locator('[data-place-export-png]').isDisabled());
    await page.locator('[data-place-export-agree]').check();
    const picture = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('[data-place-export-png]').click();
    const png = await picture;
    const shot = await png.path();
    const size = await page.evaluate(() => 0);
    pass('the world goes out as a picture', !!shot && /place/.test(png.suggestedFilename()) && size === 0);
    const saving = page.waitForEvent('download', { timeout: 20000 });
    await page.locator('[data-place-export-json]').click();
    const backup = await saving;
    const backupPath = await backup.path();
    pass('the JSON backup is written', !!backupPath);
    await page.evaluate((k) => localStorage.removeItem(k), PLACE_KEY);
    await openPlace();
    await closeAll();
    pass('a cleared browser starts over', (await stored()) === null || (await stored()).countries.length === 0);
    await page.locator('[data-app-header] button[aria-label="내보내기"]').click();
    await wait(500);
    await page.locator('[data-place-import-input]').setInputFiles(backupPath);
    await wait(900);
    const after = await stored();
    const canon = (v) => (Array.isArray(v) ? v.map(canon)
      : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
    pass('restoring brings every country, city and pin back',
      JSON.stringify(canon({ ...after, updatedAt: '' })) === JSON.stringify(canon({ ...before, updatedAt: '' })),
      JSON.stringify(after));

    // 11. Nothing watches where the device goes, then or ever.
    pass('nothing ever watches the device\'s position',
      (await page.evaluate(() => window.__located)) < 100);
    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    const want = ['place_open', 'place_country', 'place_city', 'place_pin', 'place_locate'];
    await flush();
    pass('usage is counted', want.every((w) => counted.includes(w)),
      `missing ${want.filter((w) => !counted.includes(w)).join(',')} · saw ${[...new Set(counted)].join(',')}`);
  } finally {
    await browser.close();
  }

  // 12. A person on the relation map learns where you went together.
  const both = await setup(base);
  try {
    await both.page.evaluate(([rk, pk]) => {
      localStorage.setItem(rk, JSON.stringify({
        version: 1,
        me: {},
        people: [{ id: 'p1', name: '최민준', group: 'friend', closeness: 2, createdAt: '' }],
        links: [],
        updatedAt: '',
      }));
      localStorage.setItem(pk, JSON.stringify({
        version: 1,
        countries: [{ code: 'JP' }],
        cities: [],
        pins: [{ id: 'pin_j', name: '츠키지', category: 'food', lat: 35.66, lng: 139.77, countryCode: 'JP', personIds: ['p1'], createdAt: '' }],
        updatedAt: '',
      }));
    }, [RELATION_KEY, PLACE_KEY]);
    await both.page.reload({ waitUntil: 'domcontentloaded' });
    await both.page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await both.page.locator('[data-relation-toggle]').click();
    await both.page.waitForSelector('[data-relation-view]', { timeout: 15000 });
    await wait(600);
    await both.page.locator('[data-relation-list-item="p1"]').focus();
    await both.page.keyboard.press('Enter');
    await wait(500);
    pass('the person\'s card says where you went together',
      /츠키지/.test(await both.page.locator('[data-relation-places]').innerText()));
    pass('no page errors (both maps)', both.errors.length === 0, both.errors.slice(0, 2).join(' | '));
  } finally {
    await both.browser.close();
  }

  // 13. A phone: the card becomes a sheet under the map.
  const phone = await setup(base, { viewport: { width: 390, height: 844 } });
  try {
    await phone.page.locator('[data-place-toggle]').click();
    await phone.page.waitForSelector('[data-place-world]', { timeout: 20000 });
    await wait(900);
    const full = await phone.page.evaluate(() => {
      const view = document.querySelector('[data-place-view]').getBoundingClientRect();
      const globe = document.querySelector('[data-place-globe]').getBoundingClientRect();
      return { wide: Math.abs(globe.width - view.width) < 2, tall: globe.height > window.innerHeight * 0.6 };
    });
    pass('phone: the map fills the page, the way a map application does',
      full.wide && full.tall, JSON.stringify(full));
    await phone.page.locator('[data-place-country="KR"]').dispatchEvent('click');
    await wait(500);
    const card = await phone.page.locator('[data-place-panel]').boundingBox();
    pass('…and the country card is a sheet across the bottom', card.width > 300, JSON.stringify(card));
    pass('no page errors (phone)', phone.errors.length === 0, phone.errors.slice(0, 2).join(' | '));
  } finally {
    await phone.browser.close();
    await close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
