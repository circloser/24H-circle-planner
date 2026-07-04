/**
 * Shared helpers for the permanent offline e2e suite (scripts/e2e/).
 *
 * Suites run against the built app:
 *  - dist-single/ (file://) for everything that doesn't need URL routing
 *  - dist/ served over http with an SPA fallback for route-dependent suites (/s)
 *
 * Run all: `npm run e2e`   ·   Run one: `node scripts/e2e/<suite>.mjs`
 * Prereq: `npm run build && npm run build:single`
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const DIST = join(ROOT, 'dist');
export const DIST_SINGLE_URL = new URL('../../dist-single/index.html', import.meta.url).href;

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Per-suite PASS/FAIL collector with a uniform output format. */
export function makeReporter(suite) {
  const results = [];
  const pass = (name, ok, extra = '') => {
    results.push({ ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  [${suite}] ${name}${extra ? `  ${extra}` : ''}`);
  };
  const allOk = () => results.every((r) => r.ok);
  return { pass, allOk };
}

/** Launch a headless page with page-error capture. */
export async function launchPage(ctxOpts = {}) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    locale: 'ko-KR',
    ...ctxOpts,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return { browser, page, errors };
}

/** Navigate and wait for the chart shell; dismisses any startup dialog. */
export async function gotoApp(page, url = DIST_SINGLE_URL) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
  await page.keyboard.press('Escape').catch(() => {});
  await wait(300);
}

/**
 * Seed a standard dataset (one day + one saved diary + ko language) into
 * localStorage, then reload so every provider re-hydrates. Returns the diary key.
 */
export async function seedBasicData(page, { slices } = {}) {
  const key = await page.evaluate((customSlices) => {
    const sl = customSlices ?? [
      { id: 'a', label: '수면', startTime: '00:00', endTime: '08:00', color: '#a78bfa', icon: '', textPosition: 'inside' },
      { id: 'b', label: '일', startTime: '08:00', endTime: '18:00', color: '#60a5fa', icon: '', textPosition: 'inside' },
      { id: 'c', label: '휴식', startTime: '18:00', endTime: '24:00', color: '#34d399', icon: '', textPosition: 'inside' },
    ];
    // Non-default name so the hub title shows the NAME, not today's date — the
    // date title changes daily and would flake the visual baselines at midnight.
    const day = { id: 'd1', schedule: { id: 's', version: 1, name: '테스트 하루', presetSource: null, updatedAt: '2026-07-01T00:00:00.000Z', slices: sl } };
    localStorage.setItem('24h-circle-planner.days', JSON.stringify({ version: 1, activeId: 'd1', days: [day] }));
    localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs: { language: 'ko' } }));
    const now = new Date();
    const k = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
    localStorage.setItem('24h-circle-planner.diary', JSON.stringify({ version: 1, entries: { [k]: { date: k, name: '내 하루', slices: sl, note: '', savedAt: 1 } } }));
    return k;
  }, slices ?? null);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
  await page.keyboard.press('Escape').catch(() => {});
  await wait(400);
  return key;
}

/** Load the seeded diary via the UI (day menu → 일기 → pick date → 불러오기). */
export async function loadDiary(page, key) {
  await page.locator('button[aria-label="내 시간표"]').first().click();
  await wait(200);
  await page.locator('[role="menuitem"]:has-text("일기")').first().click();
  await wait(400);
  await page.locator(`button[title="${key}"]`).first().click();
  await wait(250);
  await page.locator('[role="dialog"] button:has-text("불러오기")').last().click();
  await wait(500);
}

/** Exit diary mode back to the working day. */
export async function exitDiary(page) {
  await page.locator('text=일기 나가기').first().click();
  await wait(500);
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain',
  '.xml': 'application/xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

/**
 * Serve dist/ over http with an SPA fallback — mirrors Cloudflare's
 * `not_found_handling: single-page-application` so routes like /s resolve.
 * Returns { base, close }.
 */
export async function serveDist() {
  const server = createServer(async (req, res) => {
    try {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let filePath = join(DIST, p);
      const ext = extname(p);
      if (p === '/' || !ext) {
        filePath = !ext && existsSync(join(DIST, p + '.html')) ? join(DIST, p + '.html') : join(DIST, 'index.html');
      }
      const data = await readFile(filePath);
      res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      try {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(await readFile(join(DIST, 'index.html')));
      } catch {
        res.writeHead(500);
        res.end('err');
      }
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

/** True when a module is being executed directly (`node scripts/e2e/x.mjs`). */
export function isMain(metaUrl) {
  return process.argv[1] && metaUrl === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href;
}

/** Standalone-run wrapper: execute a suite's run() and set the exit code. */
export async function runStandalone(run) {
  const ok = await run();
  console.log(ok ? '\nALL PASS' : '\nSOME FAILED');
  process.exit(ok ? 0 : 1);
}
