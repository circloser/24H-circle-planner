/**
 * Batch 28 verification (offline, dist-single): no-backend QR device transfer.
 *  - Gear → "다른 기기로 (QR)" shows a scannable QR + the share link for the
 *    current timetable.
 *  - End-to-end: modify device A's schedule, take its link's code, open it on a
 *    fresh "device B" → the share-import confirm restores the SAME schedule.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });

// ── Device A: edit (delete a row → 6 slices), then open the transfer QR ───────
const a = await (await browser.newContext({ viewport: { width: 1000, height: 1050 } })).newPage();
await a.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await a.waitForSelector('svg[role="img"]', { timeout: 15000 });
await a.keyboard.press('Escape').catch(() => {});
await wait(400);

// To table, delete one row (immediate) → 6 slices.
const toggle = a.locator('button[aria-label*="보기 전환"]').first();
for (let i = 0; i < 3; i++) { await toggle.click(); await wait(220); }
await a.locator('button[aria-label="삭제"]').nth(0).click();
await wait(300);
const aCount = await a.evaluate(() => JSON.parse(localStorage.getItem('24h-circle-planner.days')).days[0].schedule.slices.length);
pass('device A edited (row deleted)', aCount === 6, `slices=${aCount}`);

// Open gear → 다른 기기로 (QR).
await a.locator('button[aria-label="설정"]').first().click();
await wait(250);
await a.locator('[role="menuitem"]:has-text("다른 기기로")').first().click();
await wait(400);

const qr = await a.evaluate(() => {
  const svg = document.querySelector('svg[aria-label="QR"]');
  const path = svg ? svg.querySelector('path') : null;
  const input = [...document.querySelectorAll('[role="dialog"] input')].find((i) => (i.value || '').includes('#p='));
  return { dLen: path ? (path.getAttribute('d') || '').length : 0, link: input ? input.value : '' };
});
pass('QR rendered with modules', qr.dLen > 200, `dLen=${qr.dLen}`);
pass('transfer link is a share URL', qr.link.startsWith('https://24houring.com/#p='), qr.link.slice(0, 40));

const code = qr.link.split('#p=')[1] || '';

// ── Device B: fresh, open the link → import confirm → restores 6 slices ───────
const b = await (await browser.newContext({ viewport: { width: 1000, height: 1050 } })).newPage();
await b.goto(`${FILE}#p=${code}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await b.waitForSelector('svg[role="img"]', { timeout: 15000 });
await wait(500);
const importVisible = await b.locator('[role="dialog"]:has-text("불러오기")').first().isVisible().catch(() => false);
pass('device B shows the import confirm', importVisible);
await b.getByRole('button', { name: '불러오기', exact: true }).first().click().catch(() => {});
await wait(500);
const bCount = await b.locator('svg[role="img"] path[data-slice-id]').count();
pass('device B imported the same schedule (6 slices)', bCount === 6, `slices=${bCount}`);

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
