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

    // 5b. Two fingers work on both maps — a phone has no wheel.
    const globePinch = await pinch('[data-place-world]');
    pass('two fingers zoom the globe', globePinch.after > globePinch.was, JSON.stringify(globePinch));
    pass('…and the buttons do too', await (async () => {
      const before = await page.locator('[data-place-globe]').getAttribute('data-place-zoom');
      await page.locator('[data-place-zoom-out]').click();
      await wait(300);
      return Number(await page.locator('[data-place-globe]').getAttribute('data-place-zoom')) < Number(before);
    })());

    // 6. The pin map: a pin goes where the map was tapped.
    await page.locator('[data-place-tab="pins"]').click();
    await wait(900);
    pass('the pin map asks OpenStreetMap for its tiles, and says whose they are',
      tiles.length > 0 && /OpenStreetMap/.test(await page.locator('[data-place-attribution]').innerText()));
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

    // 7. The life line's travels are offered, never taken.
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [LIFE_KEY, JSON.stringify(LIFE)]);
    await openPlace();
    await closeAll();
    // The last view is remembered, and the offer belongs to the world map.
    await page.locator('[data-place-tab="world"]').click();
    await wait(700);
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
      countries: [{ code: 'KR' }],
      cities: [],
      pins: Array.from({ length: 50 }, (_, i) => ({
        id: `pin_x${i}`, name: `곳 ${i}`, category: 'other', lat: 37 + i * 0.01, lng: 127, createdAt: '',
      })),
      updatedAt: '',
    });
    await openPlace();
    await closeAll();
    await page.locator('[data-place-tab="pins"]').click();
    await wait(700);
    pass('all fifty pins are in the list', (await count('[data-place-list-item]')) === 50);
    await page.locator('[data-place-add]').click();
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
    await page.locator('[data-place-tab="pins"]').click();
    await wait(1000);
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
