/**
 * Android home-screen widget publishing (web half). Simulates the Play Store
 * TWA (android-app referrer flag) with a linked widget token and intercepts
 * PUT /api/widget/:token — the image must be a transparent PNG, the meta must
 * carry the ring geometry + view window the native hand needs, edits must
 * republish on their own, and unlinking must DELETE the slot + drop the token.
 * Needs dist/ over http (the fetch goes to /api).
 */
import { makeReporter, launchPage, serveDist, seedBasicData, wait, isMain, runStandalone } from './_helpers.mjs';

const TOKEN = 'e2eWidgetToken0123456789';

export async function run() {
  const { pass, allOk } = makeReporter('widget');
  const { base, close } = await serveDist();
  const { browser, page, errors } = await launchPage({ viewport: { width: 900, height: 1000 } });
  const puts = [];
  const deletes = [];
  try {
    // Look like the TWA + already linked (token present) before the app boots.
    // Init scripts re-run in every same-origin about:blank iframe the app
    // creates, so the seed must be one-shot (a sessionStorage guard): a re-run
    // after step 6's auto-link would otherwise silently put the old token back.
    await page.context().addInitScript((token) => {
      try {
        sessionStorage.setItem('24h-twa', '1');
        if (!sessionStorage.getItem('e2e-widget-seeded')) {
          localStorage.setItem('24h-circle-planner.widget-token', token);
          sessionStorage.setItem('e2e-widget-seeded', '1');
        }
      } catch { /* */ }
    }, TOKEN);
    await page.route('**/api/widget/**', async (route) => {
      const req = route.request();
      if (req.method() === 'PUT') {
        puts.push({ url: req.url(), body: JSON.parse(req.postData() || '{}') });
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"etag":"\\"x\\""}' });
      }
      if (req.method() === 'DELETE') {
        deletes.push(req.url());
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      }
      return route.continue();
    });

    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await seedBasicData(page);

    // 1. Boot with a linked token → one publish after the debounce.
    await wait(4500);
    pass('publishes on boot when linked', puts.length >= 1, `puts=${puts.length}`);
    const first = puts[puts.length - 1];
    pass('targets this phone\'s token', !!first && first.url.endsWith(`/api/widget/${TOKEN}`), first?.url);
    const png = first?.body?.png ?? '';
    pass('uploads a PNG', png.startsWith('iVBORw0KGgo'), png.slice(0, 12));
    const meta = first?.body?.meta ?? {};
    pass('meta carries ring geometry in pixels', meta.v === 1 && meta.cx === 540 && meta.cy === 540 && meta.innerR > 0 && meta.outerR > meta.innerR, JSON.stringify(meta));
    pass('meta carries the view window', meta.startMin === 0 && meta.spanMin === 1440 && meta.startAngleDeg === -90, JSON.stringify(meta));
    pass('meta carries hand colour + theme', typeof meta.hand === 'string' && meta.hand.startsWith('#') && typeof meta.dark === 'boolean');
    // The hub date is formatted natively in THIS language (seedBasicData sets ko),
    // not in the phone's system locale.
    pass('meta carries the app language', meta.lang === 'ko', String(meta.lang));

    // 2. The image is transparent outside the ring (corner) and painted inside (rim band).
    const px = await page.evaluate(async ({ b64, outerR, innerR }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const at = (x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data);
      const midR = (outerR + innerR) / 2;
      // Between two hour labels (7.5 deg off the 00 label), just outside the
      // rim: no backdrop disc -> must be bare wallpaper.
      const a = (-90 + 7.5) * Math.PI / 180;
      const gap = at(540 + (outerR + 40) * Math.cos(a), 540 + (outerR + 40) * Math.sin(a));
      // The "00" label sits at outerR + 32 straight up: count white fill and
      // black outline pixels in a box around it.
      const box = ctx.getImageData(540 - 14, 540 - (outerR + 32) - 14, 28, 28).data;
      let white = 0, black = 0;
      for (let i = 0; i < box.length; i += 4) {
        if (box[i + 3] < 200) continue;
        if (box[i] > 230 && box[i + 1] > 230 && box[i + 2] > 230) white++;
        else if (box[i] < 40 && box[i + 1] < 40 && box[i + 2] < 40) black++;
      }
      return { size: img.width, corner: at(2, 2), band: at(540, 540 - midR), gap, white, black };
    }, { b64: png, outerR: meta.outerR, innerR: meta.innerR });
    pass('renders at 1080px', px.size === 1080, String(px.size));
    pass('corner is fully transparent', px.corner[3] === 0, `alpha=${px.corner[3]}`);
    pass('ring band is painted', px.band[3] > 200, `alpha=${px.band[3]}`);
    pass('no backdrop disc outside the rim', px.gap[3] === 0, `alpha=${px.gap[3]}`);
    pass('hour numbers are white with a black outline', px.white > 5 && px.black > 5, `white=${px.white} black=${px.black}`);

    // 3. A preference change (ring size, via the cross-device sync path) republishes.
    const before = puts.length;
    await page.evaluate(() => {
      const env = JSON.parse(localStorage.getItem('24h-circle-planner.prefs'));
      env.prefs.ringOuterR = 420;
      localStorage.setItem('24h-circle-planner.prefs', JSON.stringify(env));
      window.dispatchEvent(new Event('24h:prefs-synced'));
    });
    await wait(4500);
    pass('republishes after an edit', puts.length > before, `before=${before} after=${puts.length}`);
    const second = puts[puts.length - 1];
    pass('new image reflects the smaller ring', second.body.meta.outerR < first.body.meta.outerR, `${first.body.meta.outerR} → ${second.body.meta.outerR}`);

    // 4. Dialog: linked state + unlink → DELETE + token cleared.
    await page.locator('button[aria-label="설정"]').first().click();
    await wait(250);
    await page.locator('[role="menuitem"]:has-text("홈 화면 위젯")').first().click();
    await wait(1200);
    pass('dialog shows the linked state', (await page.locator('[role="dialog"]:has-text("연결되어 있어요")').count()) > 0);
    await page.locator('[role="dialog"] button:has-text("위젯 연결 해제")').first().click();
    await wait(800);
    pass('unlink DELETEs the slot', deletes.length === 1 && deletes[0].endsWith(`/api/widget/${TOKEN}`), deletes.join(','));
    const tokenAfter = await page.evaluate(() => localStorage.getItem('24h-circle-planner.widget-token'));
    pass('unlink clears the local token', tokenAfter === null, String(tokenAfter));

    // 5. Unlinked → edits no longer publish.
    const quiet = puts.length;
    await page.evaluate(() => {
      const env = JSON.parse(localStorage.getItem('24h-circle-planner.prefs'));
      env.prefs.ringOuterR = 460;
      localStorage.setItem('24h-circle-planner.prefs', JSON.stringify(env));
      window.dispatchEvent(new Event('24h:prefs-synced'));
    });
    await wait(4000);
    pass('no publish after unlink', puts.length === quiet, `${quiet} → ${puts.length}`);

    // 6. Auto-link: the Android launcher opens the app at /?w=<token> for a
    //    freshly placed widget. The app must adopt it, scrub the URL and publish
    //    to THAT slot without any menu interaction.
    const NATIVE = 'nativeMintedToken0123456';
    const beforeAuto = puts.length;
    await page.goto(`${base}/?w=${NATIVE}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await wait(4500);
    pass('launch URL token is adopted', (await page.evaluate(() => localStorage.getItem('24h-circle-planner.widget-token'))) === NATIVE);
    pass('launch URL is scrubbed', (await page.evaluate(() => location.search)) === '', await page.evaluate(() => location.href));
    const auto = puts.slice(beforeAuto);
    pass('publishes to the launcher token with no user action', auto.length >= 1 && auto[auto.length - 1].url.endsWith(`/api/widget/${NATIVE}`), auto.map((p) => p.url).join(','));

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
