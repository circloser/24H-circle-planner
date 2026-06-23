/**
 * Batch 15 verification (offline, dist-single): mobile layout.
 *  - Mobile (<768px): floating memo/clock FABs are gone; chart top-aligned;
 *    memos render as an editable grid; clock tools render INLINE in a section
 *    (not fixed over the chart); slice editing still works on touch (tap).
 *  - Desktop (1280px): unchanged — floating FABs present, no <main> sections.
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

  // 1. No floating FABs on mobile.
  const noFabs = await page.evaluate(() =>
    !document.querySelector('button.fixed[aria-label="메모 추가"]') &&
    !document.querySelector('button.fixed[aria-label="시계 도구"]'));
  pass('mobile: floating FABs removed', noFabs);

  // 2. Mobile sections live inside <main>.
  const sections = await page.locator('main section').count();
  pass('mobile: stacked sections in <main>', sections >= 2, `sections=${sections}`);

  // 3. Memo grid: add → an editable card (textarea) appears.
  const before = await page.locator('main section textarea').count();
  await page.getByRole('button', { name: '메모 추가' }).first().click();
  await wait(250);
  const after = await page.locator('main section textarea').count();
  pass('mobile: memo grid add', after === before + 1, `${before}→${after}`);

  // 4. Clock tools render INLINE (analog clock inside a section, NOT position:fixed).
  await page.getByRole('button', { name: '시계', exact: true }).first().click();
  await wait(300);
  const inlineClock = await page.evaluate(() => {
    const svgs = Array.from(document.querySelectorAll('main section svg'));
    if (svgs.length === 0) return false;
    // None of the clock-tool cards may be position:fixed (that would mean it
    // floated over the chart instead of stacking inline).
    const fixed = Array.from(document.querySelectorAll('main section *')).some((el) => {
      const cs = getComputedStyle(el);
      return cs.position === 'fixed';
    });
    return svgs.length > 0 && !fixed;
  });
  pass('mobile: clock tool renders inline (not fixed)', inlineClock);

  // 5. Editing still works on touch: tapping a slice opens the editor.
  await page.locator('svg[role="img"] [data-slice-id]').first().click();
  await wait(350);
  const editorOpen = await page.evaluate(() =>
    !!document.querySelector('.slice-path--selected') ||
    !!document.querySelector('[role="dialog"]'));
  pass('mobile: tap-to-edit still works', editorOpen);

  await ctx.close();
}

// ── Desktop (regression) ─────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
  await loadPreset(page);
  const ok = await page.evaluate(() =>
    !!document.querySelector('button.fixed[aria-label="메모 추가"]') &&
    !!document.querySelector('button.fixed[aria-label="시계 도구"]') &&
    document.querySelectorAll('main section').length === 0);
  pass('desktop: unchanged (floating FABs, no sections)', ok);
  await ctx.close();
}

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
