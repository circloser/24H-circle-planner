/**
 * Batch 43 (offline, dist-single): deleting a divider preferentially removes the
 * UNLABELED adjacent slice, keeping the labeled block — even when the empty side
 * is WIDER. Seeds [집중 00–04 | (empty) 04–14 | 일 14–24], hovers the 04:00
 * boundary, clicks the "−" merge affordance, and asserts 집중 survives 00–14.
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

await page.evaluate(() => {
  const slices = [
    { id: 'focus', label: '집중', startTime: '00:00', endTime: '04:00', color: '#a78bfa', icon: '', textPosition: 'inside' }, // labeled, 4h (narrower)
    { id: 'empty', label: '', startTime: '04:00', endTime: '14:00', color: '#e5e7eb', icon: '', textPosition: 'inside' },      // EMPTY, 10h (WIDER)
    { id: 'work', label: '일', startTime: '14:00', endTime: '24:00', color: '#f472b6', icon: '', textPosition: 'inside' },
  ];
  const day = { id: 'd1', schedule: { id: 's', version: 1, name: '테스트', presetSource: null, updatedAt: '2026-07-01T00:00:00.000Z', slices } };
  localStorage.setItem('24h-circle-planner.days', JSON.stringify({ version: 1, activeId: 'd1', days: [day] }));
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(500);

// Hover the 04:00 boundary (end of slice index 0) to reveal its affordances, then
// click the "−" merge button.
await page.locator('[data-boundary-index="0"]').first().hover({ force: true });
await wait(300);
const minus = page.locator('[aria-label="이 경계 일정 병합"]').first();
await minus.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
await minus.click({ force: true });
await wait(500);

const after = await page.evaluate(() => {
  let slices = [];
  try {
    const env = JSON.parse(localStorage.getItem('24h-circle-planner.days'));
    const day = env.days.find((d) => d.id === env.activeId) || env.days[0];
    slices = day.schedule.slices;
  } catch { /* ignore */ }
  const merged = slices.find((s) => s.startTime === '00:00' && s.endTime === '14:00');
  return {
    count: slices.length,
    labels: slices.map((s) => `${s.label || '∅'}:${s.startTime}-${s.endTime}`),
    mergedLabel: merged ? merged.label : null,
    mergedId: merged ? merged.id : null,
  };
});

pass('divider deleted → slice count 3 → 2', after.count === 2, `count=${after.count} ${JSON.stringify(after.labels)}`);
pass('labeled block (집중) survived, empty side removed', after.mergedLabel === '집중', `mergedLabel=${after.mergedLabel}`);
pass('merged slice keeps the labeled slice id', after.mergedId === 'focus', `id=${after.mergedId}`);
pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
