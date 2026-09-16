/**
 * Cross-device sync merge — the launch-critical guarantee that editing DIFFERENT
 * things on two devices never silently drops one side.
 *
 * Runs the real sync engine against a MOCK /api/sync that implements the same
 * optimistic-concurrency the Worker does (409 when the caller's baseVersion is
 * behind). Scenario mirrors the reported failure:
 *   1. Device A seeds the cloud (a goal) → v1.
 *   2. Device B (simulated server-side) changes the GOAL → v2.
 *   3. Device A, still at v1, adds a MEMO through the UI and pushes → 409.
 *   4. The engine 3-way merges against the common ancestor → BOTH survive.
 * Whole-blob last-write-wins (the old code) would have discarded one side.
 */
import { makeReporter, launchPage, serveDist, wait, isMain, runStandalone } from './_helpers.mjs';

const K = (s) => `24h-circle-planner.${s}`;
const GOALS = K('goals');
const MEMOS = K('memos');
const goal = (label) => JSON.stringify({ version: 1, goals: [{ id: 'g', label, targetMinutes: 60, period: 'day' }] });

function mockApi(page, store) {
  return Promise.all([
    page.route('**/api/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'u1', email: 't@sync', provider: 'google' }, plan: 'pro' }) }),
    ),
    page.route('**/api/sync', async (route) => {
      const req = route.request();
      if (req.method() === 'GET') {
        if (store.blob === null) return route.fulfill({ status: 204, body: '' });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blob: store.blob, version: store.version, updatedAt: store.updatedAt, deviceLabel: 'PC' }) });
      }
      const body = JSON.parse(req.postData() || '{}');
      // Optimistic concurrency: reject a push built on a stale version.
      if (typeof body.baseVersion === 'number' && body.baseVersion !== store.version) {
        return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'conflict', blob: store.blob, version: store.version, updatedAt: store.updatedAt, deviceLabel: 'PC' }) });
      }
      store.blob = body.blob;
      store.version += 1;
      store.updatedAt = Date.now();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: store.version, updatedAt: store.updatedAt }) });
    }),
  ]);
}

async function until(pred, ms = 20000, step = 250) {
  for (let t = 0; t < ms; t += step) { if (await pred()) return true; await wait(step); }
  return await pred();
}

const dataOf = (store) => { try { return JSON.parse(store.blob).data; } catch { return {}; } };
const memoCount = (store) => { try { return JSON.parse(dataOf(store)[MEMOS]).memos.length; } catch { return 0; } };

