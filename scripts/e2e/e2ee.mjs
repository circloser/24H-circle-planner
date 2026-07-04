/**
 * E2EE for cloud sync — full engine flow against a MOCKED /api/me + /api/sync
 * (Playwright route interception over an http origin; no real Worker/D1).
 *
 * Verifies: enabling encryption replaces the cloud copy with CIPHERTEXT (the
 * server never sees the diary note); a fresh device that pulls the ciphertext
 * with no key is LOCKED; the right passphrase unlocks + decrypts; a wrong one is
 * rejected. This is the guarantee the user asked for: the operator sees only
 * ciphertext.
 */
import { makeReporter, launchPage, serveDist, wait, isMain, runStandalone } from './_helpers.mjs';

const SECRET = '비밀-일기-내용-1234'; // must never appear in the mock server's stored blob

async function mockApi(page, store) {
  await page.route('**/api/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'u1', email: 'test@e2ee', provider: 'google' }, plan: 'pro' }) }),
  );
  await page.route('**/api/sync', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') store.gets = (store.gets || 0) + 1; else store.puts = (store.puts || 0) + 1;
    if (req.method() === 'GET') {
      if (store.blob === null) return route.fulfill({ status: 204, body: '' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ blob: store.blob, version: store.version, updatedAt: store.updatedAt, deviceLabel: 'PC' }) });
    }
    const body = JSON.parse(req.postData() || '{}');
    store.blob = body.blob;
    store.version += 1;
    store.updatedAt = Date.now();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: store.version, updatedAt: store.updatedAt }) });
  });
}

/** Poll until `pred` (sync or async) holds (or timeout). */
async function until(pred, ms = 12000, step = 250) {
  for (let t = 0; t < ms; t += step) { if (await pred()) return true; await wait(step); }
  return await pred();
}

export async function run() {
  const { pass, allOk } = makeReporter('e2ee');
  const store = { blob: null, version: 0, updatedAt: 0 };
  const { base, close } = await serveDist();

  // ── Device A: signed in (mock), seed a diary note, enable E2EE ──
  {
    const { browser, page, errors } = await launchPage({ locale: 'ko-KR' });
    try {
      await mockApi(page, store);
      // Seed the diary note BEFORE the app mounts, so the engine's very first
      // push already carries it (avoids an LWW tie wiping it against the empty
      // cloud). onboarded flag skips the first-visit welcome overlay.
      await page.addInitScript((secret) => {
        localStorage.setItem('24h-circle-planner.onboarded', '1');
        localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs: { language: 'ko' } }));
        localStorage.setItem('24h-circle-planner.diary', JSON.stringify({ version: 1, entries: { '2026-07-01': { date: '2026-07-01', name: '내 하루', slices: [], note: secret, savedAt: 1 } } }));
      }, SECRET);
      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
      await page.keyboard.press('Escape').catch(() => {});

      // The engine seeds the cloud plaintext; wait until the NOTE is present.
      pass('standard sync stores PLAINTEXT (operator can read the note)', await until(() => !!store.blob && store.blob.includes(SECRET)));

      // Enable E2EE via the settings menu (only shown when signed in).
      await page.locator('button[aria-label="설정"]').first().click();
      await wait(200);
      await page.locator('[role="menuitem"]:has-text("일기 잠금")').first().click();
      await wait(400);
      await page.locator('input[aria-label="암호 (8자 이상)"]').fill('open-sesame-42');
      await page.locator('input[aria-label="암호 다시 입력"]').fill('open-sesame-42');
      await page.locator('input[type="checkbox"]').first().check();
      await page.locator('button:has-text("잠금 설정")').last().click();

      const encrypted = await until(() => !!store.blob && store.blob.includes('"v":2') && !store.blob.includes(SECRET), 15000);
      pass('after enabling E2EE the cloud is CIPHERTEXT (note no longer readable)', encrypted, `v2=${store.blob?.includes('"v":2')} leaks=${store.blob?.includes(SECRET)}`);
      pass('device A: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    } finally {
      await browser.close();
    }
  }

  pass('operator DB view contains no plaintext note', !!store.blob && !store.blob.includes(SECRET));

  store.gets = 0; store.puts = 0; // reset counters for device B
  // ── Device B: fresh browser (no cached key) → locked → wrong pw rejected → unlock ──
  {
    const { browser, page, errors } = await launchPage({ locale: 'ko-KR' });
    try {
      await mockApi(page, store);
      await page.addInitScript(() => localStorage.setItem('24h-circle-planner.onboarded', '1'));
      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
      await page.keyboard.press('Escape').catch(() => {});

      // The engine reports the locked state in the settings menu (and auto-opens
      // the unlock dialog). Verify the status, then open the dialog the reliable
      // way — the settings → 일기 잠금 menu item — to run the unlock flow.
      const locked = await until(async () => {
        await page.locator('button[aria-label="설정"]').first().click().catch(() => {});
        await wait(200);
        const shown = (await page.locator('text=잠김 (암호 필요)').count()) > 0;
        if (!shown) await page.keyboard.press('Escape').catch(() => {});
        return shown;
      }, 15000);
      pass('device B reports LOCKED (passphrase needed)', locked);

      // Open the unlock dialog from the (already open) settings menu.
      await page.locator('[role="menuitem"]:has-text("일기 잠금")').first().click();
      await wait(500);
      pass('unlock dialog opens', (await page.locator('text=일기 잠금 해제').count()) > 0);

      await page.locator('input[aria-label="암호 (8자 이상)"]').fill('nope-nope-nope');
      await page.locator('button:has-text("잠금 해제")').last().click();
      await wait(600);
      pass('wrong passphrase is rejected', (await page.locator('text=암호가 올바르지 않습니다.').count()) > 0);

      await page.locator('input[aria-label="암호 (8자 이상)"]').fill('open-sesame-42');
      await page.locator('button:has-text("잠금 해제")').last().click();
      await wait(1500);
      const restored = await page.evaluate(() => {
        try { return JSON.parse(localStorage.getItem('24h-circle-planner.diary')).entries['2026-07-01'].note; } catch { return null; }
      });
      pass('right passphrase unlocks + decrypts the note on device B', restored === SECRET, `note=${restored}`);
      pass('device B: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    } finally {
      await browser.close();
    }
  }

  close();
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
