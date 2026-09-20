/**
 * Two pictures of the place map, world and pins, for a look at how it sits
 * beside the other tabs. Run over dist/:
 *   npm run build && node scripts/screenshot-place.mjs
 */
import { launchPage, serveDist, seedBasicData, wait } from './e2e/_helpers.mjs';

const PLACE_KEY = '24h-circle-planner.place';
const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

const PLACE = {
  version: 1,
  home: { countryCode: 'KR', cityId: 'KR-seoul' },
  countries: [
    { code: 'KR', lived: true, firstYear: 1985 }, { code: 'JP', firstYear: 2012 },
    { code: 'FR', firstYear: 2018 }, { code: 'IT', firstYear: 2018 },
    { code: 'US', firstYear: 2015 }, { code: 'TH', firstYear: 2019 },
    { code: 'VN' }, { code: 'AU', firstYear: 2023 }, { code: 'GB', firstYear: 2016 },
    { code: 'ES', firstYear: 2022 }, { code: 'TW', firstYear: 2014 },
  ],
  cities: [
    { id: 'KR-seoul', name: 'Seoul', countryCode: 'KR', lat: 37.57, lng: 126.98, lived: true },
    { id: 'JP-tokyo', name: 'Tokyo', countryCode: 'JP', lat: 35.69, lng: 139.69 },
    { id: 'FR-paris', name: 'Paris', countryCode: 'FR', lat: 48.87, lng: 2.33 },
    { id: 'US-new-york', name: 'New York', countryCode: 'US', lat: 40.71, lng: -74.01 },
    { id: 'GB-london', name: 'London', countryCode: 'GB', lat: 51.5, lng: -0.12 },
  ],
  pins: [
    { id: 'pin_a', name: '오르세 미술관', category: 'culture', lat: 48.86, lng: 2.33, countryCode: 'FR', date: '2018-06-02', createdAt: '' },
    { id: 'pin_b', name: '츠키지 시장', category: 'food', lat: 35.66, lng: 139.77, countryCode: 'JP', date: '2012-04-11', createdAt: '' },
    { id: 'pin_c', name: '에어비앤비', category: 'stay', lat: 48.85, lng: 2.35, countryCode: 'FR', date: '2018-06-01', createdAt: '' },
  ],
  updatedAt: '',
};

const shot = async (base, name, viewport, tab) => {
  const { browser, page } = await launchPage({ viewport });
  await page.route('**/api/sync*', (route) => route.fulfill(json({ version: 0, data: {}, updatedAt: 0 })));
  await page.route('**/api/me', (route) => route.fulfill(json({ user: null, plan: 'free' })));
  await page.route('**/api/life/memoir', (route) => route.fulfill(json({ enabled: false })));
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
  await seedBasicData(page);
  await page.evaluate(([k, d, t]) => {
    localStorage.setItem(k, JSON.stringify(d));
    localStorage.setItem('24h-place-tab', t);
  }, [PLACE_KEY, PLACE, tab]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
  await page.locator('[data-place-toggle]').click();
  await page.waitForSelector('[data-place-view]', { timeout: 15000 });
  await wait(tab === 'pins' ? 5000 : 1800);
  await page.screenshot({ path: name });
  await browser.close();
  console.log('wrote', name);
};

const { base, close } = await serveDist();
try {
  await shot(base, 'place-world.png', { width: 1440, height: 900 }, 'world');
  await shot(base, 'place-pins.png', { width: 1440, height: 900 }, 'pins');
} finally {
  await close();
}
