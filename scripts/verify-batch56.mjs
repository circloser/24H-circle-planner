/**
 * Batch 56: Phase A — read-only shared-day viewer (/s#d=…).
 * Serves the real dist/ build over http with an SPA fallback (so /s resolves to
 * index.html, as Cloudflare's not_found_handling does), then checks the viewer
 * renders the shared schedule + note read-only, and that / still loads the app.
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, join } from 'path';

const DIST = 'C:/vibecoding/24h/dist';
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain',
  '.xml': 'application/xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── static server with SPA fallback (mirrors wrangler's single-page-application) ──
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
    try { res.writeHead(200, { 'content-type': 'text/html' }); res.end(await readFile(join(DIST, 'index.html'))); }
    catch { res.writeHead(500); res.end('err'); }
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const BASE = `http://127.0.0.1:${port}`;

// ── build a share code (contiguous 24h ring + a note) ──
const b64url = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
const payload = {
  v: 1,
  n: '테스트 하루',
  s: [[0, '수면', '#a78bfa', ''], [480, '일', '#60a5fa', ''], [1080, '휴식', '#34d399', '']],
  t: '오늘은 잘 잤다.\n둘째 줄 노트입니다.',
};
const code = b64url(payload);
const codeNoNote = b64url({ ...payload, t: undefined });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 }, locale: 'ko-KR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

// ── 1. Viewer with schedule + note ──
await page.goto(`${BASE}/s#d=${code}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await wait(400);
pass('viewer renders the chart', await page.locator('svg[role="img"]').first().isVisible().catch(() => false));
pass('shows the shared schedule name', (await page.locator('h1:has-text("테스트 하루")').count()) > 0);
pass('shows the note label', (await page.locator('text=노트').count()) > 0);
pass('shows the note body', (await page.getByText('둘째 줄 노트입니다.').count()) > 0);
pass('shows the CTA', (await page.locator('a:has-text("나만의 하루 시간표 만들기")').count()) > 0);
// It is the LIGHTWEIGHT viewer, not the full editor (no header export button).
pass('no full-app editor chrome (viewer only)', (await page.locator('button[aria-label="내보내기"]').count()) === 0);
// No now-line marker (hideLiveMarkers).
pass('no live now-line in shared chart', (await page.locator('.now-indicator').count()) === 0);

// ── 2. Viewer with schedule but NO note ──
// (Fresh document — a fragment-only change wouldn't remount the SPA; real share
//  links always open in a fresh navigation.)
await page.goto('about:blank');
await page.goto(`${BASE}/s#d=${codeNoNote}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await wait(300);
pass('note section absent when no note shared', (await page.locator('text=둘째 줄 노트입니다.').count()) === 0);

// ── 3. /s with no payload → friendly empty state ──
await page.goto('about:blank');
await page.goto(`${BASE}/s`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await wait(400);
pass('empty state when link has no timetable', (await page.locator('text=이 링크에서 시간표를 찾을 수 없어요.').count()) > 0);

// ── 4. Regression: / still loads the full app ──
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await wait(400);
pass('root / still loads the full app (export button present)', (await page.locator('button[aria-label="내보내기"]').count()) > 0);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
server.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
