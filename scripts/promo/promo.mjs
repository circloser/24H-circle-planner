/**
 * Marketing assets: renders several English-labelled day schedules on the 24h
 * circle via the /s read-only viewer (light + dark) and stitches a looping GIF
 * that cycles through them. Reuses the proven templates/build render path.
 *
 *   npm run build   # first (screenshots load ./dist)
 *   node scripts/promo/promo.mjs
 *
 * Output: Desktop/24houring_playstore/promo/*.png + circle-cycle.gif
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { launchPage, serveDist, wait } from '../e2e/_helpers.mjs';

const OUT = join(homedir(), 'Desktop', '24houring_playstore', 'promo');
mkdirSync(OUT, { recursive: true });

const hm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const viewCode = (t) => b64url(JSON.stringify({ v: 1, n: t.name, s: t.slices.map(([st, l, c, i]) => [hm(st), l, c, i]) }));

// English-labelled schedules for an international audience. [start,label,color,icon]
const SCHEDULES = [
  { slug: 'deep-work-day', name: 'A focused work day', slices: [
    ['07:00', 'Wake up', '#fbbf24', '🌅'], ['07:30', 'Workout', '#6ee7b7', '🏃'],
    ['08:30', 'Breakfast', '#fca5a5', '🍳'], ['09:00', 'Deep work', '#93c5fd', '💻'],
    ['12:00', 'Lunch', '#fdba74', '🍽️'], ['13:00', 'Meetings', '#a5b4fc', '🗣️'],
    ['15:00', 'Deep work', '#7dd3fc', '🧠'], ['18:00', 'Dinner', '#fca5a5', '🍲'],
    ['19:00', 'Family time', '#f9a8d4', '👨‍👩‍👧'], ['21:00', 'Reading', '#c4b5fd', '📖'],
    ['22:30', 'Wind down', '#a7f3d0', '🛁'], ['23:00', 'Sleep', '#c7d2fe', '🌙'],
  ] },
  { slug: 'study-day', name: 'A student study day', slices: [
    ['06:30', 'Wake up', '#fbbf24', '🌅'], ['07:00', 'Morning routine', '#a7f3d0', '🪥'],
    ['08:00', 'Study block 1', '#93c5fd', '📚'], ['10:00', 'Break', '#ddd6fe', '☕'],
    ['10:30', 'Study block 2', '#7dd3fc', '✏️'], ['12:30', 'Lunch', '#fca5a5', '🍱'],
    ['13:30', 'Study block 3', '#a5b4fc', '📖'], ['15:30', 'Exercise', '#6ee7b7', '⚽'],
    ['16:30', 'Study block 4', '#93c5fd', '🧠'], ['18:30', 'Dinner', '#fca5a5', '🍲'],
    ['19:30', 'Review & rest', '#fdba74', '🎧'], ['22:30', 'Sleep', '#c7d2fe', '🌙'],
  ] },
  { slug: 'freelancer-day', name: 'A freelancer day', slices: [
    ['08:00', 'Slow morning', '#fbbf24', '☕'], ['09:00', 'Emails & admin', '#a7f3d0', '📥'],
    ['10:00', 'Client work', '#93c5fd', '💼'], ['13:00', 'Lunch & walk', '#6ee7b7', '🚶'],
    ['14:30', 'Creative work', '#a5b4fc', '🎨'], ['17:30', 'Break', '#ddd6fe', '🍵'],
    ['18:00', 'Wrap up', '#fdba74', '✅'], ['19:00', 'Dinner', '#fca5a5', '🍝'],
    ['20:00', 'Side project', '#7dd3fc', '🚀'], ['22:00', 'Relax', '#f9a8d4', '📺'],
    ['23:30', 'Sleep', '#c7d2fe', '🌙'],
  ] },
  { slug: 'miracle-morning', name: 'Miracle morning', slices: [
    ['05:00', 'Wake up', '#fbbf24', '🌄'], ['05:15', 'Meditate', '#ddd6fe', '🧘'],
    ['05:45', 'Journal', '#a7f3d0', '📓'], ['06:15', 'Exercise', '#6ee7b7', '🏋️'],
    ['07:00', 'Read', '#c4b5fd', '📖'], ['07:45', 'Breakfast', '#fca5a5', '🍳'],
    ['08:30', 'Focused work', '#93c5fd', '💻'], ['12:30', 'Lunch', '#fdba74', '🍽️'],
    ['13:30', 'Work', '#7dd3fc', '🧠'], ['18:00', 'Dinner & family', '#f9a8d4', '🍲'],
    ['21:00', 'Wind down', '#a7f3d0', '🛁'], ['21:30', 'Sleep', '#c7d2fe', '🌙'],
  ] },
  { slug: 'balanced-weekend', name: 'A balanced weekend', slices: [
    ['08:00', 'Sleep in', '#c7d2fe', '😴'], ['09:00', 'Brunch', '#fca5a5', '🥞'],
    ['10:30', 'Chores', '#a7f3d0', '🧺'], ['12:00', 'Hobby', '#fdba74', '🎨'],
    ['14:00', 'Outdoors', '#6ee7b7', '🌳'], ['17:00', 'Free time', '#f9a8d4', '🎮'],
    ['18:30', 'Dinner', '#fca5a5', '🍲'], ['20:00', 'Movie', '#a5b4fc', '🎬'],
    ['22:30', 'Plan the week', '#93c5fd', '📝'], ['23:00', 'Sleep', '#c7d2fe', '🌙'],
  ] },
];

async function shot(page, base, t, theme) {
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript((th) => { try { localStorage.setItem('24h-circle-planner.theme', th); } catch (e) {} }, theme);
  await page.goto('about:blank');
  await page.goto(`${base}/s#d=${viewCode(t)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate((th) => document.documentElement.setAttribute('data-theme', th), theme);
  await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
  await wait(800);
  const el = page.locator('svg[role="img"]').first();
  const box = await el.boundingBox();
  return { el, box };
}

const { base, close } = await serveDist();
const { browser, page } = await launchPage({ viewport: { width: 1040, height: 1040 }, deviceScaleFactor: 2 });
const lightFrames = [];
let clip = null;
try {
  // Light stills for every schedule (+ capture frames for the GIF).
  for (const t of SCHEDULES) {
    const { el, box } = await shot(page, base, t, 'light');
    await el.screenshot({ path: join(OUT, `circle-${t.slug}.png`) });
    if (!clip) clip = { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
    lightFrames.push(await page.screenshot({ clip }));
    console.log('shot  circle-' + t.slug + '.png');
  }
  // Dark hero for the first two.
  for (const t of SCHEDULES.slice(0, 2)) {
    const { el } = await shot(page, base, t, 'dark');
    await el.screenshot({ path: join(OUT, `circle-${t.slug}-dark.png`) });
    console.log('shot  circle-' + t.slug + '-dark.png');
  }
} finally {
  await browser.close();
  close();
}

// ─── Stitch the looping GIF (pure-JS encoder; optional dep) ───────────────────
try {
  const { createRequire } = await import('module');
  const DEPS_ROOT = process.env.GIF_DEPS || join(homedir(), 'AppData', 'Local', 'Temp', 'claude', 'gifdeps');
  const req = createRequire(join(DEPS_ROOT, 'noop.js'));
  const { GIFEncoder, quantize, applyPalette } = req('gifenc');
  const { PNG } = req('pngjs');
  const enc = GIFEncoder();
  for (const buf of lightFrames) {
    const png = PNG.sync.read(buf);
    const data = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    enc.writeFrame(index, png.width, png.height, { palette, delay: 1300 });
  }
  enc.finish();
  writeFileSync(join(OUT, 'circle-cycle.gif'), Buffer.from(enc.bytes()));
  console.log('gif   circle-cycle.gif (' + lightFrames.length + ' frames)');
} catch (e) {
  console.log('GIF skipped (encoder unavailable): ' + e.message);
}

console.log('DONE →', OUT);
