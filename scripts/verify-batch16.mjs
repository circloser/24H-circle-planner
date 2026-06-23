/**
 * Batch 16 verification (offline, dist-single): mobile editing refinements.
 *  #1 Mobile chart has NO drag handles; "+ 일정 추가" form creates a block (line).
 *  #2 Mobile memos are uniform yellow, no colour picker, no textarea scrollbar.
 *  #3 Mobile clock tools omit timer + alarm (desktop keeps them).
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });

async function loadPreset(page) {
  let card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
  if (!(await card.isVisible({ timeout: 2500 }).catch(() => false))) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.locator('button:has-text("프리셋")').first().click().catch(() => {});
    await wait(300);
    card = page.locator('button.glass-card:has(h3:has-text("직장인"))').first();
  }
  await card.click().catch(() => {});
  await page.locator('button:has-text("현재 창에 적용")').first().click().catch(() => {});
  await wait(600);
}

// ── Mobile ───────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
  await loadPreset(page);

  // #1a — no drag handles on the chart.
  const sliders = await page.locator('svg[role="img"] [role="slider"]').count();
  pass('#1 mobile chart has no drag handles', sliders === 0, `sliders=${sliders}`);

  // #3 — clock tools = exactly 시계/캘린더/날씨 (no 타이머/알람).
  const chipLabels = await page.evaluate(() =>
    Array.from(document.querySelectorAll('section button[aria-pressed]')).map((b) => b.textContent.trim()));
  const okChips = chipLabels.length === 3 && ['시계', '캘린더', '날씨'].every((l) => chipLabels.some((c) => c.includes(l)));
  pass('#3 mobile clock omits timer + alarm', okChips, JSON.stringify(chipLabels));

  // #2 — add a memo; it is yellow, no colour swatches, textarea not scrollable.
  await page.getByRole('button', { name: '메모 추가' }).first().click();
  await wait(250);
  const memo = await page.evaluate(() => {
    const ta = document.querySelector('section textarea');
    if (!ta) return null;
    const card = ta.closest('div');
    const bg = getComputedStyle(card).backgroundColor;
    const overflow = getComputedStyle(ta).overflowY;
    const fontPx = getComputedStyle(ta).fontSize;
    const swatches = document.querySelectorAll('section [aria-label^="#"]').length;
    return { bg, overflow, fontPx, swatches };
  });
  // #fef08a → rgb(254, 240, 138)
  const yellow = memo && memo.bg.replace(/\s/g, '') === 'rgb(254,240,138)';
  pass('#2 memo card is yellow', yellow, memo?.bg);
  pass('#2 memo has no colour swatches', memo?.swatches === 0, `swatches=${memo?.swatches}`);
  pass('#2 memo textarea has no scrollbar', memo?.overflow === 'hidden', `overflowY=${memo?.overflow}`);
  pass('#2 memo text is 14px (desktop level)', memo?.fontPx === '14px', memo?.fontPx);

  // #1b — the + 일정 추가 form draws a block.
  const sliceBefore = await page.locator('svg[role="img"] path[data-slice-id]').count();
  await page.locator('main button:has-text("일정 추가")').first().click();
  await wait(350);
  const times = page.locator('[role="dialog"] input[type="time"]');
  await times.nth(0).fill('13:00');
  await times.nth(1).fill('15:00');
  await page.locator('[role="dialog"] input:not([type="time"])').first().fill('블록테스트');
  await page.locator('[role="dialog"] button:has-text("일정 추가")').first().click();
  await wait(500);
  const sliceAfter = await page.locator('svg[role="img"] path[data-slice-id]').count();
  const hasBlock = await page.evaluate(() =>
    Array.from(document.querySelectorAll('svg[role="img"] g[data-label-id]')).some((g) => (g.textContent || '').includes('블록테스트')));
  pass('#1 + form draws a block', sliceAfter === sliceBefore + 1 && hasBlock, `${sliceBefore}→${sliceAfter}, labelled=${hasBlock}`);

  await ctx.close();
}

// ── Desktop (regression) ─────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
  await loadPreset(page);
  // Drag handles still present on desktop.
  const sliders = await page.locator('svg[role="img"] [role="slider"]').count();
  pass('desktop: drag handles present', sliders > 0, `sliders=${sliders}`);
  // No mobile + 일정 추가 button.
  const noAddBtn = (await page.locator('main button:has-text("일정 추가")').count()) === 0;
  pass('desktop: no mobile + button', noAddBtn);
  // Desktop clock tools still include timer + alarm.
  await page.locator('button[aria-label="시계 도구"]').first().click();
  await wait(300);
  const menu = await page.evaluate(() => document.body.textContent || '');
  pass('desktop: clock tools keep timer + alarm', menu.includes('타이머') && menu.includes('알람'));
  await ctx.close();
}

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
