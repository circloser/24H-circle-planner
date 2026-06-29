/**
 * Batch 29 verification (offline, dist-single): Pro-sync Google login UI.
 *  - With no Worker answering /api/me (file://), useAuth resolves to signed-out.
 *  - The gear (설정) menu then shows the "구글로 로그인" item, and NOT a logout
 *    item, and the rest of the menu (언어/language) is intact (no crash).
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });

const page = await (await browser.newContext({ viewport: { width: 1000, height: 1050 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(600); // let useAuth's /api/me fetch settle to signed-out

// Open the gear (설정) menu.
await page.locator('button[aria-label="설정"]').first().click();
await wait(300);

const loginVisible = await page.locator('[role="menuitem"]:has-text("구글로 로그인")').first().isVisible().catch(() => false);
pass('signed-out: "구글로 로그인" item shown', loginVisible);

const logoutCount = await page.locator('[role="menuitem"]:has-text("로그아웃")').count();
pass('signed-out: no "로그아웃" item', logoutCount === 0, `count=${logoutCount}`);

const langVisible = await page.locator('[role="menuitem"]:has-text("언어")').first().isVisible().catch(() => false);
pass('menu intact (언어 item present)', langVisible);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
