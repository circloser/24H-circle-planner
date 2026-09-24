/**
 * Plumbing for the promo generator: a static server over a built dist/, a
 * browser context that is completely offline (every /api call mocked, every
 * other outside request refused, OpenStreetMap tiles replaced by a locally
 * drawn stand-in), seeded storage, a pinned clock, and a visible touch cursor
 * for screen recordings.
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, join } from 'path';
import { QUIET, NOW_ISO } from './data.mjs';

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain',
  '.xml': 'application/xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp',
};

/** Serve `dist` with an SPA fallback, plus `/__promo/file/<abs path>` for local assets. */
export async function serve(dist) {
  const server = createServer(async (req, res) => {
    try {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.startsWith('/__promo/file/')) {
        const f = p.slice('/__promo/file/'.length);
        res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(await readFile(f));
        return;
      }
      if (p === '/__promo/blank') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
        return;
      }
      let filePath = join(dist, p);
      const ext = extname(p);
      if (p === '/' || !ext) filePath = !ext && existsSync(join(dist, p + '.html')) ? join(dist, p + '.html') : join(dist, 'index.html');
      const data = await readFile(filePath);
      res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      try {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(await readFile(join(dist, 'index.html')));
      } catch { res.writeHead(500); res.end('err'); }
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** Answer every /api call locally. Nothing reaches 24houring.com. */
async function mockApi(route) {
  const url = new URL(route.request().url());
  const p = url.pathname;
  if (p === '/api/me') return route.fulfill(json({ user: null, plan: 'free' }));
  if (p.startsWith('/api/sync')) return route.fulfill(json({ version: 0, data: {}, updatedAt: 0 }));
  if (p === '/api/geo') return route.fulfill(json({ country: 'KR', eea: false }));
  if (p.startsWith('/api/metrics')) return route.fulfill({ status: 204, body: '' });
  if (p.startsWith('/api/life/memoir')) return route.fulfill(json({ enabled: false }));
  if (p.startsWith('/api/news')) return route.fulfill(json({ items: [] }));
  if (p.startsWith('/api/weather')) return route.fulfill(json({}, 404));
  return route.fulfill(json({ error: 'offline promo build' }, 404));
}

// ── Tile stand-in: the bundled Natural Earth shapes, drawn per OSM tile ─────
let tilePage = null;
const tileCache = new Map();

async function ensureTilePage(browser, base) {
  if (tilePage) return tilePage;
  const ctx = await browser.newContext({ viewport: { width: 256, height: 256 } });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const pg = await ctx.newPage();
  await pg.goto(`${base}/__promo/blank`);
  await pg.evaluate(async () => {
    const data = await (await fetch('/world/countries.json')).json();
    // Natural Earth 1:110m is a coarse outline; two rounds of Chaikin
    // corner-cutting turn its straight segments into a soft, drawn coastline.
    const chaikin = (ring) => {
      const out = [];
      for (let i = 0; i < ring.length - 1; i++) {
        const [ax, ay] = ring[i];
        const [bx, by] = ring[i + 1];
        out.push([0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by], [0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by]);
      }
      out.push(out[0]);
      return out;
    };
    window.__world = data.countries.map((c) => ({ ...c, g: c.g.map((r) => chaikin(chaikin(r))) }));
  });
  tilePage = pg;
  return pg;
}

async function renderTile(browser, base, z, x, y) {
  const key = `${z}/${x}/${y}`;
  if (tileCache.has(key)) return tileCache.get(key);
  const pg = await ensureTilePage(browser, base);
  const b64 = await pg.evaluate(([z, x, y]) => {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = S * 2; c.height = S * 2; // 2x for crisp tiles
    const g = c.getContext('2d');
    g.scale(2, 2);
    const n = 2 ** z;
    const px = (lng) => ((lng + 180) / 360) * S * n - x * S;
    const py = (lat) => {
      const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
      return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * S * n - y * S;
    };
    g.fillStyle = '#d7e6f2';
    g.fillRect(0, 0, S, S);
    // A faint graticule so open sea is not a blank square.
    g.strokeStyle = 'rgba(120,150,180,0.18)';
    g.lineWidth = 0.6;
    for (let lng = -180; lng <= 180; lng += 5) { g.beginPath(); g.moveTo(px(lng), 0); g.lineTo(px(lng), S); g.stroke(); }
    for (let lat = -80; lat <= 80; lat += 5) { g.beginPath(); g.moveTo(0, py(lat)); g.lineTo(S, py(lat)); g.stroke(); }
    g.fillStyle = '#f5f1e8';
    g.strokeStyle = '#cfc6b6';
    g.lineWidth = 1;
    for (const ctry of window.__world) {
      g.beginPath();
      for (const ring of ctry.g) {
        ring.forEach(([lng, lat], i) => (i ? g.lineTo(px(lng), py(lat)) : g.moveTo(px(lng), py(lat))));
        g.closePath();
      }
      g.fill('evenodd');
      g.stroke();
    }
    return c.toDataURL('image/png').split(',')[1];
  }, [z, x, y]);
  const buf = Buffer.from(b64, 'base64');
  tileCache.set(key, buf);
  return buf;
}

/** Everything that would leave the machine is answered here instead. */
async function offline(ctx, browser, base) {
  await ctx.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith(base)) {
      if (new URL(url).pathname.startsWith('/api/')) return mockApi(route);
      return route.continue();
    }
    const m = /tile\.openstreetmap\.org\/(\d+)\/(\d+)\/(\d+)\.png/.exec(url);
    if (m && process.env.PROMO_REAL_TILES !== '1') {
      const body = await renderTile(browser, base, +m[1], +m[2], +m[3]);
      return route.fulfill({ status: 200, contentType: 'image/png', body });
    }
    if (m) return route.continue();
    if (url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    return route.abort();
  });
}