export async function run() {
  const { pass, allOk } = makeReporter('sync');
  const store = { blob: null, version: 0, updatedAt: 0 };
  const { base, close } = await serveDist();
  const { browser, page, errors } = await launchPage({ locale: 'ko-KR' });
  try {
    await mockApi(page, store);
    // Seed ONCE — guarded so the merge's reload doesn't re-seed the base values
    // (addInitScript re-runs on every navigation; without the guard a reload
    // would reset localStorage and look like a data-loss revert).
    await page.addInitScript(([goalsKey, goalVal]) => {
      if (localStorage.getItem('__synctest_seeded')) return;
      localStorage.setItem('__synctest_seeded', '1');
      localStorage.setItem('24h-circle-planner.onboarded', '1');
      // Pre-answer the privacy gate — this suite tests sync mechanics.
      localStorage.setItem('24h-circle-planner.sync-consent', '1');
      localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs: { language: 'ko' } }));
      localStorage.setItem(goalsKey, goalVal);
    }, [GOALS, goal('GOALBASE')]);
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await page.keyboard.press('Escape').catch(() => {});

    // 1. Device A seeds the cloud (v1).
    pass('device A seeds cloud', await until(() => !!store.blob && store.blob.includes('GOALBASE')));
    const seeded = store.version;

    // 2. Device B changes the GOAL on the server → v2 (built from A's blob so
    //    only goals differ).
    {
      const env = JSON.parse(store.blob);
      env.data[GOALS] = goal('GOALFROMB');
      env.modifiedAt = env.modifiedAt + 1;
      store.blob = JSON.stringify(env);
      store.version = seeded + 1;
      store.updatedAt = Date.now();
    }

    // 3. Device A adds a MEMO through the UI (provider-consistent) while still at
    //    v1 → its next push 409s against B's version.
    const addBtn = page.getByRole('button', { name: '메모 추가' }).first();
    await addBtn.click();
    await wait(400);
    await addBtn.click(); // a second memo, to be unambiguous
    await wait(400);

    // 4. The engine must 3-way merge and push a union that keeps BOTH edits.
    const merged = await until(() => {
      const d = dataOf(store);
      return store.version >= seeded + 2 && !!d[GOALS] && d[GOALS].includes('GOALFROMB') && memoCount(store) > 0;
    });
    // Let it settle a beat to catch any revert-loop, then assert the FINAL state.
    await wait(3000);
    const d = dataOf(store);
    pass("device B's goal edit survived (GOALFROMB in cloud)", !!d[GOALS] && d[GOALS].includes('GOALFROMB'), d[GOALS]?.slice(0, 70));
    pass("device A's memo edit survived (memo in cloud)", memoCount(store) > 0, `memos=${memoCount(store)}`);
    pass('both edits merged & stable (no whole-blob loss, no revert)', merged && !!d[GOALS] && d[GOALS].includes('GOALFROMB') && memoCount(store) > 0, `v=${store.version}`);

    // 5. A settings change from the cloud shows the sync toast, and it leaves on
    //    its own even with the mouse resting on it (sonner pauses its own
    //    countdown on hover, which used to leave it up for good).
    {
      const PREFS_KEY = K('prefs');
      const env = JSON.parse(store.blob);
      const p = JSON.parse(env.data[PREFS_KEY]);
      p.prefs.showIcons = !(p.prefs.showIcons ?? true);
      env.data[PREFS_KEY] = JSON.stringify(p);
      env.modifiedAt += 1;
      store.blob = JSON.stringify(env);
      store.version += 1;
      store.updatedAt = Date.now();
    }
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const syncToast = page.locator('[data-sonner-toast]:not([data-removed="true"])', { hasText: '클라우드에서 동기화되었습니다' });
    const toastShown = await until(async () => (await syncToast.count()) > 0, 20000);
    pass('a settings change from the cloud shows the sync toast', toastShown);
    if (toastShown) {
      const box = await syncToast.first().boundingBox();
      await page.mouse.move(box.x + 30, box.y + box.height / 2);
      const gone = await until(async () => (await syncToast.count()) === 0, 15000);
      pass('the sync toast leaves on its own even with the mouse on it', gone);
      await page.mouse.move(5, 300);
    }

    // 6. The pet crosses devices even when the live adopt is missed: a sync that
    //    also changes days/diary RELOADS the page, and a device that was closed
    //    never sees the event at all. Both land on the startup path.
    const TAMA = '24h-tamagotchi.sync';
    const cloudCheckpoint = {
      v: 1, savedAt: Date.now() - 60000, on: true, hygiene: 90, poops: 0,
      pets: [{ id: 'cloudpet', species: 'blob', phase: 'baby', bornAt: 1, hatchAt: 1, hatchedAt: 1, hunger: 90, happiness: 70, energy: 80, sleeping: false, plays: 42, name: null, lastPoopAt: Date.now(), nextPoopIn: 9000000, hungerZeroSince: null }],
    };
    {
      const env = JSON.parse(store.blob);
      env.data[TAMA] = JSON.stringify(cloudCheckpoint);
      env.modifiedAt += 1;
      store.blob = JSON.stringify(env);
      store.version += 1;
      store.updatedAt = Date.now();
    }
    // This device was closed while that happened: no live event, no pet of its own.
    await page.evaluate(() => {
      localStorage.removeItem('24h-tamagotchi');
      localStorage.removeItem('24h-tamagotchi.seen');
    });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await wait(2500);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await wait(1500);
    const pet = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('24h-tamagotchi')); } catch { return null; } });
    pass('a pet fed on another device arrives after a reload',
      !!pet && pet.pets?.[0]?.id === 'cloudpet' && pet.pets[0].plays === 42,
      JSON.stringify(pet && pet.pets ? pet.pets.map((p) => [p.id, p.plays]) : pet));

    // Connected Google calendars follow the account; their downloaded text does not.
    const ICAL = K('ical');
    const ICAL_CACHE = K('ical-cache');
    const FEED = 'https://calendar.google.com/calendar/ical/me%40example.com/private-abc/basic.ics';
    {
      const env = JSON.parse(store.blob);
      env.data[ICAL] = JSON.stringify({ version: 3, feeds: [{ id: 'f1', url: FEED }] });
      env.modifiedAt += 1;
      store.blob = JSON.stringify(env);
      store.version += 1;
      store.updatedAt = Date.now();
    }
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await wait(2500);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await wait(1500);
    pass('a calendar connected on another device arrives here',
      String(await page.evaluate((k) => localStorage.getItem(k), ICAL)).includes(FEED),
      String(await page.evaluate((k) => localStorage.getItem(k), ICAL)).slice(0, 80));

    const beforePush = store.version;
    await page.evaluate(([cache, goals]) => {
      localStorage.setItem(cache, JSON.stringify({ version: 1, byId: { f1: { ics: 'BEGIN:VCALENDAR END:VCALENDAR', fetchedAt: Date.now() } } }));
      localStorage.setItem(goals, JSON.stringify({ version: 1, goals: [{ id: 'g', label: 'PUSHME', targetMinutes: 60, period: 'day' }] }));
      window.dispatchEvent(new StorageEvent('storage', { key: goals }));
    }, [ICAL_CACHE, GOALS]);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await wait(5000);
    const pushed = JSON.parse(store.blob).data;
    pass('…but the downloaded feed text never goes up',
      store.version > beforePush && !(ICAL_CACHE in pushed) && ICAL in pushed,
      JSON.stringify(Object.keys(pushed).filter((k) => k.includes('ical'))));

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

    // A PHONE is not a lesser device: a Pro account syncs there the same way.
    // (Reported as "sync doesn't work on mobile", so it is pinned here.)
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const small = await phone.newPage();
    try {
      await mockApi(small, store);
      await small.addInitScript(() => localStorage.setItem('24h-circle-planner.sync-consent', '1'));
      // Something only the cloud knows about, waiting for the phone.
      {
        const env = JSON.parse(store.blob);
        env.data[GOALS] = goal('FROMDESKTOP');
        env.modifiedAt += 1;
        store.blob = JSON.stringify(env);
        store.version += 1;
        store.updatedAt = Date.now();
      }
      await small.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await small.waitForSelector('svg[data-circle-timeline]', { timeout: 20000 });
      await wait(6000);
      const onPhone = await small.evaluate((k) => localStorage.getItem(k), GOALS);
      pass('a phone takes down what the desktop pushed', String(onPhone).includes('FROMDESKTOP'), String(onPhone).slice(0, 60));

      // …and what it changes goes back up.
      const was = store.version;
      await small.evaluate((k) => {
        localStorage.setItem(k, JSON.stringify({ version: 1, goals: [{ id: 'g', label: 'FROMPHONE', targetMinutes: 60, period: 'day' }] }));
        window.dispatchEvent(new StorageEvent('storage', { key: k }));
      }, GOALS);
      await small.evaluate(() => window.dispatchEvent(new Event('focus')));
      await wait(6000);
      const cloud = JSON.parse(store.blob).data[GOALS] ?? '';
      pass('…and a change made on the phone reaches the cloud', cloud.includes('FROMPHONE') && store.version > was,
        `v${was} → v${store.version}`);
    } finally {
      await phone.close();
    }
  } finally {
    await browser.close();
    close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
