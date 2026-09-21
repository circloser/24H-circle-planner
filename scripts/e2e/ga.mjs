/**
 * Google Analytics gating. The browser opens https://24houring.com, which is
 * routed to the local dist/ build (so ga.ts sees the live host), with
 * /api/geo answered per case and gtag.js replaced by an empty stub. Checks:
 * outside Europe GA loads, with advertising denied and a clean page address,
 * and app events reach it; the ⚙ toggle turns it off (and it stays off after
 * a reload); in the EEA/UK/CH — or when the region is unknown — nothing loads
 * until the visitor turns it on.
 */
import { makeReporter, launchPage, serveDist, seedBasicData, wait, isMain, runStandalone } from './_helpers.mjs';

const LIVE = 'https://24houring.com';

export async function run() {
  const { pass, allOk } = makeReporter('ga');
  const { base, close } = await serveDist();
  const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });

  let geo = { status: 200, body: { consentRequired: false } };
  let tagRequests = 0;

  const layer = () => page.evaluate(() => (window.dataLayer ?? []).map((a) => Array.from(a)));
  const toggle = () => page.locator('[data-ga-toggle]');
  const openSettings = async () => {
    await page.locator('[data-app-header] button:has(svg.lucide-settings)').last().click();
    await wait(300);
  };
  const load = async (path = '/') => {
    tagRequests = 0;
    await page.goto(`${LIVE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await wait(900);
  };

  try {
    await page.route(`${LIVE}/**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/geo') {
        return route.fulfill({ status: geo.status, contentType: 'application/json', body: JSON.stringify(geo.body) });
      }
      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/me') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"user":null,"plan":"free"}' });
        return route.fulfill({ status: 204, body: '' });
      }
      const res = await route.fetch({ url: `${base}${url.pathname}` });
      return route.fulfill({ response: res });
    });
    await page.route('https://www.googletagmanager.com/**', (route) => {
      tagRequests += 1;
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* gtag stub */' });
    });
    await page.addInitScript(() => localStorage.setItem('24h-circle-planner.sync-consent', '1'));

    // 1. Outside Europe: GA loads, advertising denied, clean address.
    await page.goto(`${LIVE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await seedBasicData(page);
    await load('/?login=ok&utm_source=naver&utm_medium=social#p=SECRETCODE');
    pass('outside Europe, gtag.js is loaded', tagRequests === 1, String(tagRequests));
    const dl = await layer();
    const consent = dl.find((a) => a[0] === 'consent' && a[1] === 'default');
    pass('…with every advertising signal denied', !!consent && consent[2].ad_storage === 'denied'
      && consent[2].ad_user_data === 'denied' && consent[2].ad_personalization === 'denied', JSON.stringify(consent));
    const config = dl.find((a) => a[0] === 'config');
    pass('…and a page address without share codes or sign-in details',
      !!config && config[2].page_location === `${LIVE}/?utm_source=naver&utm_medium=social`
      && config[2].allow_google_signals === false, JSON.stringify(config?.[2]));
    pass('nothing sent carries the share code', !JSON.stringify(dl).includes('SECRETCODE'));

    await page.locator('[data-calendar-toggle]').click();
    await wait(600);
    const events = (await layer()).filter((a) => a[0] === 'event').map((a) => a[1]);
    pass('app events reach GA', events.includes('app_open') && events.includes('calendar_open'), JSON.stringify(events));
    // The app is one document; without these GA sees one page and can say
    // nothing about which part of it anybody uses.
    const pages = (await layer())
      .filter((a) => a[0] === 'event' && a[1] === 'page_view')
      .map((a) => a[2]?.page_path);
    pass('…and every page of the app is a page in GA',
      pages.includes('/app/chart') && pages.includes('/app/calendar'), JSON.stringify(pages));
    await page.locator('[data-calendar-toggle]').click().catch(() => {});
    await wait(300);

    await openSettings();
    pass('⚙ shows usage statistics as on', (await toggle().getAttribute('data-state')) === 'checked',
      String(await toggle().getAttribute('data-state')));

    // 2. Turning it off: stops now, and stays off.
    await toggle().click();
    await wait(300);
    const after = await layer();
    pass('turning it off revokes analytics storage at once',
      after.some((a) => a[0] === 'consent' && a[1] === 'update' && a[2].analytics_storage === 'denied'));
    await page.keyboard.press('Escape');
    await load('/');
    pass('…and GA stays off after a reload', tagRequests === 0 && (await layer()).length === 0, String(tagRequests));

    // 3. In Europe: nothing until the visitor turns it on.
    await page.evaluate(() => { localStorage.removeItem('24h-ga-choice'); sessionStorage.clear(); });
    geo = { status: 200, body: { consentRequired: true } };
    await load('/');
    pass('in the EEA/UK/CH, gtag.js is not loaded', tagRequests === 0 && (await layer()).length === 0, String(tagRequests));
    await openSettings();
    pass('…and ⚙ shows it as off', (await toggle().getAttribute('data-state')) === 'unchecked');
    await toggle().click();
    await wait(600);
    pass('turning it on there loads GA', tagRequests === 1, String(tagRequests));
    await page.keyboard.press('Escape');
    await load('/');
    pass('…and that choice is kept', tagRequests === 1, String(tagRequests));

    // 4. Region unknown (the check fails): ask first.
    await page.evaluate(() => { localStorage.removeItem('24h-ga-choice'); sessionStorage.clear(); });
    geo = { status: 500, body: { error: 'x' } };
    await load('/');
    pass('when the region cannot be told, GA stays off', tagRequests === 0, String(tagRequests));

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
