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
      localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs: { language: 'ko' } }));
      localStorage.setItem(goalsKey, goalVal);
    }, [GOALS, goal('GOALBASE')]);
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
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

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
