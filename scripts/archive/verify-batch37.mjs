/**
 * Batch 37 (offline, dist-single): a diary can be saved for ANY date, including
 * future ones (24Houring is also a planner — a future date = a pre-plan).
 *  - Next month (all future): cells are NOT dimmed; clicking one opens the
 *    save-confirm (savable).
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
await wait(400);

// Open the diary.
await page.locator('button[aria-label="내 시간표"]').first().click();
await wait(200);
await page.locator('[role="menuitem"]:has-text("일기")').first().click();
await wait(400);

// Next month → every day is in the future.
await page.locator('[role="dialog"] button[aria-label="next"]').first().click();
await wait(300);

const dimmed = await page.locator('[role="dialog"] .grid button[class*="opacity-35"]').count();
pass('future-month cells are NOT dimmed', dimmed === 0, `dimmed=${dimmed}`);

// Click a future day → the save-confirm opens (future is savable).
await page.locator('[role="dialog"] .grid button:has-text("15")').first().click();
await wait(300);
const confirm = await page.getByRole('button', { name: '저장', exact: true }).count();
pass('future date opens the save-confirm (savable)', confirm >= 1, `confirmBtns=${confirm}`);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
