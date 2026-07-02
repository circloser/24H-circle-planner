/**
 * Batch 55 (offline, dist-single): background/gradient + export resolution.
 *  1) no "그라데이션" chip in the pattern row (redundant with the gradient section)
 *  2) gradient DIRECTION picker sets the angle (prefs + --app-bg-gradient)
 *  3) PNG resolution selection reflects visually AND changes the exported pixels
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const OUT = 'C:/Users/singl/AppData/Local/Temp/claude/C--vibecoding-24h/747b1874-9ae1-4be1-beb0-fd4b5a2f840c/scratchpad';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pngDims = (p) => { const b = readFileSync(p); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(300);
await page.evaluate(() => {
  const slices = [
    { id: 'a', label: '수면', startTime: '00:00', endTime: '08:00', color: '#a78bfa', icon: '', textPosition: 'inside' },
    { id: 'b', label: '일', startTime: '08:00', endTime: '18:00', color: '#60a5fa', icon: '', textPosition: 'inside' },
    { id: 'c', label: '휴식', startTime: '18:00', endTime: '24:00', color: '#34d399', icon: '', textPosition: 'inside' },
  ];
  const day = { id: 'd1', schedule: { id: 's', version: 1, name: '내 하루', presetSource: null, updatedAt: '2026-07-01T00:00:00.000Z', slices } };
  localStorage.setItem('24h-circle-planner.days', JSON.stringify({ version: 1, activeId: 'd1', days: [day] }));
  localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs: { language: 'ko' } }));
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

// ── Open Design → Background ──
await page.locator('button[aria-label="디자인"]').first().click();
await wait(200);
await page.locator('[role="menuitem"]:has-text("배경")').first().click();
await wait(400);

// Task 1: no "그라데이션" PATTERN chip (the section header is a <span>, not a button).
pass('no "그라데이션" pattern button', (await page.locator('button:has-text("그라데이션")').count()) === 0);

// Task 2: direction picker present + sets the gradient angle live.
pass('direction picker rendered', (await page.locator('button[aria-label="90°"]').count()) > 0);
await page.locator('button[aria-label="90°"]').first().click();
await wait(250);
const grad = await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('24h-circle-planner.prefs')).prefs;
  const root = document.documentElement;
  return { angle: p.gradient?.angle, bgType: p.bgType, dataBg: root.getAttribute('data-bg'), css: root.style.getPropertyValue('--app-bg-gradient') };
});
pass('direction 90° persisted to prefs', grad.angle === 90 && grad.bgType === 'gradient', `angle=${grad.angle} bgType=${grad.bgType}`);
pass('gradient applied to background', grad.dataBg === 'gradient-fill' && grad.css.includes('90deg'), `data-bg=${grad.dataBg} css=${grad.css}`);
// press another direction to confirm it re-updates
await page.locator('button[aria-label="225°"]').first().click();
await wait(200);
const angle2 = await page.evaluate(() => JSON.parse(localStorage.getItem('24h-circle-planner.prefs')).prefs.gradient.angle);
pass('direction re-updates (225°)', angle2 === 225, `angle=${angle2}`);
await page.keyboard.press('Escape').catch(() => {});
await wait(300);

// ── Open Export → PNG ──
await page.locator('button[aria-label="내보내기"]').first().click();
await wait(400);
const b1080 = page.locator('button:has-text("1080px")').first();
const b4k = page.locator('button:has-text("4K (3840px)")').first();
pass('resolution buttons present (1080 + 4K)', (await b1080.count()) > 0 && (await b4k.count()) > 0 && (await page.locator('button:has-text("2K (2160px)")').count()) > 0);

// Task 3a: selection is visible (aria-pressed reflects the choice).
await b4k.click();
await wait(120);
const p4k = await b4k.getAttribute('aria-pressed');
const p1080a = await b1080.getAttribute('aria-pressed');
pass('clicking 4K selects it (aria-pressed)', p4k === 'true' && p1080a === 'false', `4k=${p4k} 1080=${p1080a}`);
await b1080.click();
await wait(120);
pass('clicking 1080 selects it', (await b1080.getAttribute('aria-pressed')) === 'true');

// Task 3b: the exported PNG actually changes pixel size with the selection.
const exportBtn = page.locator('button:has-text("PNG 내보내기")').first();
await b1080.click();
await wait(120);
const [dl1] = await Promise.all([page.waitForEvent('download'), exportBtn.click()]);
const p1 = `${OUT}/res-1080.png`;
await dl1.saveAs(p1);
const d1 = pngDims(p1);
pass('1080 export is 1080×1080', d1.w === 1080 && d1.h === 1080, `${d1.w}x${d1.h}`);

await b4k.click();
await wait(120);
const [dl2] = await Promise.all([page.waitForEvent('download'), exportBtn.click()]);
const p2 = `${OUT}/res-4k.png`;
await dl2.saveAs(p2);
const d2 = pngDims(p2);
pass('4K export is 3840×3840', d2.w === 3840 && d2.h === 3840, `${d2.w}x${d2.h}`);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
