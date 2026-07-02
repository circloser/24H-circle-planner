/**
 * Verifies the scissors cut empties the SMALLER half (larger keeps the name +
 * colour), and the empty half gets a sibling-but-different colour. Offline build.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });

// Load a preset.
await page.locator('button:has(h3)').first().click();
await page.getByRole('button', { name: 'Apply to current' }).first().click().catch(() => {});
await page.waitForTimeout(800); // allow the debounced save

const readSlices = () => page.evaluate(() => {
  const env = JSON.parse(localStorage.getItem('24h-circle-planner.days') || '{}');
  const day = env.days?.find((d) => d.id === env.activeId) ?? env.days?.[0];
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return (t === '24:00' ? 1440 : h * 60 + m); };
  return (day?.schedule?.slices ?? []).map((s) => {
    let w = toMin(s.endTime) - toMin(s.startTime);
    if (w <= 0) w += 1440;
    return { id: s.id, label: s.label, color: s.color, startTime: s.startTime, endTime: s.endTime, width: w };
  });
});

const before = await readSlices();
// Pick the widest non-wrapping slice with a label.
const target = before
  .filter((s) => s.label && s.width >= 80)
  .sort((a, b) => b.width - a.width)[0];

// Cut at 22% from its start → left = 22% (smaller, should empty), right = 78% (keeps name).
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const startMin = toMin(target.startTime);
const cutMin = Math.round(startMin + target.width * 0.22);

const clickPt = await page.evaluate((cm) => {
  const svg = document.querySelector('svg[role="img"]');
  const r = svg.getBoundingClientRect();
  const VB = { x: -36, y: -36, w: 1072, h: 1072 };
  const cx = 500, cy = 500, rad = 410;
  const angDeg = -90 + (cm / 1440) * 360; // 00:00 at top, clockwise
  const a = (angDeg * Math.PI) / 180;
  const vx = cx + rad * Math.cos(a), vy = cy + rad * Math.sin(a);
  return { sx: r.left + ((vx - VB.x) / VB.w) * r.width, sy: r.top + ((vy - VB.y) / VB.h) * r.height };
}, cutMin);

await page.mouse.click(clickPt.sx, clickPt.sy);
await page.waitForTimeout(450); // past 220ms debounce + save
const after = await readSlices();

await browser.close();

// The parent's id should still exist and KEEP its label (the larger half).
const kept = after.find((s) => s.id === target.id);
// The new slice (id not in `before`) should be empty + smaller + different colour.
const beforeIds = new Set(before.map((s) => s.id));
const fresh = after.find((s) => !beforeIds.has(s.id));

console.log('target:', JSON.stringify({ label: target.label, width: target.width, color: target.color }));
console.log('kept  :', kept && JSON.stringify({ label: kept.label, width: kept.width }));
console.log('fresh :', fresh && JSON.stringify({ label: fresh.label, width: fresh.width, color: fresh.color }));
console.log('count', before.length, '->', after.length, '| console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const ok =
  after.length === before.length + 1 &&
  !!kept && kept.label === target.label && // larger keeps the name
  !!fresh && fresh.label === '' &&          // smaller is empty
  fresh.width < kept.width &&               // empty half is the smaller one
  fresh.color.toLowerCase() !== target.color.toLowerCase() && // similar-but-different colour
  errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
