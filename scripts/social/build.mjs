/**
 * Visual-social assets: renders curated day schedules on the 24h circle (via the
 * /s read-only viewer, reusing the templates/promo render path) and composes
 * ready-to-post cards for Pinterest (1000x1500, 2:3) and Instagram (1080x1080)
 * — circle hero + title + tagline + 24houring.com. Feeds the built-in image
 * growth loop (see [[social-sharing-roadmap]]).
 *
 *   npm run build            # first — screenshots load ./dist
 *   node scripts/social/build.mjs
 *
 * Output: Desktop/24houring_playstore/social/{slug}-{pin|sq}.png
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { launchPage, serveDist, wait } from '../e2e/_helpers.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const OUT = join(homedir(), 'Desktop', '24houring_playstore', 'social');
mkdirSync(OUT, { recursive: true });

const hm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const viewCode = (t) => b64url(JSON.stringify({ v: 1, n: t.name, s: t.slices.map(([st, l, c, i]) => [hm(st), l, c, i]) }));

// [start,label,color,icon]; title/tagline are the card copy (not the circle name).
const CARDS = [
  { slug: 'study-day', name: 'Study day', title: 'Plan your study day', tagline: 'as a circle — see focus, breaks & sleep at a glance', slices: [
    ['06:30', 'Wake up', '#fbbf24', '🌅'], ['07:00', 'Morning routine', '#a7f3d0', '🪥'],
    ['08:00', 'Study block 1', '#93c5fd', '📚'], ['10:00', 'Break', '#ddd6fe', '☕'],
    ['10:30', 'Study block 2', '#7dd3fc', '✏️'], ['12:30', 'Lunch', '#fca5a5', '🍱'],
    ['13:30', 'Study block 3', '#a5b4fc', '📖'], ['15:30', 'Exercise', '#6ee7b7', '⚽'],
    ['16:30', 'Study block 4', '#93c5fd', '🧠'], ['18:30', 'Dinner', '#fca5a5', '🍲'],
    ['19:30', 'Review & rest', '#fdba74', '🎧'], ['22:30', 'Sleep', '#c7d2fe', '🌙'],
  ] },
  { slug: 'miracle-morning', name: 'Miracle morning', title: 'The miracle morning', tagline: 'design the first hours that make your day', slices: [
    ['05:00', 'Wake up', '#fbbf24', '🌄'], ['05:15', 'Meditate', '#ddd6fe', '🧘'],
    ['05:45', 'Journal', '#a7f3d0', '📓'], ['06:15', 'Exercise', '#6ee7b7', '🏋️'],
    ['07:00', 'Read', '#c4b5fd', '📖'], ['07:45', 'Breakfast', '#fca5a5', '🍳'],
    ['08:30', 'Focused work', '#93c5fd', '💻'], ['12:30', 'Lunch', '#fdba74', '🍽️'],
    ['13:30', 'Work', '#7dd3fc', '🧠'], ['18:00', 'Dinner & family', '#f9a8d4', '🍲'],
    ['21:00', 'Wind down', '#a7f3d0', '🛁'], ['21:30', 'Sleep', '#c7d2fe', '🌙'],
  ] },
  { slug: 'deep-work', name: 'Focused work day', title: 'A focused work day', tagline: 'protect deep work — block it on the clock', slices: [
    ['07:00', 'Wake up', '#fbbf24', '🌅'], ['07:30', 'Workout', '#6ee7b7', '🏃'],
    ['08:30', 'Breakfast', '#fca5a5', '🍳'], ['09:00', 'Deep work', '#93c5fd', '💻'],
    ['12:00', 'Lunch', '#fdba74', '🍽️'], ['13:00', 'Meetings', '#a5b4fc', '🗣️'],
    ['15:00', 'Deep work', '#7dd3fc', '🧠'], ['18:00', 'Dinner', '#fca5a5', '🍲'],
    ['19:00', 'Family time', '#f9a8d4', '👨‍👩‍👧'], ['21:00', 'Reading', '#c4b5fd', '📖'],
    ['22:30', 'Wind down', '#a7f3d0', '🛁'], ['23:00', 'Sleep', '#c7d2fe', '🌙'],
  ] },
  { slug: 'study-ko', name: '수험생 하루', title: '수험생 하루 계획표', tagline: '공부·휴식·수면을 원형으로 한눈에', slices: [
    ['06:30', '기상', '#fbbf24', '🌅'], ['07:00', '아침 루틴', '#a7f3d0', '🪥'],
    ['08:00', '오전 공부', '#93c5fd', '📚'], ['10:00', '휴식', '#ddd6fe', '☕'],
    ['10:30', '오전 공부', '#7dd3fc', '✏️'], ['12:30', '점심', '#fca5a5', '🍱'],
    ['13:30', '오후 공부', '#a5b4fc', '📖'], ['15:30', '운동', '#6ee7b7', '⚽'],
    ['16:30', '오후 공부', '#93c5fd', '🧠'], ['18:30', '저녁', '#fca5a5', '🍲'],
    ['19:30', '복습·휴식', '#fdba74', '🎧'], ['22:30', '취침', '#c7d2fe', '🌙'],
  ] },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Compose one social card as a standalone HTML page sized to (w x h). */
