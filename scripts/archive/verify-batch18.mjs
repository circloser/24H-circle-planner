/**
 * Batch 18 verification (offline, dist-single): preset/template share links.
 *  - Opening a #p=… link shows a confirm dialog; confirming loads the encoded
 *    schedule and clears the fragment.
 *  - "링크 복사" copies a https://24houring.com/#p=… URL to the clipboard.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const code = b64url(JSON.stringify({ v: 1, n: '공유테스트', s: [[0, '수면', '#c7d2fe', '😴'], [420, '오전', '#bfdbfe', '💻'], [720, '점심', '#fde68a', '🍚'], [780, '오후', '#a7f3d0', '📊']] }));

const browser = await chromium.launch({ headless: true });

// ── A. Import a shared link ───────────────────────────────────────────────────
{
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  await page.goto(FILE + '#p=' + code, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
  await wait(700);
  const dialogShown = await page.locator('[role="dialog"]:has-text("공유된 시간표")').first().isVisible().catch(() => false);
  pass('A share link shows import confirm', dialogShown);
  await page.locator('[role="dialog"] button:has-text("불러오기")').first().click().catch(() => {});
  await wait(500);
  const info = await page.evaluate(() => ({
    slices: document.querySelectorAll('svg[role="img"] path[data-slice-id]').length,
    hasSleep: [...document.querySelectorAll('svg[role="img"] g[data-label-id]')].some((g) => (g.textContent || '').includes('수면')),
    hash: location.hash,
  }));
  pass('A confirm loads the encoded schedule', info.slices === 4 && info.hasSleep, JSON.stringify(info));
  pass('A fragment cleared after import', info.hash === '');
}

// ── B. Copy link ──────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('button[aria-label="설정"]').first().click();
  await wait(300);
  await page.locator('[role="menuitem"]:has-text("링크 복사")').first().click();
  await wait(400);
  const toast = await page.locator('text=복사').first().isVisible().catch(() => false);
  let clip = '';
  try { clip = await page.evaluate(() => navigator.clipboard.readText()); } catch { /* unreadable */ }
  pass('B copy shows success toast', toast);
  pass('B clipboard holds a 24houring share URL', /^https:\/\/24houring\.com\/#p=/.test(clip), clip.slice(0, 36));
  await ctx.close();
}

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
