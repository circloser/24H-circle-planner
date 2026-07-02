/**
 * Batch 26 verification (offline, dist-single): table export integration +
 * the hide-icons preference applying to the table.
 *  - In table view the inline CSV/이미지 toolbar is gone; 내보내기 shows
 *    이미지 + CSV tabs (chart view still shows PNG + PDF).
 *  - Design → 아이콘 → 숨김 hides the emoji icons in the table too.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1000, height: 1050 } })).newPage();
await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

const toggle = page.locator('button[aria-label*="보기 전환"]').first();
const tabTexts = () => page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map((t) => (t.textContent || '').trim()));
const tableEmoji = () => page.evaluate(() => {
  const ul = [...document.querySelectorAll('ul')].find((u) => u.querySelector('input'));
  return ((ul?.textContent || '').match(/\p{Extended_Pictographic}/gu) || []).length;
});

// → table view (3 toggle clicks).
for (let i = 0; i < 3; i++) { await toggle.click(); await wait(220); }

// ── #1 export integration ──────────────────────────────────────────────────
pass('no inline CSV/이미지 toolbar in the table', (await page.locator('button:has-text("CSV로 저장"), button:has-text("표 이미지로 저장")').count()) === 0);

await page.locator('button[aria-label="내보내기"]').first().click();
await wait(400);
const tt = await tabTexts();
pass('내보내기 shows 이미지 + CSV in table view', tt.includes('이미지') && tt.includes('CSV') && !tt.includes('PNG') && !tt.includes('PDF'), JSON.stringify(tt));
await page.keyboard.press('Escape').catch(() => {});
await wait(250);

// ── #2 hide-icons applies to the table ──────────────────────────────────────
const emBefore = await tableEmoji();
await page.locator('button[aria-label="디자인"]').first().click();
await wait(250);
await page.locator('[role="menuitem"]:has-text("아이콘")').first().click();
await wait(350);
await page.locator('[role="dialog"] button:has-text("숨김")').first().click();
await wait(250);
await page.keyboard.press('Escape').catch(() => {});
await wait(300);
const emAfter = await tableEmoji();
pass('table icons show before hide', emBefore > 0, `before=${emBefore}`);
pass('Design→아이콘→숨김 hides table icons', emAfter === 0, `after=${emAfter}`);

// Re-show → icons return (preference is respected both ways).
await page.locator('button[aria-label="디자인"]').first().click();
await wait(250);
await page.locator('[role="menuitem"]:has-text("아이콘")').first().click();
await wait(350);
await page.locator('[role="dialog"] button:has-text("표시")').first().click();
await wait(250);
await page.keyboard.press('Escape').catch(() => {});
await wait(300);
pass('re-show restores table icons', (await tableEmoji()) > 0);

// ── chart view still exports PNG/PDF ─────────────────────────────────────────
for (let i = 0; i < 5; i++) { const lbl = await toggle.textContent(); if ((lbl || '').includes('24')) break; await toggle.click(); await wait(220); }
await page.locator('button[aria-label="내보내기"]').first().click();
await wait(400);
const tt2 = await tabTexts();
pass('내보내기 shows PNG + PDF in chart view', tt2.includes('PNG') && tt2.includes('PDF'), JSON.stringify(tt2));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
