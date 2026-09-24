/**
 * Marketing composites, rendered from HTML with Playwright: brand background,
 * headline + subhead, and the raw app capture inside a phone (or browser)
 * frame. Pretendard is served from the build's own /fonts.
 */
import { existsSync } from 'fs';
import { join } from 'path';
import { TAB_NAMES } from './copy.mjs';

const CORAL = '#FF4D4D';
const INK = '#1f2430';

const THEMES = {
  coral: { bg: `radial-gradient(120% 80% at 85% 0%, #ff8a6b 0%, rgba(255,138,107,0) 60%), linear-gradient(165deg, ${CORAL} 0%, #ff6a55 100%)`, fg: '#fff', sub: 'rgba(255,255,255,.88)', mark: '#fff', ring: INK },
  ink: { bg: `radial-gradient(90% 60% at 50% 0%, rgba(255,77,77,.38) 0%, rgba(255,77,77,0) 70%), linear-gradient(180deg, #252b3a 0%, ${INK} 100%)`, fg: '#fff', sub: 'rgba(255,255,255,.78)', mark: '#fff', ring: CORAL },
  cream: { bg: 'radial-gradient(100% 70% at 10% 0%, #ffe3da 0%, rgba(255,227,218,0) 65%), linear-gradient(180deg, #fff6f2 0%, #fdeee8 100%)', fg: INK, sub: '#5b6272', mark: INK, ring: CORAL },
};

const fileUrl = (p) => `/__promo/file/${encodeURI(p.replace(/\\/g, '/'))}`;

const BASE_CSS = `
@font-face{font-family:P;font-weight:400;src:url(/fonts/pretendard-regular.woff2) format("woff2")}
@font-face{font-family:P;font-weight:700;src:url(/fonts/pretendard-bold.woff2) format("woff2")}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden}
body{font-family:P,system-ui,sans-serif;-webkit-font-smoothing:antialiased;position:relative}
.h{font-weight:700;letter-spacing:-0.025em;line-height:1.14;word-break:keep-all;text-wrap:balance}
.s{font-weight:400;letter-spacing:-0.01em;line-height:1.35;word-break:keep-all;text-wrap:balance}
.mark{font-weight:700;letter-spacing:-0.02em}
.phone{position:absolute;background:#0e1016;box-shadow:0 50px 90px rgba(20,16,30,.35),0 0 0 2px rgba(255,255,255,.06) inset}
.screen{position:relative;overflow:hidden;background:#fff}
.screen img{display:block;width:100%}
.sb{display:flex;align-items:center;justify-content:space-between;background:#fff;color:#111;font-weight:700;position:relative}
.island{position:absolute;left:50%;transform:translateX(-50%);background:#0e1016;border-radius:999px}
.bat{display:flex;gap:.28em;align-items:center}
.bars{display:flex;gap:.12em;align-items:flex-end}
.bars i{display:block;width:.22em;background:#111;border-radius:.06em}
.batt{width:1.55em;height:.78em;border:.09em solid #111;border-radius:.22em;padding:.08em;position:relative}
.batt b{display:block;height:100%;width:78%;background:#111;border-radius:.1em}
`;

/** A phone around a capture. `w` is the outer width in px. */
function phone(src, w, { x, y, rotate = 0, z = 1, extra = '' } = {}) {
  const pad = Math.round(w * 0.028);
  const rOut = Math.round(w * 0.13);
  const rIn = rOut - pad;
  const sbH = Math.round(w * 0.078);
  const fs = Math.round(w * 0.036);
  return `<div class="phone" style="left:${x}px;top:${y}px;width:${w}px;padding:${pad}px;border-radius:${rOut}px;transform:rotate(${rotate}deg);z-index:${z};${extra}">
    <div class="screen" style="border-radius:${rIn}px">
      <div class="sb" style="height:${sbH}px;padding:0 ${Math.round(w * 0.075)}px;font-size:${fs}px">
        <span>14:20</span>
        <span class="island" style="top:${Math.round(sbH * 0.2)}px;width:${Math.round(w * 0.27)}px;height:${Math.round(sbH * 0.62)}px"></span>
        <span class="bat"><span class="bars"><i style="height:.35em"></i><i style="height:.55em"></i><i style="height:.75em"></i><i style="height:.95em"></i></span><span class="batt"><b></b></span></span>
      </div>
      <img src="${fileUrl(src)}">
    </div></div>`;
}

const wordmark = (t, size) => `<div class="mark" style="font-size:${size}px;color:${t.mark}">24Hou<span style="color:${t.ring}">ring</span></div>`;

