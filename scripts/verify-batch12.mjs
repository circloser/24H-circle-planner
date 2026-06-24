/**
 * Batch 12 verification (offline, dist-single):
 *  #1 12h-view boundary drag: time pill + dot follow the cursor.
 *  #2 adjacent NARROW slice labels stagger radially (different radii).
 *  #3 rim memos belong to a day: switching days changes the shown memos.
 *  #4 export-dialog preview has NO border frame.
 *  #5 settings (gear) menu: every item has a leading icon; left-aligned.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ n, ok, extra }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });

async function loadPreset() {
  let card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
  if (!(await card.isVisible({ timeout: 2500 }).catch(() => false))) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.locator('button[aria-label="디자인"]').first().click().catch(() => {}); await page.waitForTimeout(200); await page.locator('[role="menuitem"]:has-text("프리셋")').first().click().catch(() => {});
    await page.waitForTimeout(300);
    card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
  }
  await card.click().catch(() => {});
  await page.locator('button:has-text("현재 창에 적용")').first().click().catch(() => {});
  await page.waitForTimeout(600);
}
await loadPreset();

// ─── #2 adjacent narrow slice labels stagger ────────────────────────────────
// 기상·아침 (06–07, 60min) and 출근 (07–08, 60min) are adjacent & narrow → opposite
// radial offsets → their label anchors sit at different distances from center.
try {
  const radii = await page.evaluate(() => {
    const want = ['기상', '출근'];
    const out = {};
    for (const g of document.querySelectorAll('g[data-label-id][data-label-kind="inside"]')) {
      const txt = g.textContent || '';
      for (const w of want) {
        if (txt.includes(w) && !(w in out)) {
          const tr = g.getAttribute('transform') || '';
          const m = tr.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
          if (m) {
            const x = parseFloat(m[1]) - 500, y = parseFloat(m[2]) - 500;
            out[w] = Math.hypot(x, y);
          }
        }
      }
    }
    return out;
  });
  const ok = radii['기상'] != null && radii['출근'] != null && Math.abs(radii['기상'] - radii['출근']) > 20;
  pass('#2 narrow-label stagger', ok, `r(기상)=${radii['기상']?.toFixed(1)} r(출근)=${radii['출근']?.toFixed(1)} Δ=${radii['기상'] != null && radii['출근'] != null ? Math.abs(radii['기상'] - radii['출근']).toFixed(1) : 'n/a'}`);
} catch (e) { pass('#2 narrow-label stagger', false, e.message); }

// ─── #1 12h-view boundary drag follows ──────────────────────────────────────
try {
  // Switch to day view (one cycle from full).
  await page.locator('button[aria-label*="시간표 보기 전환"]').first().click();
  await page.waitForTimeout(400);
  // Grab a visible boundary slider in day view.
  const slider = page.locator('svg[role="img"] [role="slider"]').first();
  const box = await slider.boundingBox();
  if (!box) throw new Error('no boundary slider visible in day view');
  const sx = box.x + box.width / 2, sy = box.y + box.height / 2;
  await page.mouse.move(sx, sy);
  await page.waitForTimeout(120);
  await page.mouse.down();
  await page.waitForTimeout(60);
  // Pill appears while dragging. Read its text + a dot cx before moving far.
  const before = await page.evaluate(() => {
    const t = document.querySelector('svg[role="img"] [data-time-pill-text]');
    return { pill: t ? t.textContent : null };
  });
  // Move tangentially to clearly change the boundary angle/time.
  const chart = await page.locator('svg[role="img"]').first().boundingBox();
  const cx = chart.x + chart.width / 2, cy = chart.y + chart.height / 2;
  // target a point ~ along the ring but rotated: move 100px around the circle
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    await page.mouse.move(sx + (cx - sx) * 0 + 90 * t, sy + 70 * t, { steps: 1 });
    await page.waitForTimeout(15);
  }
  await page.waitForTimeout(80);
  const after = await page.evaluate(() => {
    const t = document.querySelector('svg[role="img"] [data-time-pill-text]');
    return { pill: t ? t.textContent : null };
  });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const ok = !!before.pill && !!after.pill && before.pill !== after.pill;
  pass('#1 12h drag pill follows', ok, `pill ${before.pill} -> ${after.pill}`);
  // back to full view (cycle day->night->full = 2 clicks)
  await page.locator('button[aria-label*="시간표 보기 전환"]').first().click();
  await page.waitForTimeout(150);
  await page.locator('button[aria-label*="시간표 보기 전환"]').first().click();
  await page.waitForTimeout(300);
} catch (e) { pass('#1 12h drag pill follows', false, e.message); }

// ─── #4 export preview has no border ────────────────────────────────────────
try {
  await page.getByRole('button', { name: '내보내기', exact: true }).first().click();
  await page.waitForTimeout(500);
  const borderW = await page.evaluate(() => {
    const img = document.querySelector('[role="dialog"] img[alt]');
    if (!img) return null;
    const box = img.closest('div');
    const cs = getComputedStyle(box);
    return { top: cs.borderTopWidth, right: cs.borderRightWidth, bottom: cs.borderBottomWidth, left: cs.borderLeftWidth };
  });
  const ok = borderW && ['top', 'right', 'bottom', 'left'].every((k) => parseFloat(borderW[k]) === 0);
  pass('#4 export preview no border', ok, JSON.stringify(borderW));
  await page.locator('[role="dialog"] [data-export-exclude="true"]').first().screenshot({ path: 'scripts/_v12-preview.png' }).catch(() => {});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
} catch (e) { pass('#4 export preview no border', false, e.message); }

// ─── #5 gear menu: every item has a leading icon ────────────────────────────
try {
  await page.locator('button[aria-label="설정"]').first().click();
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
    return items.map((it) => ({
      text: (it.textContent || '').trim().slice(0, 14),
      hasSvg: !!it.querySelector('svg'),
      justify: getComputedStyle(it).justifyContent,
    }));
  });
  const allIcons = info.length > 0 && info.every((i) => i.hasSvg);
  const leftAligned = info.every((i) => i.justify === 'flex-start' || i.justify === 'normal' || i.justify === 'start');
  pass('#5 gear menu icons', allIcons, `${info.filter((i) => i.hasSvg).length}/${info.length} items have icons`);
  pass('#5 gear menu left-aligned', leftAligned, `justify set: ${[...new Set(info.map((i) => i.justify))].join(',')}`);
  console.log('   menu items:', info.map((i) => `${i.hasSvg ? '✓' : '✗'}${i.text}`).join(' | '));
  // screenshot the open menu
  await page.locator('[role="menu"]').first().screenshot({ path: 'scripts/_v12-menu.png' }).catch(() => {});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
} catch (e) { pass('#5 gear menu icons', false, e.message); }

// ─── #3 rim memos per day ───────────────────────────────────────────────────
try {
  // Add a rim memo by clicking the rim band (just outside the slices) at top-left.
  const chart = await page.locator('svg[role="img"]').first().boundingBox();
  const cx = chart.x + chart.width / 2, cy = chart.y + chart.height / 2;
  const half = chart.width / 2;
  const rBand = (489 / 536) * half; // band ring radius in screen px
  const ang = (-135 * Math.PI) / 180;
  const bx = cx + rBand * Math.cos(ang), by = cy + rBand * Math.sin(ang);
  await page.mouse.move(bx, by);
  await page.waitForTimeout(120);
  await page.mouse.click(bx, by);
  await page.waitForTimeout(250);
  // Type into the focused contentEditable memo.
  await page.keyboard.type('테스트메모');
  await page.waitForTimeout(150);
  // blur by clicking the center hub (away from band)
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(250);
  const countDay1 = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.rim-memo-text')).filter((e) => (e.innerText || '').trim().length > 0).length);
  // Add a new EMPTY day: click the DayBar "+" (opens a choice dialog), then "빈 시간표".
  let added = false;
  const dayAdd = page.locator('button[aria-label="날짜 추가"]').first();
  if (await dayAdd.isVisible().catch(() => false)) {
    await dayAdd.click().catch(() => {});
    await page.waitForTimeout(300);
    const emptyBtn = page.locator('[role="dialog"] button:has-text("빈 시간표")').first();
    if (await emptyBtn.isVisible().catch(() => false)) { await emptyBtn.click().catch(() => {}); added = true; }
  }
  await page.waitForTimeout(500);
  const countNewDay = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.rim-memo-text')).filter((e) => (e.innerText || '').trim().length > 0).length);
  const ok = countDay1 >= 1 && added && countNewDay === 0;
  pass('#3 rim memo per-day', ok, `day1=${countDay1} added=${added} newDay=${countNewDay}`);
} catch (e) { pass('#3 rim memo per-day', false, e.message); }

await browser.close();
console.log('\nconsole errors:', errors.length);
errors.forEach((e) => console.log('  ', e));
const allOk = results.every((r) => r.ok) && errors.length === 0;
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