/** Touch-point overlay for recordings: headless Chrome draws no cursor. */
const CURSOR = () => {
  const make = () => {
    if (document.getElementById('__promo_touch')) return;
    const d = document.createElement('div');
    d.id = '__promo_touch';
    d.style.cssText = 'position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;'
      + 'background:rgba(255,77,77,0.28);border:2.5px solid rgba(255,77,77,0.9);box-shadow:0 2px 10px rgba(0,0,0,0.18);'
      + 'pointer-events:none;z-index:2147483647;opacity:0;transition:opacity .25s, transform .12s;transform:scale(1);';
    document.documentElement.appendChild(d);
    const at = (e) => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; };
    window.addEventListener('pointermove', (e) => { at(e); d.style.opacity = '1'; }, true);
    window.addEventListener('pointerdown', (e) => { at(e); d.style.opacity = '1'; d.style.transform = 'scale(0.72)'; d.style.background = 'rgba(255,77,77,0.5)'; }, true);
    window.addEventListener('pointerup', () => { d.style.transform = 'scale(1)'; d.style.background = 'rgba(255,77,77,0.28)'; }, true);
    window.__promoHideTouch = () => { d.style.opacity = '0'; };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', make);
  else make();
};

/**
 * A browser context with seeded storage (written once per context, so what an
 * interaction changes survives a reload), the clock pinned to NOW_ISO and no
 * way out to the network.
 */
export async function openApp(browser, base, { lang, seed, viewport, dsf = 3, mobile = true, cursor = false, fixedClock = true } = {}) {
  const ctx = await browser.newContext({
    viewport, deviceScaleFactor: dsf, isMobile: mobile, hasTouch: mobile,
    locale: lang === 'ko' ? 'ko-KR' : 'en-US', timezoneId: 'Asia/Seoul', colorScheme: 'light',
    reducedMotion: 'no-preference',
  });
  await offline(ctx, browser, base);
  await ctx.addInitScript(([seed, quiet]) => {
    try {
      if (!localStorage.getItem('__promo_seeded')) {
        localStorage.clear();
        for (const [k, v] of Object.entries(quiet)) localStorage.setItem(k, v);
        for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
        localStorage.setItem('__promo_seeded', '1');
      }
      sessionStorage.setItem('24h-aha-nudge-dismissed', '1');
      sessionStorage.setItem('24h-aha-nudge-shown', '1');
    } catch { /* */ }
  }, [seed, QUIET]);
  if (cursor) await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  if (fixedClock) await page.clock.setFixedTime(new Date(NOW_ISO));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

/** Load the app and wait for whichever view the prefs chose. */
export async function gotoApp(page, base, path = '/') {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('[data-calendar-toggle]', { timeout: 45000 });
  await page.evaluate(() => document.fonts?.ready);
  await wait(900);
}

/** Close anything floating that is not part of the picture. */
export async function tidy(page) {
  for (let i = 0; i < 3 && (await page.locator('[role="dialog"]').count()) > 0; i++) {
    await page.keyboard.press('Escape');
    await wait(200);
  }
  await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' }).catch(() => {});
}

export async function launch() {
  return chromium.launch({ headless: true, args: ['--font-render-hinting=none'] });
}

/** Human-looking pointer travel: eased, in many small steps. */
export async function glide(page, from, to, { ms = 700, down = false, up = false } = {}) {
  const steps = Math.max(8, Math.round(ms / 16));
  if (from) await page.mouse.move(from.x, from.y);
  if (down) await page.mouse.down();
  const start = from ?? to;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    await page.mouse.move(start.x + (to.x - start.x) * e, start.y + (to.y - start.y) * e);
    await wait(ms / steps);
  }
  if (up) await page.mouse.up();
}
