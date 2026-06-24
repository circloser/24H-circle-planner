/**
 * Batch 14 verification (offline, dist-single):
 *  Splitting a slice gives the new cell a colour similar to — but distinct from —
 *  BOTH flanking cells. Verified by performing a real split via the "+" affordance
 *  in the 24h, day, and night views and reading the resulting schedule.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ n, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
const errors = [];
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });
await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });

// Load 직장인 preset.
let card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
if (!(await card.isVisible({ timeout: 2500 }).catch(() => false))) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('button[aria-label="디자인"]').first().click().catch(() => {}); await page.waitForTimeout(200); await page.locator('[role="menuitem"]:has-text("프리셋")').first().click().catch(() => {});
  await wait(300);
  card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
}
await card.click().catch(() => {});
await page.locator('button:has-text("현재 창에 적용")').first().click().catch(() => {});
await wait(600);

const toggle = page.locator('button[aria-label*="시간표 보기 전환"]').first();
function rgbOf(hex) { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function dist(a, b) { const x = rgbOf(a), y = rgbOf(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); }

// Ordered [{id,color}] of all slices, read from the full (24h) view (1 path each).
async function readSlicesFull() {
  return page.evaluate(() => Array.from(document.querySelectorAll('svg[role="img"] path[data-slice-id]'))
    .map((p) => ({ id: p.getAttribute('data-slice-id'), color: (p.getAttribute('fill') || '').toLowerCase() })));
}
async function setView(clicks) { for (let i = 0; i < clicks; i++) { await toggle.click(); await wait(300); } }

async function testSplitInView(name, viewClicks) {
  // Start at full, capture the id set, then go to the target view.
  await setView((3 - 0) % 3); // ensure full (no-op cycles back to full from wherever)
  // normalise to full: cycle until the toggle label shows 24시간
  for (let i = 0; i < 3; i++) {
    const label = await toggle.textContent().catch(() => '');
    if ((label || '').includes('24')) break;
    await toggle.click(); await wait(250);
  }
  const before = await readSlicesFull();
  const beforeIds = new Set(before.map((s) => s.id));

  await setView(viewClicks);
  // Hover the first in-window boundary so the +/- affordances appear, then click left "+".
  const slider = page.locator('svg[role="img"] [role="slider"]').first();
  const box = await slider.boundingBox();
  if (!box) { pass(`split colour distinct (${name})`, false, 'no boundary slider'); return; }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await wait(250);
  const plus = page.locator('svg[role="img"] [role="button"][aria-label="왼쪽 칸에 일정 추가"]').first();
  if (!(await plus.isVisible().catch(() => false))) { pass(`split colour distinct (${name})`, false, '+ affordance not shown'); return; }
  await plus.click();
  await wait(350);

  // Back to full to read all slices cleanly.
  for (let i = 0; i < 3; i++) {
    const label = await toggle.textContent().catch(() => '');
    if ((label || '').includes('24')) break;
    await toggle.click(); await wait(250);
  }
  const after = await readSlicesFull();
  const newOnes = after.filter((s) => !beforeIds.has(s.id));
  if (newOnes.length !== 1) { pass(`split colour distinct (${name})`, false, `expected 1 new slice, got ${newOnes.length}`); return; }
  const newId = newOnes[0].id;
  const idx = after.findIndex((s) => s.id === newId);
  const n = after.length;
  const left = after[(idx - 1 + n) % n];
  const right = after[(idx + 1) % n];
  const dL = dist(after[idx].color, left.color);
  const dR = dist(after[idx].color, right.color);
  const ok = after[idx].color !== left.color && after[idx].color !== right.color && dL > 10 && dR > 10;
  pass(`split colour distinct (${name})`, ok, `new=${after[idx].color} L=${left.color}(Δ${dL.toFixed(0)}) R=${right.color}(Δ${dR.toFixed(0)})`);
}

await testSplitInView('24h', 0);
await testSplitInView('day', 1);
await testSplitInView('night', 2);

await page.screenshot({ path: 'scripts/_v14-chart.png' });
await browser.close();
console.log('\nconsole errors:', errors.length);
errors.forEach((e) => console.log('  ', e));
const allOk = results.every((r) => r.ok) && errors.length === 0;
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
