/**
 * Multi-clock (world clock) windows: the FAB menu / mobile chip ADD a clock per
 * click, each clock takes its own timezone, closes individually, and persists.
 * Also covers this batch's edit-mode undo button (same desktop session).
 */
import { makeReporter, launchPage, gotoApp, seedBasicData, wait, isMain, runStandalone } from './_helpers.mjs';

export async function run() {
  const { pass, allOk } = makeReporter('clocks');

  // ── Desktop: add clocks, set a timezone, close one, persist; undo button. ──
  {
    const { browser, page, errors } = await launchPage();
    try {
      await gotoApp(page);
      await seedBasicData(page);

      // One default (local) clock is on for first-time visitors.
      const count = () => page.locator('[data-clock-widget]').count();
      const base = await count();

      await page.locator('button[aria-label="시계 도구"]').first().click();
      await wait(200);
      const addBtn = page.locator('button[aria-label="시계 추가"]').first();
      pass('desktop: clock add row present', (await addBtn.count()) > 0);

      await addBtn.click();
      await wait(150);
      await addBtn.click();
      await wait(200);
      pass('desktop: two clocks added', (await count()) === base + 2, `count=${await count()} base=${base}`);

      // Close the FAB menu — its full-screen backdrop would otherwise swallow
      // the widget hovers below. A bare click anywhere lands on the backdrop.
      await page.mouse.click(640, 120);
      await wait(200);

      // Set a timezone on the LAST clock (topmost) → its city label appears.
      const last = page.locator('[data-clock-widget]').last();
      await last.hover({ position: { x: 12, y: 12 } });
      await wait(200);
      await last.locator('select[aria-label="시간대"]').selectOption('Asia/Tokyo');
      await wait(300);
      pass('desktop: timezone label shows on that clock', (await last.locator('text=도쿄').count()) > 0);

      // Close the last clock — the others stay.
      await last.hover({ position: { x: 12, y: 12 } });
      await wait(200);
      await last.locator('button[aria-label="닫기"]').click();
      await wait(200);
      pass('desktop: closing one leaves the others', (await count()) === base + 1);

      // Reload → open clocks persist.
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
      await page.keyboard.press('Escape').catch(() => {});
      await wait(400);
      pass('desktop: clocks persist across reload', (await count()) === base + 1);

      // ── Undo button (편집 모드 pill): disabled → enabled after an edit → undoes. ──
      const undoBtn = page.locator('button[aria-label="되돌리기"]').first();
      pass('undo button present in edit-mode pill', (await undoBtn.count()) > 0);
      pass('undo disabled with empty history', await undoBtn.isDisabled());
      // Make an edit: a cut-mode click on a slice BODY splits it (a real
      // undoable mutation). Aim the 06:00 direction at a small radius — inside
      // the seeded 수면(00–08h) wedge, well below its label hit-circle (~04:00
      // at r≈298) and 30° away from the nearest boundary strip.
      const chart = page.locator('svg[role="img"]').first();
      const box = await chart.boundingBox();
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.69);
      await wait(300);
      await page.keyboard.press('Escape').catch(() => {}); // close an editor if one opened instead
      const sliceCountAfterSplit = await page.locator('path.slice-path').count();
      pass('a split created an undoable edit', !(await undoBtn.isDisabled()));
      await undoBtn.click();
      await wait(300);
      pass('undo restores the pre-split slice count', (await page.locator('path.slice-path').count()) === sliceCountAfterSplit - 1);

      pass('desktop: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    } finally {
      await browser.close();
    }
  }

  // ── Mobile: the chip adds inline clock cards; timezone select always visible. ──
  {
    const { browser, page, errors } = await launchPage({ viewport: { width: 375, height: 812 } });
    try {
      await gotoApp(page);
      await seedBasicData(page);

      const chip = page.locator('button[aria-label="시계 추가"]').first();
      await chip.scrollIntoViewIfNeeded();
      pass('mobile: clock add chip present', (await chip.count()) > 0);

      const base = await page.locator('[data-clock-widget]').count();
      await chip.click();
      await wait(200);
      pass('mobile: a clock card added', (await page.locator('[data-clock-widget]').count()) === base + 1);

      const lastCard = page.locator('[data-clock-widget]').last();
      await lastCard.locator('select[aria-label="시간대"]').selectOption('Europe/London');
      await wait(300);
      pass('mobile: timezone label shows', (await lastCard.locator('text=런던').count()) > 0);

      await lastCard.locator('button[aria-label="닫기"]').click();
      await wait(200);
      pass('mobile: closing the card works', (await page.locator('[data-clock-widget]').count()) === base);

      pass('mobile: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    } finally {
      await browser.close();
    }
  }

  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