function cardHtml({ circleDataUri, title, tagline, w, h, square }) {
  const circleMax = square ? Math.round(w * 0.82) : Math.round(w * 0.9);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${w}px;height:${h}px}
    body{font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;
      background:linear-gradient(160deg,#eef2ff 0%,#f8fafc 45%,#fdf2f8 100%);
      display:flex;flex-direction:column;align-items:center;
      justify-content:${square ? 'center' : 'flex-start'};
      padding:${square ? '48px' : '72px 56px 56px'};color:#1f2430;text-align:center}
    .brandtop{font-size:${square ? 30 : 34}px;font-weight:800;letter-spacing:-0.5px;color:#111827}
    .brandtop span{color:#FF4D4D}
    .title{font-size:${square ? 40 : 60}px;font-weight:800;line-height:1.12;letter-spacing:-1px;margin-top:${square ? 6 : 18}px}
    .tagline{font-size:${square ? 22 : 28}px;color:#4b5563;margin-top:14px;max-width:${Math.round(w*0.86)}px;line-height:1.4}
    .circle{width:${circleMax}px;height:${circleMax}px;margin:${square ? '18px 0 10px' : '28px 0 auto'}}
    .circle img{width:100%;height:100%;object-fit:contain}
    .footer{margin-top:${square ? 10 : 8}px;display:flex;flex-direction:column;gap:6px;align-items:center}
    .url{font-size:${square ? 26 : 32}px;font-weight:700;color:#111827}
    .sub{font-size:${square ? 18 : 22}px;color:#6b7280}
  </style></head><body>
    ${square ? '' : `<div class="brandtop">24Hou<span>ring</span></div>`}
    <div class="title">${esc(title)}</div>
    <div class="tagline">${esc(tagline)}</div>
    <div class="circle"><img src="${circleDataUri}" alt=""/></div>
    <div class="footer">
      <div class="url">24houring.com</div>
      <div class="sub">Free circular day planner · no sign-up</div>
    </div>
  </body></html>`;
}

async function circleDataUri(page, base, t) {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('about:blank');
  await page.goto(`${base}/s#d=${viewCode(t)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
  await wait(800);
  const el = page.locator('svg[role="img"]').first();
  const buf = await el.screenshot({ omitBackground: true });
  return 'data:image/png;base64,' + buf.toString('base64');
}

const cardPath = join(ROOT, 'dist', '_social_card.html');
const cardUrl = (base) => `${base}/_social_card.html`;

async function render(page, base, html, w, h, outPath) {
  writeFileSync(cardPath, html, 'utf8');
  await page.setViewportSize({ width: w, height: h });
  await page.goto(cardUrl(base), { waitUntil: 'networkidle', timeout: 30000 });
  await wait(300);
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: w, height: h } });
}

const { base, close } = await serveDist();
const { browser, page } = await launchPage({ deviceScaleFactor: 2 });
try {
  for (const t of CARDS) {
    const uri = await circleDataUri(page, base, t);
    await render(page, base, cardHtml({ circleDataUri: uri, title: t.title, tagline: t.tagline, w: 1000, h: 1500, square: false }), 1000, 1500, join(OUT, `${t.slug}-pin.png`));
    await render(page, base, cardHtml({ circleDataUri: uri, title: t.title, tagline: t.tagline, w: 1080, h: 1080, square: true }), 1080, 1080, join(OUT, `${t.slug}-sq.png`));
    console.log('made', t.slug, '(pin + sq)');
  }
} finally {
  await browser.close();
  await close();
}
console.log('\nsocial cards →', OUT);
