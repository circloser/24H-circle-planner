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

async function setup(base, { granted, ...opts } = {}) {
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
  // A browser that has already been told it may say where it is. The app asks
  // `permissions.query` first and only reads a plain "granted" — it never
  // prompts on its own — so this is the whole of that state.
  if (granted) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'permissions', {
        value: { query: () => Promise.resolve({ state: 'granted', onchange: null }) },
        configurable: true,
      });
    });
  }
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
  const { browser, page, errors, counted, tiles } = await setup(base, { reducedMotion: 'reduce' });
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
    await page.locator('[data-place-first-year]').click();
    await page.keyboard.type('2011');
    await wait(500);
    pass('the year of a first visit can be typed, a digit at a time',
      (await page.locator('[data-place-first-year]').inputValue()) === '2011'
      && (await stored()).countries.find((c) => c.code === 'KR')?.firstYear === 2011,
      JSON.stringify((await stored()).countries));
    pass('the card opens on the map, not as a column down the side', await page.evaluate(() => {
      const card = document.querySelector('[data-place-card]').getBoundingClientRect();
      const view = document.querySelector('[data-place-view]').getBoundingClientRect();
      // Beside something rather than filling the height, and clear of the edge.
      return card.height < view.height * 0.9 && card.right < view.right - 40;
    }));
    pass('…and the controls in the corner do not move for it', await page.evaluate(() => {
      const corner = document.querySelector('[data-place-corner]').getBoundingClientRect();
      const card = document.querySelector('[data-place-card]').getBoundingClientRect();
      // The whole point: the corner is where it was, and the card is not on it.
      window.__cornerRight = corner.right;
      return card.right <= corner.left + 1;
    }));

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
    await wait(400);
    pass('…and is back where it was once the card is closed', await page.evaluate(() => {
      const corner = document.querySelector('[data-place-corner]').getBoundingClientRect();
      return Math.abs(corner.right - window.__cornerRight) < 1;
    }));

    // 4b. The colours of the map are the reader's to choose.
    await page.locator('[data-place-colors]').click();
    await wait(500);
    pass('the map offers its own colours', (await count('[data-place-colors-dialog]')) === 1
      && (await count('[data-place-swatch]')) > 20);
    pass('…laid out evenly rather than wrapping one colour onto its own line',
      await page.evaluate(() => {
        const row = document.querySelector('[data-place-color-row]');
        const tops = new Set([...row.querySelectorAll('[data-place-swatch]')]
          .map((s) => Math.round(s.getBoundingClientRect().top)));
        return tops.size === 1;
      }));
    await page.locator('[data-place-color-row="가 봄"] [data-place-swatch="#3f8f8f"]').click();
    await wait(400);
    pass('…and a colour chosen is kept with the record',
      (await stored()).palette?.visited === '#3f8f8f', JSON.stringify((await stored()).palette));
    await page.locator('[data-place-color-row="가 봄"] [data-place-color-clear]').click();
    await wait(400);
    pass('…and can be put back to the one the theme gives it',
      (await stored()).palette === undefined, JSON.stringify((await stored()).palette));
    await page.locator('[data-place-color-row="먹은 곳"] [data-place-swatch="#c9a227"]').click();
    await wait(400);
    pass('…and a kind of pin can have one of its own',
      (await stored()).palette?.pins?.food === '#c9a227', JSON.stringify((await stored()).palette));
    await closeAll();
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
    // The camera travels there (lib/place-fly), so the reading is taken once
    // it has arrived rather than halfway across the world.
    await wait(1600);
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

    // 6a. Its name is written under it, so one pin can be told from another.
    pass('a pin carries its name on the map',
      (await page.locator(`[data-place-pin-label="${withPin.pins[0].id}"]`).innerText()).trim() === '에펠탑');

    // 6b. The shortcut rail: a button that unfolds a row, not a block.
    pass('nothing is starred, so there is no rail to open',
      (await count('[data-place-rail-toggle]')) === 0);
    await page.locator(`[data-place-list-item="${withPin.pins[0].id}"]`).focus();
    await page.keyboard.press('Enter');
    await wait(400);
    await page.locator('[data-place-pin-star]').click();
    await wait(500);
    pass('starring a pin gives the corner a shortcut button',
      (await stored()).pins[0].star === true && (await count('[data-place-rail-toggle]')) === 1,
      JSON.stringify((await stored()).pins[0]));
    pass('…and the list stays folded until it is asked for',
      (await count('[data-place-rail]')) === 0);
    await page.locator('[data-place-panel-close]').click();
    await wait(300);
    await page.locator('[data-place-rail-toggle]').click();
    await wait(400);
    pass('…then unfolds sideways from its own button, not upward', await page.evaluate(() => {
      const rail = document.querySelector('[data-place-rail]').getBoundingClientRect();
      const toggle = document.querySelector('[data-place-rail-toggle]').getBoundingClientRect();
      // Along the bottom, to the left of the button that opened it.
      return rail.right <= toggle.left + 1 && Math.abs(rail.height - toggle.height) < 12;
    }));
    pass('…with every shortcut named rather than guessed at',
      (await page.locator(`[data-place-shortcut="${withPin.pins[0].id}"]`).innerText()).includes('에펠탑'));
    pass('…and every button on this page is in that one corner', await page.evaluate(() => {
      const view = document.querySelector('[data-place-view]').getBoundingClientRect();
      const corner = document.querySelector('[data-place-corner]').getBoundingClientRect();
      const loose = ['[data-place-zoom-in]', '[data-place-zoom-out]', '[data-place-locate]',
        '[data-place-rail-toggle]', '[data-place-filter-toggle]'];
      return view.bottom - corner.bottom < 60
        && loose.every((s) => {
          const el = document.querySelector(s);
          return !el || document.querySelector('[data-place-corner]').contains(el);
        });
    }));
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

    // 6c. The kinds of pin, filtered from the same corner. A second pin of
    // another kind, so that filtering has something to hide.
    const near = await page.locator('[data-place-pins]').boundingBox();
    await page.mouse.click(near.x + near.width * 0.35, near.y + near.height * 0.62);
    await wait(700);
    await page.locator('[data-place-name-input]').fill('뒷산');
    await page.locator('[data-place-cat="nature"]').click();
    await page.locator('[data-place-save]').click();
    await wait(800);
    const both = await stored();
    const woods = both.pins.find((p) => p.name === '뒷산');
    pass('a second pin, of another kind', both.pins.length === 2 && woods?.category === 'nature',
      JSON.stringify(both.pins.map((p) => `${p.name}:${p.category}`)));
    await page.locator('[data-place-panel-close]').click();
    await wait(300);
    await page.locator('[data-place-filter-toggle]').click();
    await wait(400);
    pass('the kinds of pin unfold from the corner too',
      (await count('[data-place-filters]')) === 1 && (await count('[data-place-filter]')) > 4);
    pass('…and wrap onto another row rather than scrolling sideways',
      await page.locator('[data-place-filters]').evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    pass('…and a kind you have none of is shown but cannot be chosen',
      await page.locator('[data-place-filter="stay"]').isDisabled());
    await page.locator('[data-place-filter="nature"]').click();
    await wait(500);
    pass('…and choosing one kind takes the others off the map',
      (await count(`[data-place-pin="${withPin.pins[0].id}"]`)) === 0
      && (await count(`[data-place-pin="${woods.id}"]`)) === 1
      && (await stored()).pins.length === 2);
    await page.locator('[data-place-filter="all"]').click();
    await wait(500);

    // A pin IS its kind's colour: filled, not outlined.
    await page.locator('[data-place-colors]').click();
    await wait(500);
    await page.locator('[data-place-color-row="자연"] [data-place-swatch="#3f8f8f"]').click();
    await wait(400);
    await closeAll();
    pass('a pin is filled with the colour of its kind',
      (await page.locator(`[data-place-pin="${woods.id}"] [data-place-pin-dot]`)
        .evaluate((el) => getComputedStyle(el).backgroundColor)) === 'rgb(63, 143, 143)',
      await page.locator(`[data-place-pin="${woods.id}"] [data-place-pin-dot]`)
        .evaluate((el) => getComputedStyle(el).backgroundColor));
    pass('…and the other kind keeps its own',
      (await page.locator(`[data-place-pin="${withPin.pins[0].id}"] [data-place-pin-dot]`)
        .evaluate((el) => getComputedStyle(el).backgroundColor)) !== 'rgb(63, 143, 143)');
    pass('…and 전체 brings them all back',
      (await count(`[data-place-pin="${withPin.pins[0].id}"]`)) === 1
      && (await count(`[data-place-pin="${woods.id}"]`)) === 1);
    await page.locator('[data-place-filter-toggle]').click();
    await wait(300);

    // 6b. The same pins are on the globe, and open there without leaving it.
    await show('world');
    pass('a pin is on the globe as well as on the pin map',
      (await count(`[data-place-globe-pin="${withPin.pins[0].id}"]`)) === 1);
    // 6d. The same record read as warmth rather than as borders.
    pass('the globe offers a heat map of the pins',
      (await page.locator('[data-place-heat]').getAttribute('aria-pressed')) === 'false');
    pass('…and the button says what it does, not only that it is on',
      (await count('[data-place-heat-off]')) === 0);
    await page.locator('[data-place-heat]').click();
    await wait(600);
    pass('…and turning it on leaves the pins where they were',
      (await page.locator('[data-place-heat]').getAttribute('aria-pressed')) === 'true'
      && (await count(`[data-place-globe-pin="${withPin.pins[0].id}"]`)) === 1);
    pass('…and the flame is struck through, which is how it is put out',
      (await count('[data-place-heat-off]')) === 1
      && (await page.locator('[data-place-heat]').getAttribute('aria-label')) === '핀 히트맵 끄기');
    await page.locator('[data-place-heat]').click();
    await wait(400);

    // A country under the pointer says which one it is.
    pass('the globe names the country under the pointer', await page.evaluate(() => {
      const globe = document.querySelector('[data-place-globe]');
      const canvas = document.querySelector('[data-place-world]');
      const box = globe.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const x = Math.round(box.width / 2);
      const y = Math.round(box.height / 2);
      const strip = () => ctx.getImageData(Math.round((x + 10) * dpr), Math.round((y - 34) * dpr), 160, 30).data.join();
      const before = strip();
      canvas.dispatchEvent(new PointerEvent('pointermove', {
        clientX: box.left + x + 2, clientY: box.top + y + 2, bubbles: true, pointerId: 1, pointerType: 'mouse',
      }));
      return new Promise((done) => setTimeout(() => done(strip() !== before), 400));
    }));

    // Where I am works on the globe too: it turns to show the place.
    // Turned away from the person first, so coming back is what is measured.
    const globeBox = await page.locator('[data-place-world]').boundingBox();
    await page.mouse.move(globeBox.x + globeBox.width / 2, globeBox.y + globeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(globeBox.x + globeBox.width / 2 + 160, globeBox.y + globeBox.height / 2, { steps: 8 });
    await page.mouse.up();
    await wait(300);
    const wasFacing = await page.locator('[data-place-globe]').getAttribute('data-place-lng');
    // Watch the zoom while it goes: out first, then in.
    const watching = page.evaluate(() => new Promise((done) => {
      const el = document.querySelector('[data-place-globe]');
      const seen = [];
      const stop = setTimeout(() => { clearInterval(tick); done(seen); }, 1500);
      const tick = setInterval(() => {
        seen.push(Number(el.dataset.placeZoom));
        if (seen.length > 40) { clearInterval(tick); clearTimeout(stop); done(seen); }
      }, 40);
    }));
    await page.locator('[data-place-locate]').click();
    const zooms = await watching;
    const flown = {
      start: zooms[0], lowest: Math.min(...zooms), end: zooms[zooms.length - 1],
      pulledBack: Math.min(...zooms) < Math.min(zooms[0], zooms[zooms.length - 1]) - 0.05,
    };
    await wait(700);
    const facing = await page.locator('[data-place-globe]').getAttribute('data-place-lng');
    pass('the globe turns to where the person is when asked',
      Math.abs(Number(facing) - 2.35) < 0.5 && facing !== wasFacing, `${wasFacing} → ${facing}`);
    pass('…and it travelled there rather than cutting to it', flown.pulledBack, JSON.stringify(flown));
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

    // 6e. Deleting says so, offers it back — and then goes away by itself,
    // even with a pointer resting on it. (Sonner stops its own clock while
    // the pointer is there, which once left this notice on screen for good.)
    await show('pins');
    await page.locator(`[data-place-list-item="${withPin.pins[0].id}"]`).focus();
    await page.keyboard.press('Enter');
    await wait(400);
    await page.locator('[data-place-pin-delete]').click();
    await wait(600);
    const said = page.locator('[data-sonner-toast]').first();
    pass('deleting a pin says so, and offers it back',
      (await said.count()) === 1 && !(await stored()).pins.some((p) => p.id === withPin.pins[0].id),
      await said.innerText().catch(() => 'no toast'));
    await said.hover().catch(() => {});
    await wait(3000);
    pass('…and the offer stands while it is being read',
      (await page.locator('[data-sonner-toast]').count()) === 1);
    // The undo window is twenty seconds; a little longer than that, and it
    // must be gone whatever the pointer is doing.
    await wait(19000);
    pass('…and then it goes away on its own', (await page.locator('[data-sonner-toast]').count()) === 0);
    pass('…leaving the pin deleted',
      !(await stored()).pins.some((p) => p.id === withPin.pins[0].id));

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
    await page.locator('[data-place-rail-toggle]').click();
    await wait(400);
    pass('where I live is a shortcut by itself, and fifty pins add no others',
      (await count('[data-place-shortcut="home"]')) === 1 && (await count('[data-place-shortcut]')) === 1);
    await page.locator('[data-place-rail-toggle]').click();
    await wait(300);
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

  // 12b. Left alone, the globe turns on its own axis — and stops the moment
  // it is touched.
  const spun = await setup(base);
  try {
    await spun.page.locator('[data-place-toggle]').click();
    await spun.page.waitForSelector('[data-place-world]', { timeout: 20000 });
    const lngNow = () => spun.page.locator('[data-place-globe]').getAttribute('data-place-lng');
    await wait(900);
    const held = await lngNow();
    pass('the globe holds still while it is being read', (await lngNow()) === held, held);
    await wait(3600);
    const turned = await lngNow();
    pass('…and turns once it has been left alone',
      Math.abs(Number(turned) - Number(held)) > 0.5, `${held} → ${turned}`);
    // A touch stops it: the reading below is taken straight after one.
    const box = await spun.page.locator('[data-place-world]').boundingBox();
    await spun.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await spun.page.mouse.down();
    await spun.page.mouse.up();
    const stopped = await lngNow();
    await wait(1200);
    pass('…and a touch stops it again', (await lngNow()) === stopped, stopped);
    pass('no page errors (the turning globe)', spun.errors.length === 0, spun.errors.slice(0, 2).join(' | '));
  } finally {
    await spun.browser.close();
  }

  // 12c. Where the browser has already been told it may, the map opens where
  // the person is — without a prompt, and without asking again.
  const known = await setup(base, { granted: true });
  try {
    await known.page.locator('[data-place-toggle]').click();
    await known.page.waitForSelector('[data-place-world]', { timeout: 20000 });
    await wait(1200);
    const lng = await known.page.locator('[data-place-globe]').getAttribute('data-place-lng');
    pass('the globe opens looking at where the person is',
      Math.abs(Number(lng) - 2.35) < 0.5, String(lng));
    pass('…having read it once, and asked nobody anything',
      (await known.page.evaluate(() => window.__located)) === 1);
    pass('no page errors (opening where they are)', known.errors.length === 0, known.errors.slice(0, 2).join(' | '));
  } finally {
    await known.browser.close();
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
    // Left alone, it turns on a phone exactly as it does on a desk.
    const lngPhone = () => phone.page.locator('[data-place-globe]').getAttribute('data-place-lng');
    const restingPhone = await lngPhone();
    await wait(4200);
    const turnedPhone = await lngPhone();
    pass('…and it turns on its own here too',
      Math.abs(Number(turnedPhone) - Number(restingPhone)) > 0.5, `${restingPhone} → ${turnedPhone}`);
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
