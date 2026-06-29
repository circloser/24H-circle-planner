/**
 * Batch 13 verification (offline, dist-single):
 *  #1 header "내보내기" button has no border (ghost).
 *  #2 settings (gear) menu grouping: 7 items + 2 separators (signed-out:
 *     login · language · share · copylink · home · transfer · reset).
 *  #3 12h (day/night) drag: slice AREAS (path d) + division + LABELS follow the
 *     cursor live, like the 24h view (previously only the time pill followed).
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ n, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });

// Load 직장인 preset.
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

// ─── #1 export button no border ─────────────────────────────────────────────
try {
  const b = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="내보내기"]');
    if (!btn) return null;
    const cs = getComputedStyle(btn);
    return { t: cs.borderTopWidth, r: cs.borderRightWidth, b: cs.borderBottomWidth, l: cs.borderLeftWidth };
  });
  const ok = b && [b.t, b.r, b.b, b.l].every((w) => parseFloat(w) === 0);
  pass('#1 export button no border', ok, JSON.stringify(b));
} catch (e) { pass('#1 export button no border', false, e.message); }

// ─── #2 gear menu grouping (post-reorg: 언어 · sep · 공유/링크/홈/초기화) ───────
try {
  await page.locator('button[aria-label="설정"]').first().click();
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => {
    const menu = document.querySelector('[role="menu"]');
    const seps = menu ? menu.querySelectorAll('[role="separator"]').length : -1;
    const items = menu ? menu.querySelectorAll('[role="menuitem"]').length : 0;
    return { seps, items };
  });
  pass('#2 gear menu grouping (7 items, 2 separators)', info.seps === 2 && info.items === 7, `separators=${info.seps} items=${info.items}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
} catch (e) { pass('#2 gear menu grouping (7 items, 2 separators)', false, e.message); }

// ─── #3 12h drag: areas + labels follow ─────────────────────────────────────
async function snapshot() {
  return page.evaluate(() => {
    const paths = {};
    document.querySelectorAll('svg[role="img"] path[data-slice-id]').forEach((p, i) => {
      paths[`${p.getAttribute('data-slice-id')}#${i}`] = p.getAttribute('d');
    });
    const labels = {};
    document.querySelectorAll('svg[role="img"] [data-label-id][data-label-kind="inside"]').forEach((g) => {
      labels[g.getAttribute('data-label-id')] = g.getAttribute('transform');
    });
    const pillEl = document.querySelector('svg[role="img"] [data-time-pill-text]');
    return { paths, labels, pill: pillEl ? pillEl.textContent : null };
  });
}
function diffCount(a, b) {
  let n = 0;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[k] !== b[k]) n++;
  return n;
}
try {
  // Switch to day view.
  await page.locator('button[aria-label*="시간표 보기 전환"]').first().click();
  await page.waitForTimeout(400);
  const before = await snapshot();
  const slider = page.locator('svg[role="img"] [role="slider"]').first();
  const box = await slider.boundingBox();
  if (!box) throw new Error('no boundary slider in day view');
  const sx = box.x + box.width / 2, sy = box.y + box.height / 2;
  await page.mouse.move(sx, sy);
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(60);
  for (let i = 1; i <= 8; i++) { await page.mouse.move(sx + 90 * (i / 8), sy + 70 * (i / 8), { steps: 1 }); await page.waitForTimeout(15); }
  await page.waitForTimeout(80);
  const during = await snapshot();
  const pathsChanged = diffCount(before.paths, during.paths);
  const labelsChanged = diffCount(before.labels, during.labels);
  const pillChanged = before.pill !== during.pill;
  await page.mouse.up();
  await page.waitForTimeout(200);
  // After release the resize must have committed (a slice path differs from pre-drag).
  const after = await snapshot();
  const committed = diffCount(before.paths, after.paths) > 0;
  const ok = pathsChanged >= 1 && labelsChanged >= 1 && pillChanged && committed;
  pass('#3 12h areas+labels follow', ok, `Δpaths=${pathsChanged} Δlabels=${labelsChanged} pill=${before.pill}->${during.pill} committed=${committed}`);
  // back to full view — cycle until the toggle shows 24h (robust to view count)
  for (let _i = 0; _i < 5; _i++) {
    const _lbl = await page.locator('button[aria-label*="시간표 보기 전환"]').first().textContent();
    if ((_lbl || '').includes('24')) break;
    await page.locator('button[aria-label*="시간표 보기 전환"]').first().click();
    await page.waitForTimeout(200);
  }
} catch (e) { pass('#3 12h areas+labels follow', false, e.message); }

// ─── regression: 24h drag still moves areas + labels ────────────────────────
try {
  const before = await snapshot();
  const slider = page.locator('svg[role="img"] [role="slider"]').first();
  const box = await slider.boundingBox();
  const sx = box.x + box.width / 2, sy = box.y + box.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.waitForTimeout(60);
  for (let i = 1; i <= 8; i++) { await page.mouse.move(sx + 70 * (i / 8), sy + 60 * (i / 8), { steps: 1 }); await page.waitForTimeout(15); }
  await page.waitForTimeout(80);
  const during = await snapshot();
  await page.mouse.up();
  const ok = diffCount(before.paths, during.paths) >= 1 && diffCount(before.labels, during.labels) >= 1;
  pass('24h drag still live (regression)', ok, `Δpaths=${diffCount(before.paths, during.paths)} Δlabels=${diffCount(before.labels, during.labels)}`);
} catch (e) { pass('24h drag still live (regression)', false, e.message); }

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
