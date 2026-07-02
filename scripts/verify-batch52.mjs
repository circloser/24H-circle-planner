/**
 * Batch 52 (offline, dist-single): PNG export resolution actually changes the
 * output pixel dimensions (regression: inline width/height:100% overrode the
 * width/height attributes so every resolution rasterized at the same size).
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Read width/height from a PNG's IHDR (bytes 16-23, big-endian). */
function pngSize(path) {
  const b = readFileSync(path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1100, height: 1000 }, acceptDownloads: true })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(300);
await page.evaluate(() => {
  const slices = [
    { id: 'a', label: '수면', startTime: '00:00', endTime: '08:00', color: '#a78bfa', icon: '', textPosition: 'inside' },
    { id: 'b', label: '일', startTime: '08:00', endTime: '24:00', color: '#f472b6', icon: '', textPosition: 'inside' },
  ];
  const day = { id: 'd1', schedule: { id: 's', version: 1, name: '내 하루', presetSource: null, updatedAt: '2026-07-01T00:00:00.000Z', slices } };
  localStorage.setItem('24h-circle-planner.days', JSON.stringify({ version: 1, activeId: 'd1', days: [day] }));
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

async function exportAt(label) {
  await page.locator('button[aria-label="내보내기"]').first().click();
  await wait(400);
  // PNG tab is the default for the chart view; select the resolution.
  await page.locator(`[role="dialog"] button:has-text("${label}")`).first().click();
  await wait(150);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('[role="dialog"] button:has-text("PNG 내보내기")').first().click(),
  ]);
  const path = await download.path();
  const size = pngSize(path);
  await page.keyboard.press('Escape').catch(() => {});
  await wait(300);
  return size;
}

const small = await exportAt('1080px');
pass('1080px export is 1080×1080', small.w === 1080 && small.h === 1080, JSON.stringify(small));

const big = await exportAt('4K (3840px)');
pass('4K export is 3840×3840', big.w === 3840 && big.h === 3840, JSON.stringify(big));

pass('resolution actually changes output size', small.w !== big.w, `${small.w} vs ${big.w}`);
pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
