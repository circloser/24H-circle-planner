/**
 * Screen recordings of real interaction, one per tab, at phone size.
 *
 * Frames come from the DevTools screencast (sharp JPEGs with timestamps,
 * better than Playwright's built-in 1 Mbit VP8 recorder); ffmpeg then writes
 *   video/clip-<lang>-<tab>.webm   the raw phone screen (780×1688, VP8)
 *   video/clip-<lang>-<tab>.mp4    1080×1920 H.264, framed with a headline
 *   video/reel-<lang>.mp4          ~30 s: title card, five clips, end card
 *
 * ffmpeg: FFMPEG env, else the first one found that can encode H.264 (the
 * copy Playwright ships cannot, so it is only used for webm).
 */
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { execFileSync } from 'child_process';
import { openApp, gotoApp, tidy, wait, glide } from './lib.mjs';
import { seedFor, NOW_ISO } from './data.mjs';
import { COPY } from './copy.mjs';
import { renderCards } from './compose.mjs';

// ── ffmpeg ──────────────────────────────────────────────────────────────────
export function findFfmpeg() {
  const la = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
  const ad = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
  const candidates = [process.env.FFMPEG, 'ffmpeg'];
  // Python's imageio-ffmpeg ships a full build with libx264.
  for (const root of [join(ad, 'Python'), join(la, 'Programs', 'Python')]) {
    if (!existsSync(root)) continue;
    for (const v of readdirSync(root)) {
      const bin = join(root, v, 'site-packages', 'imageio_ffmpeg', 'binaries');
      if (existsSync(bin)) for (const f of readdirSync(bin)) if (/^ffmpeg.*\.exe$/.test(f)) candidates.push(join(bin, f));
    }
  }
  const pw = join(la, 'ms-playwright');
  if (existsSync(pw)) for (const d of readdirSync(pw)) if (d.startsWith('ffmpeg')) candidates.push(join(pw, d, 'ffmpeg-win64.exe'));
  let vp8Only = null;
  for (const c of candidates.filter(Boolean)) {
    try {
      const enc = execFileSync(c, ['-hide_banner', '-encoders'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (/libx264/.test(enc)) return { h264: c, vp8: c };
      if (/libvpx/.test(enc) && !vp8Only) vp8Only = c;
    } catch { /* not there */ }
  }
  return { h264: null, vp8: vp8Only };
}

const run = (bin, args) => execFileSync(bin, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });

// ── Recording ───────────────────────────────────────────────────────────────
const VW = 390;
const VH = 844;
const DSF = 2;

async function record(page, dir, script) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    frames.push({ t: f.metadata.timestamp, data: f.data });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* closed */ }
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: VW * DSF, maxHeight: VH * DSF, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  await wait(600);
  await script();
  await wait(900);
  await cdp.send('Page.stopScreencast');
  const t1 = Date.now() / 1000;
  mkdirSync(dir, { recursive: true });
  // Concat list: each frame held until the next one arrived.
  const lines = ['ffconcat version 1.0'];
  frames.forEach((f, i) => {
    const name = `f${String(i).padStart(5, '0')}.jpg`;
    writeFileSync(join(dir, name), Buffer.from(f.data, 'base64'));
    const next = frames[i + 1]?.t ?? Math.max(f.t + 0.5, t1 - t0 + frames[0].t);
    lines.push(`file '${name}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  });
  lines.push(`file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'`);
  writeFileSync(join(dir, 'list.txt'), lines.join('\n'));
  return frames.length;
}

/** A finger that remembers where it is, so every move glides from there. */
function finger(page) {
  let at = { x: VW / 2, y: VH * 0.62 };
  const moveTo = async (p, ms = 650) => { await glide(page, at, p, { ms }); at = p; };
  const centre = async (loc) => {
    const b = await loc.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  return {
    moveTo,
    get at() { return at; },
    tapAt: async (p, ms) => { await moveTo(p, ms); await wait(120); await page.mouse.down(); await wait(90); await page.mouse.up(); await wait(150); },
    tap: async (loc, ms) => { const p = await centre(loc); await moveTo(p, ms); await wait(120); await page.mouse.down(); await wait(90); await page.mouse.up(); await wait(150); },
    drag: async (to, ms = 1200) => { await page.mouse.down(); await moveTo(to, ms); await page.mouse.up(); },
    /** A swipe for the eye while the wheel does the scrolling. */
    swipe: async (dy, ms = 2400) => {
      const steps = Math.round(ms / 50);
      const from = { ...at };
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        await page.mouse.move(from.x, from.y + (dy < 0 ? 1 : -1) * 160 * t);
        await page.mouse.wheel(0, dy / steps);
        await wait(50);
      }
      at = { x: from.x, y: from.y + (dy < 0 ? 1 : -1) * 160 };
    },
    hide: () => page.evaluate(() => window.__promoHideTouch?.()),
  };
}

const settle = async (page) => {
  for (let i = 0; i < 40; i++) {
    const heat = Number(await page.locator('[data-relation-surface]').getAttribute('data-relation-alpha').catch(() => '1'));
    if (heat <= 0.03) return;
    await wait(150);
  }
};

// Each script runs with the app already open on its tab.
const CLIPS = {
  timetable: {
    view: 'full',
    async run(page, f) {
      await wait(900);
      await f.tap(page.locator('[data-label-id="gym"]').first());
      await wait(1400);
      // Recolour it: the ring changes as the swatch is touched.
      const swatches = page.locator('[role="dialog"] button[aria-label^="색상 "]');
      const pick = (await swatches.count()) > 12 ? swatches.nth(12) : null;
      if (pick) { await f.tap(pick); await wait(900); }
      await page.keyboard.press('Escape');
      await wait(900);
      // Over to the table view, and tick a block off.
      await f.tap(page.locator('[data-view-toggle]').first());
      await wait(700);
      await f.tap(page.locator('[role="menuitemradio"]').nth(3));
      await wait(1300);
      const boxes = page.locator('main [role="checkbox"], main input[type="checkbox"], [role="checkbox"]');
      if ((await boxes.count()) > 4) {
        await f.tap(boxes.nth(3));
        await wait(700);
        await f.tap(boxes.nth(4));
      }
      await wait(1500);
    },
  },
  calendar: {
    view: 'calendar',
    async run(page, f) {
      await wait(600);
      await f.tap(page.locator('[data-cal-next]').first());
      await wait(750);
      await f.tap(page.locator('[data-cal-next]').first());
      await wait(750);
      await f.tap(page.locator('[data-cal-today]').first());
      await wait(850);
      await f.tap(page.locator('[data-day="2026-09-11"]').first());
      await wait(2100);
      await page.keyboard.press('Escape');
      await wait(700);
      await f.tap(page.locator('[data-day="2026-09-24"]').first());
      await wait(2000);
      await page.keyboard.press('Escape');
      await wait(600);
    },
  },
  life: {
    view: 'life',
    async run(page, f) {
      await wait(700);
      await f.moveTo({ x: VW * 0.72, y: VH * 0.42 }, 500);
      await f.swipe(-1300, 2600);
      await wait(400);
      const wedding = page.locator('[data-life-moment="m12"]').first();
      await wedding.scrollIntoViewIfNeeded().catch(() => {});
      await wait(400);
      await f.tap(wedding, 550);
      await wait(2400);
      await page.keyboard.press('Escape');
      await wait(500);
      await f.moveTo({ x: VW * 0.72, y: VH * 0.36 }, 450);
      await f.swipe(450, 1500);
      await wait(500);
    },
  },
  relation: {
    view: 'relation',
    async run(page, f) {
      await settle(page);
      await wait(400);
      await f.tap(page.locator('[data-relation-zoom-in]'), 600);
      await wait(700);
      const s = await page.locator('[data-relation-surface]').boundingBox();
      const me = { x: s.x + s.width / 2, y: s.y + s.height / 2 };
      // Carry me across the map; everyone follows on their own springs.
      await f.moveTo(me, 700);
      await wait(150);
      await page.mouse.down();
      await f.moveTo({ x: me.x - 60, y: me.y - 80 }, 1000);
      await f.moveTo({ x: me.x + 70, y: me.y - 30 }, 1000);
      await f.moveTo({ x: me.x, y: me.y }, 900);
      await page.mouse.up();
      await wait(1400);
      await settle(page);
      // Open somebody: the list mirrors the canvas for keyboards and readers.
      const who = page.locator('[data-relation-list-item="p_spouse"]');
      if (await who.count()) {
        await f.moveTo({ x: me.x - 15, y: me.y - 75 }, 600);
        await page.mouse.down(); await wait(90); await page.mouse.up();
        if ((await page.locator('[data-relation-panel]').count()) === 0) {
          await who.focus();
          await page.keyboard.press('Enter');
        }
      }
      await wait(2800);
    },
  },
  place: {
    view: 'place',
    seed: { '24h-place-spin': 'off' },
    async run(page, f) {
      if (process.env.PROMO_REAL_TILES !== '1') await page.addStyleTag({ content: '[data-place-attribution]{visibility:hidden!important}' });
      await wait(1500);
      for (let i = 0; i < 16 && (await page.locator('[data-place-pins]').count()) === 0; i++) {
        await f.tap(page.locator('[data-place-zoom-in]'), i === 0 ? 700 : 160);
        await wait(220);
      }
      await wait(700);
      // The zoom lands on home (Korea); open a pin (a drag here would read as a tap and drop a new pin).
      await wait(900);
      const pin = page.locator('[data-place-pin]', { hasText: /제주|Jeju/ }).first();
      if (await pin.count()) { await f.tap(pin, 700); await wait(2800); }
      await wait(400);
    },
  },
};

export async function recordAll(browser, base, { OUT, LANGS, ONLY }) {
  const ff = findFfmpeg();
  console.log(`  ffmpeg: h264=${ff.h264 ?? 'none'} vp8=${ff.vp8 ?? 'none'}`);
  const tmp = join(OUT, 'video', '_frames');
  const made = {};
  for (const lang of LANGS) {
    for (const [id, clip] of Object.entries(CLIPS)) {
      if (ONLY && !ONLY.includes(id)) continue;
      const dir = join(tmp, `${lang}-${id}`);
      const take = async () => {
        const { ctx, page, errors } = await openApp(browser, base, {
          lang, seed: { ...seedFor(lang, { chartView: clip.view }), ...(clip.seed ?? {}) }, viewport: { width: VW, height: VH }, dsf: DSF,
          mobile: true, cursor: true, fixedClock: false,
        });
        // Time runs from the sample "now" so the globe spins and forces float.
        await page.clock.install({ time: new Date(NOW_ISO) });
        await page.clock.resume();
        rmSync(dir, { recursive: true, force: true });
        try {
          await gotoApp(page, base);
          await wait(1500);
          await tidy(page);
          const f = finger(page);
          const n = await record(page, dir, () => clip.run(page, f));
          if (errors.length) console.warn(`  ! ${lang}/${id} page errors:`, errors.slice(0, 2));
          console.log(`  recorded ${lang}/${id}: ${n} frames`);
        } finally {
          await ctx.close();
        }
      };
      try {
        await take();
      } catch (e) {
        console.warn(`  ! retrying ${lang}/${id}: ${String(e.message).split('\n')[0]}`);
        await take();
      }
      const list = join(dir, 'list.txt');
      const webm = join(OUT, 'video', `clip-${lang}-${id}.webm`);
      if (ff.vp8) {
        run(ff.vp8, ['-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=30,scale=${VW * DSF}:${VH * DSF}`,
          '-t', '20', '-c:v', 'libvpx', '-b:v', '6M', '-crf', '8', '-qmin', '2', '-qmax', '30', '-an', webm]);
        console.log(`  video/clip-${lang}-${id}.webm`);
      }
      if (ff.h264) {
        const card = join(dir, 'card.png');
        const hole = { x: 210, y: 404, w: 660, h: 1428 };
        const [head, sub] = COPY[id][lang];
        await renderCards(browser, base, [{ kind: 'frame', theme: id === 'life' || id === 'relation' ? 'ink' : 'coral', head, sub, hole, file: card }]);
        const mp4 = join(OUT, 'video', `clip-${lang}-${id}.mp4`);
        run(ff.h264, ['-f', 'concat', '-safe', '0', '-i', list, '-loop', '1', '-framerate', '30', '-i', card,
          '-filter_complex', `[0:v]fps=30,scale=${hole.w}:${hole.h}:flags=lanczos,setsar=1[v];[1:v][v]overlay=${hole.x}:${hole.y}:shortest=1,format=yuv420p[o]`,
          '-map', '[o]', '-t', '20', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-r', '30', '-movflags', '+faststart', '-an', mp4]);
        console.log(`  video/clip-${lang}-${id}.mp4`);
        (made[lang] ??= []).push(mp4);
      }
    }
    // The reel: title card, the five clips cut to ~5 s, end card.
    made[lang] = Object.keys(CLIPS).map((id) => join(OUT, 'video', `clip-${lang}-${id}.mp4`)).filter((p) => existsSync(p));
    if (ff.h264 && made[lang].length === 5) {
      const title = join(tmp, `title-${lang}.png`);
      const end = join(tmp, `end-${lang}.png`);
      await renderCards(browser, base, [
        { kind: 'card', theme: 'coral', head: COPY.feature[lang][0], sub: COPY.overview[lang][0], file: title },
        { kind: 'card', theme: 'ink', head: COPY.reelEnd[lang][0], sub: COPY.reelEnd[lang][1], file: end },
      ]);
      const inputs = ['-loop', '1', '-framerate', '30', '-t', '2.2', '-i', title];
      for (const m of made[lang]) inputs.push('-ss', '0.8', '-t', '5', '-i', m);
      inputs.push('-loop', '1', '-framerate', '30', '-t', '2.6', '-i', end);
      const n = made[lang].length + 2;
      const prep = Array.from({ length: n }, (_, i) => `[${i}:v]fps=30,scale=1080:1920,setsar=1,format=yuv420p[v${i}]`).join(';');
      const cat = `${Array.from({ length: n }, (_, i) => `[v${i}]`).join('')}concat=n=${n}:v=1:a=0[o]`;
      const reel = join(OUT, 'video', `reel-${lang}.mp4`);
      run(ff.h264, [...inputs, '-filter_complex', `${prep};${cat}`, '-map', '[o]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19',
        '-r', '30', '-movflags', '+faststart', '-an', reel]);
      console.log(`  video/reel-${lang}.mp4`);
    }
  }
  if (!process.env.PROMO_KEEP_FRAMES) rmSync(tmp, { recursive: true, force: true });
}
