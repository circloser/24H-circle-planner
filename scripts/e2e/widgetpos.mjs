/**
 * Each device keeps its own widget layout across sync. Two "devices" with
 * different screens (A 1600×900, B 1280×800) share a mock /api/sync (same
 * optimistic concurrency as the Worker). A has a clock and a post-it; B drags
 * both elsewhere. A's widgets must not move, the cloud version must not
 * ping-pong while both sit idle, and B must keep its own arrangement after its
 * window gets shorter (layouts are remembered per monitor, not per window size).
 * Needs dist/ over http.
 */
import { makeReporter, launchPage, serveDist, wait, isMain, runStandalone } from './_helpers.mjs';

const json = (data, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(data) });

export async function run() {
  const { pass, allOk } = makeReporter('widgetpos');
  const store = { blob: null, version: 0, updatedAt: 0 };
  const { base, close } = await serveDist();
  const browsers = [];

  async function device(size, seed) {
    const { browser, page, errors } = await launchPage({ locale: 'ko-KR', viewport: size, screen: size });
    browsers.push(browser);
    await page.route('**/api/me', (r) => r.fulfill(json({ user: { id: 'u1', email: 't@sync', provider: 'google' }, plan: 'pro' })));
    await page.route('**/api/sync', async (route) => {
      const req = route.request();
      if (req.method() === 'GET') {
        if (store.blob === null) return route.fulfill({ status: 204, body: '' });
        return route.fulfill(json({ blob: store.blob, version: store.version, updatedAt: store.updatedAt, deviceLabel: 'PC' }));
      }
      const body = JSON.parse(req.postData() || '{}');
      if (typeof body.baseVersion === 'number' && body.baseVersion !== store.version) {
        return route.fulfill(json({ error: 'conflict', blob: store.blob, version: store.version, updatedAt: store.updatedAt, deviceLabel: 'PC' }, 409));
      }
      store.blob = body.blob;
      store.version += 1;
      store.updatedAt = Date.now();
      return route.fulfill(json({ version: store.version, updatedAt: store.updatedAt }));
    });
    await page.addInitScript((s) => {
      if (localStorage.getItem('__widgetpos_seeded')) return; // reloads must not re-seed
      localStorage.setItem('__widgetpos_seeded', '1');
      localStorage.setItem('24h-circle-planner.onboarded', '1');
      localStorage.setItem('24h-circle-planner.sync-consent', '1');
      localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs: { language: 'ko' } }));
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    }, seed);
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await page.mouse.move(5, 300);
    return { page, errors };
  }

  // Widget top-left relative to the viewport centre (the space positions live in).
  const offsets = (page) => page.evaluate(() => {
    const at = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.left - window.innerWidth / 2), y: Math.round(b.top - window.innerHeight / 2) };
    };
    return { clock: at(document.querySelector('[data-clock-widget]')), memo: at(document.querySelector('.memo-note')) };
  });
  const same = (a, b) => !!a && !!b && Math.abs(a.x - b.x) <= 2 && Math.abs(a.y - b.y) <= 2;
  const pull = (page) => page.evaluate(() => window.dispatchEvent(new Event('focus')));
  async function drag(page, selector, dx, dy) {
    const box = await page.locator(selector).first().boundingBox();
    const sx = box.x + box.width / 2;
    const sy = box.y + 12;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + dx, sy + dy, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(5, 300);
  }

  const seedA = {
    '24h-circle-planner.clocktools': JSON.stringify({ version: 1, coords: 'centre', state: {
      clocks: [{ id: 'c1', mode: 'analog', pos: { x: -760, y: -340 }, tz: null }],
      calendar: { on: false, pos: { x: -700, y: -100 } }, weathers: [],
    } }),
    '24h-circle-planner.memos': JSON.stringify({ version: 1, coords: 'centre', memos: [
      { id: 'm1', text: 'A', x: 560, y: -330, color: '#fef08a', fontFamily: 'Pretendard', align: 'center', createdAt: 1, onScreen: true },
    ], visible: true }),
  };

  try {
    const A = await device({ width: 1600, height: 900 }, seedA);
    await wait(6000);
    const a0 = await offsets(A.page);
    pass('device A shows its clock and post-it', !!a0.clock && !!a0.memo, JSON.stringify(a0));

    const B = await device({ width: 1280, height: 800 }, {});
    await wait(8000);
    const bSeen = await offsets(B.page);
    pass('device B receives both widgets', !!bSeen.clock && !!bSeen.memo, JSON.stringify(bSeen));
    await drag(B.page, '[data-clock-widget]', 250, 180);
    // A post-it is dragged by its paper (its top edge can sit under the app banner).
    {
      const box = await B.page.locator('.memo-note').first().boundingBox();
      // Grab inside the window: on B's narrower screen the note can hang off the edge.
      const cx = Math.min(box.x + box.width / 2, B.page.viewportSize().width - 30);
      const cy = box.y + box.height / 2;
      await B.page.mouse.move(cx, cy);
      await B.page.mouse.down();
      await B.page.mouse.move(cx - 300, cy + 250, { steps: 12 });
      await B.page.mouse.up();
      await B.page.mouse.move(5, 300);
    }
    await wait(4000);
    const b1 = await offsets(B.page);
    pass('device B arranges them differently', !same(b1.clock, bSeen.clock) && !same(b1.memo, bSeen.memo), JSON.stringify(b1));

    await pull(A.page);
    await wait(6000);
    const a1 = await offsets(A.page);
    pass("B's arrangement doesn't move A's clock", same(a1.clock, a0.clock), `${JSON.stringify(a0.clock)} → ${JSON.stringify(a1.clock)}`);
    pass("…or A's post-it", same(a1.memo, a0.memo), `${JSON.stringify(a0.memo)} → ${JSON.stringify(a1.memo)}`);

    const v0 = store.version;
    for (let i = 0; i < 3; i++) {
      await pull(A.page);
      await wait(3000);
      await pull(B.page);
      await wait(3000);
    }
    pass('no layout ping-pong: the cloud stays put while both sit idle', store.version === v0, `v${v0} → v${store.version}`);
    const a2 = await offsets(A.page);
    const b2 = await offsets(B.page);
    pass('both keep their own layouts', same(a2.clock, a0.clock) && same(a2.memo, a0.memo) && same(b2.clock, b1.clock) && same(b2.memo, b1.memo),
      `A ${JSON.stringify(a2)} B ${JSON.stringify(b2)}`);

    // A re-arranges its own clock (the synced value is now A's spot): B's must
    // not follow, and B must keep its own spot even once its window changes.
    await drag(A.page, '[data-clock-widget]', 60, 40);
    await wait(4000);
    const aMoved = await offsets(A.page);
    pass('device A can still move its own clock', !same(aMoved.clock, a0.clock), `${JSON.stringify(a0.clock)} → ${JSON.stringify(aMoved.clock)}`);
    await pull(B.page);
    await wait(6000);
    const bAfterA = await offsets(B.page);
    pass("A moving its clock doesn't move B's", same(bAfterA.clock, b1.clock), `${JSON.stringify(b1.clock)} → ${JSON.stringify(bAfterA.clock)}`);

    // Same monitor, shorter window (a bookmarks bar, a docked panel…). Through CDP,
    // because Playwright's setViewportSize also shrinks the emulated screen.
    const cdp = await B.page.context().newCDPSession(B.page);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 760, deviceScaleFactor: 1, mobile: false, screenWidth: 1280, screenHeight: 800 });
    await B.page.reload({ waitUntil: 'domcontentloaded' });
    await B.page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await wait(5000);
    const b3 = await offsets(B.page);
    pass('B keeps its arrangement after its window gets shorter', same(b3.clock, b1.clock) && same(b3.memo, b1.memo),
      `${JSON.stringify(b1)} → ${JSON.stringify(b3)}`);

    pass('no page errors', A.errors.length === 0 && B.errors.length === 0, [...A.errors, ...B.errors].slice(0, 2).join(' | '));
  } finally {
    for (const b of browsers) await b.close();
    close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
