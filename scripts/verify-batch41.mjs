/**
 * Batch 41 (offline, dist-single): circular label alignment + fit-to-arc shrink.
 *  - A mid-narrow slice (25 min) keeps its TEXT inside (shrunk font), not icon-only.
 *  - A tiny slice (10 min) is auto-pulled OUTSIDE with a leader line.
 *  - Inside labels all sit on ONE circle (no radial staggering).
 *  - The narrow inside label's font is SMALLER than a wide one's (shrink-on-overlap).
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1100, height: 1000 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(300);

// Seed a day with a wide, a mid-narrow (25 min) and a tiny (10 min) slice, then reload.
await page.evaluate(() => {
  const slices = [
    { id: 'sleep', label: '수면', startTime: '00:00', endTime: '08:00', color: '#a78bfa', icon: '', textPosition: 'inside' },
    { id: 'med', label: '약먹기', startTime: '08:00', endTime: '08:25', color: '#60a5fa', icon: '', textPosition: 'inside' },
    { id: 'water', label: '물마시기', startTime: '08:25', endTime: '08:35', color: '#34d399', icon: '', textPosition: 'inside' },
    { id: 'work', label: '일', startTime: '08:35', endTime: '24:00', color: '#f472b6', icon: '', textPosition: 'inside' },
  ];
  const day = { id: 'd1', schedule: { id: 's', version: 1, name: '테스트', presetSource: null, updatedAt: '2026-07-01T00:00:00.000Z', slices } };
  localStorage.setItem('24h-circle-planner.days', JSON.stringify({ version: 1, activeId: 'd1', days: [day] }));
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(600);

const info = await page.evaluate(() => {
  const g = (id) => document.querySelector(`[data-label-id="${id}"]`);
  const texts = (el) => (el ? [...el.querySelectorAll('text')].map((t) => t.textContent || '').join('|') : '');
  // Radius of an inside label group from the chart centre (500,500 in SVG units).
  const radiusOf = (el) => {
    if (!el) return null;
    const m = (el.getAttribute('transform') || '').match(/translate\(\s*([-\d.]+)[ ,]+([-\d.]+)/);
    if (!m) return null;
    const x = parseFloat(m[1]) - 500;
    const y = parseFloat(m[2]) - 500;
    return Math.sqrt(x * x + y * y);
  };
  // Resolved font-size (px) of a label's TEXT node (the last <text>, i.e. the name).
  const fontOf = (el) => {
    if (!el) return null;
    const nodes = [...el.querySelectorAll('text')];
    const txt = nodes[nodes.length - 1];
    return txt ? parseFloat(getComputedStyle(txt).fontSize) : null;
  };
  const med = g('med');
  const water = g('water');
  const insideIds = ['sleep', 'med', 'work'];
  const radii = insideIds.map((id) => radiusOf(g(id))).filter((r) => r != null);
  return {
    medKind: med?.getAttribute('data-label-kind') || null,
    medText: texts(med),
    waterKind: water?.getAttribute('data-label-kind') || null,
    waterHasLeader: water ? !!water.querySelector('line') : false,
    waterText: texts(water),
    radii,
    radiusSpread: radii.length ? Math.max(...radii) - Math.min(...radii) : -1,
    sleepFont: fontOf(g('sleep')),
    medFont: fontOf(g('med')),
  };
});

pass('mid-narrow (25m) label stays INSIDE with text visible', info.medKind === 'inside' && info.medText.includes('약'), JSON.stringify({ medKind: info.medKind, medText: info.medText }));
pass('tiny (10m) label auto-pulled OUTSIDE with a leader line', info.waterKind === 'outside' && info.waterHasLeader, `kind=${info.waterKind} leader=${info.waterHasLeader}`);
pass('outside label keeps its text', info.waterText.includes('물'), `text=${info.waterText}`);
// Circular alignment: every inside label sits on ONE ring (no ±30 stagger → spread < 3).
pass('inside labels align on one circle (no staggering)', info.radiusSpread >= 0 && info.radiusSpread < 3, `radii=${JSON.stringify(info.radii.map((r) => Math.round(r)))} spread=${info.radiusSpread}`);
// Shrink-on-overlap: the 25-min wedge's font is smaller than the 8-hour wedge's.
pass('narrow inside label shrinks below the wide one', info.medFont != null && info.sleepFont != null && info.medFont < info.sleepFont, `medFont=${info.medFont} sleepFont=${info.sleepFont}`);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