function page(w, h, t, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
    body{width:${w}px;height:${h}px;background:${t.bg};color:${t.fg}}</style></head><body>${body}</body></html>`;
}

// ── Layouts ──────────────────────────────────────────────────────────────────
function playHtml(t, [head, sub], shot) {
  const W = 700;
  return page(1080, 1920, t, `
    <div style="position:absolute;left:60px;right:60px;top:78px;text-align:center">
      <div class="h" style="font-size:74px">${head}</div>
      <div class="s" style="font-size:36px;margin-top:22px;color:${t.sub}">${sub}</div>
    </div>
    ${phone(shot, W, { x: (1080 - W) / 2, y: 372 })}`);
}

function feedHtml(t, [head, sub], shot) {
  const W = 640;
  return page(1080, 1350, t, `
    <div style="position:absolute;left:70px;right:70px;top:64px;text-align:center">
      ${wordmark(t, 30)}
      <div class="h" style="font-size:64px;margin-top:26px">${head}</div>
      <div class="s" style="font-size:31px;margin-top:18px;color:${t.sub}">${sub}</div>
    </div>
    ${phone(shot, W, { x: (1080 - W) / 2, y: 402 })}`);
}

function storyHtml(t, [head, sub], shot) {
  const W = 780;
  return page(1080, 1920, t, `
    <div style="position:absolute;left:80px;right:80px;top:236px;text-align:center">
      ${wordmark(t, 34)}
      <div class="h" style="font-size:84px;margin-top:30px">${head}</div>
      <div class="s" style="font-size:38px;margin-top:22px;color:${t.sub}">${sub}</div>
    </div>
    ${phone(shot, W, { x: (1080 - W) / 2, y: 640 })}`);
}

function overviewHtml(t, [head, sub], shots, names) {
  // Five phones in a shallow fan, the middle one in front.
  const slots = [
    { w: 300, x: 14, y: 560, r: -7, z: 1 }, { w: 330, x: 196, y: 500, r: -3.5, z: 2 },
    { w: 360, x: 360, y: 450, r: 0, z: 3 },
    { w: 330, x: 554, y: 500, r: 3.5, z: 2 }, { w: 300, x: 766, y: 560, r: 7, z: 1 },
  ];
  const order = ['calendar', 'life', 'timetable', 'relation', 'place'];
  const chips = ['timetable', 'calendar', 'life', 'relation', 'place']
    .map((k) => `<span style="padding:10px 22px;border-radius:999px;background:${t === THEMES.cream ? '#fff' : 'rgba(255,255,255,.14)'};font-size:26px;font-weight:700">${names[k]}</span>`).join('');
  return page(1080, 1350, t, `
    <div style="position:absolute;left:60px;right:60px;top:64px;text-align:center">
      ${wordmark(t, 30)}
      <div class="h" style="font-size:58px;margin-top:24px">${head}</div>
      <div class="s" style="font-size:31px;margin-top:16px;color:${t.sub}">${sub}</div>
      <div style="display:flex;gap:12px;justify-content:center;margin-top:26px">${chips}</div>
    </div>
    ${order.map((k, i) => phone(shots[k], slots[i].w, { x: slots[i].x, y: slots[i].y, rotate: slots[i].r, z: slots[i].z })).join('')}`);
}

function featureHtml(t, [head, sub], a, b) {
  return page(1024, 500, t, `
    <div style="position:absolute;left:64px;top:0;bottom:0;width:520px;display:flex;flex-direction:column;justify-content:center">
      ${wordmark(t, 40)}
      <div class="h" style="font-size:50px;margin-top:22px">${head}</div>
      <div class="s" style="font-size:22px;margin-top:16px;color:${t.sub}">${sub}</div>
    </div>
    ${phone(a, 250, { x: 600, y: 70, rotate: -6, z: 2 })}
    ${phone(b, 230, { x: 800, y: 120, rotate: 6, z: 1 })}`);
}

function tabletHtml(t, [head, sub], shot) {
  const W = 1240;
  return page(1920, 1080, t, `
    <div style="position:absolute;left:100px;top:0;bottom:0;width:480px;display:flex;flex-direction:column;justify-content:center">
      ${wordmark(t, 36)}
      <div class="h" style="font-size:60px;margin-top:28px">${head}</div>
      <div class="s" style="font-size:30px;margin-top:22px;color:${t.sub}">${sub}</div>
    </div>
    <div style="position:absolute;left:620px;top:${(1080 - (W / 1.6 + 44)) / 2}px;width:${W}px;border-radius:18px;overflow:hidden;
      box-shadow:0 40px 90px rgba(20,16,30,.3);background:#fff">
      <div style="height:44px;background:#eef0f4;display:flex;align-items:center;gap:10px;padding:0 18px">
        <i style="width:13px;height:13px;border-radius:50%;background:#ff5f57"></i><i style="width:13px;height:13px;border-radius:50%;background:#febc2e"></i><i style="width:13px;height:13px;border-radius:50%;background:#28c840"></i>
        <span style="margin-left:24px;flex:1;max-width:520px;height:26px;border-radius:8px;background:#fff;color:#6b7280;font-size:15px;display:flex;align-items:center;padding:0 12px">24houring.com</span>
      </div>
      <img src="${fileUrl(shot)}" style="display:block;width:100%">
    </div>`);
}

// ── Rendering ────────────────────────────────────────────────────────────────
async function render(pg, base, html, w, h, file) {
  await pg.setViewportSize({ width: w, height: h });
  await pg.goto(`${base}/__promo/blank`);
  await pg.setContent(html, { waitUntil: 'load' });
  await pg.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }))));
  });
  await pg.screenshot({ path: file });
}

const PLAY_ORDER = ['timetable', 'editor', 'table', 'calendar', 'life', 'relation', 'place', 'pins'];
const PLAY_THEME = { timetable: 'coral', editor: 'cream', table: 'ink', calendar: 'coral', life: 'cream', relation: 'ink', place: 'coral', pins: 'cream' };
const FEED_TABS = ['timetable', 'calendar', 'life', 'relation', 'place'];
const FEED_THEME = { timetable: 'cream', calendar: 'coral', life: 'ink', relation: 'cream', place: 'coral' };
const TABLET = [['timetable', 'coral'], ['life', 'cream'], ['place', 'ink']];

export async function composeAll(browser, base, { OUT, RAW, LANGS, COPY }) {
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const pg = await ctx.newPage();
  const raw = (lang, id, kind = 'phone') => join(RAW, `${kind}-${lang}-${id}.png`);
  const done = (f) => console.log(`  ${f.slice(OUT.length + 1)}`);
  try {
    for (const lang of LANGS) {
      // Play phone screenshots, numbered in listing order.
      for (const [i, id] of PLAY_ORDER.entries()) {
        if (!existsSync(raw(lang, id))) continue;
        const f = join(OUT, 'play', `phone-${lang}-${String(i + 1).padStart(2, '0')}-${id}.png`);
        await render(pg, base, playHtml(THEMES[PLAY_THEME[id]], COPY[id][lang], raw(lang, id)), 1080, 1920, f);
        done(f);
      }
      // Feature graphic.
      {
        const f = join(OUT, 'play', `feature-graphic-${lang}.png`);
        await render(pg, base, featureHtml(THEMES.coral, COPY.feature[lang], raw(lang, 'timetable'), raw(lang, 'life')), 1024, 500, f);
        done(f);
      }
      // Tablet / desktop layout.
      for (const [i, [id, theme]] of TABLET.entries()) {
        if (!existsSync(raw(lang, id, 'desk'))) continue;
        const f = join(OUT, 'play', `tablet-${lang}-${i + 1}-${id}.png`);
        await render(pg, base, tabletHtml(THEMES[theme], COPY[id][lang], raw(lang, id, 'desk')), 1920, 1080, f);
        done(f);
      }
      // Instagram feed (4:5) and story (9:16).
      for (const id of FEED_TABS) {
        const t = THEMES[FEED_THEME[id]];
        let f = join(OUT, 'sns', 'feed', `feed-${lang}-${id}.png`);
        await render(pg, base, feedHtml(t, COPY[id][lang], raw(lang, id)), 1080, 1350, f);
        done(f);
        f = join(OUT, 'sns', 'story', `story-${lang}-${id}.png`);
        await render(pg, base, storyHtml(THEMES.ink === t ? THEMES.coral : THEMES.ink, COPY[id][lang], raw(lang, id)), 1080, 1920, f);
        done(f);
      }
      const shots = Object.fromEntries(FEED_TABS.map((k) => [k, raw(lang, k)]));
      const f = join(OUT, 'sns', 'feed', `feed-${lang}-00-overview.png`);
      await render(pg, base, overviewHtml(THEMES.ink, COPY.overview[lang], shots, TAB_NAMES[lang]), 1080, 1350, f);
      done(f);
    }
  } finally {
    await ctx.close();
  }
}

/** Title / end cards for the reel, as 1080×1920 PNGs. */
export async function renderCards(browser, base, cards) {
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const pg = await ctx.newPage();
  try {
    for (const c of cards) {
      const t = THEMES[c.theme ?? 'coral'];
      const html = c.kind === 'frame'
        ? page(1080, 1920, t, `
          <div style="position:absolute;left:70px;right:70px;top:120px;text-align:center">
            ${wordmark(t, 32)}
            <div class="h" style="font-size:72px;margin-top:26px">${c.head}</div>
            <div class="s" style="font-size:34px;margin-top:18px;color:${t.sub}">${c.sub}</div>
          </div>
          <div style="position:absolute;left:${c.hole.x - 22}px;top:${c.hole.y - 22}px;width:${c.hole.w + 44}px;height:${c.hole.h + 44}px;
            border-radius:70px;background:#0e1016;box-shadow:0 50px 90px rgba(20,16,30,.35)"></div>`)
        : page(1080, 1920, t, `
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 90px">
            ${wordmark(t, 64)}
            <div class="h" style="font-size:88px;margin-top:40px">${c.head}</div>
            <div class="s" style="font-size:40px;margin-top:26px;color:${t.sub}">${c.sub}</div>
          </div>`);
      await render(pg, base, html, 1080, 1920, c.file);
    }
  } finally {
    await ctx.close();
  }
}
