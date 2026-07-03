/**
 * Multi-window weather: the FAB menu / mobile chip ADD a window per click
 * (one per city), each window closes individually, and open windows persist.
 * New windows have no place set → no network fetch, so this runs offline.
 */
import { makeReporter, launchPage, gotoApp, seedBasicData, wait, isMain, runStandalone } from './_helpers.mjs';

export async function run() {
  const { pass, allOk } = makeReporter('weather');

  // ── Desktop: FAB menu adds windows; each closes on its own; persists. ──
  {
    const { browser, page, errors } = await launchPage();
    try {
      await gotoApp(page);
      await seedBasicData(page);

      await page.locator('button[aria-label="시계 도구"]').first().click();
      await wait(200);
      const addBtn = page.locator('button[aria-label="날씨 창 추가"]').first();
      pass('desktop: weather row present in FAB menu', (await addBtn.count()) > 0);

      await addBtn.click();
      await wait(150);
      await addBtn.click();
      await wait(150);
      await addBtn.click();
      await wait(200);
      pass('desktop: three windows open', (await page.locator('[data-weather-widget]').count()) === 3);

      // Windows cascade — no two share the same position.
      const boxes = await page.locator('[data-weather-widget]').evaluateAll((els) =>
        els.map((el) => `${el.getBoundingClientRect().x},${el.getBoundingClientRect().y}`),
      );
      pass('desktop: windows cascade (distinct positions)', new Set(boxes).size === 3);

      // Close ONE window (its hover-revealed ✕) — the other two stay. Cascaded
      // siblings overlap this window's centre, so hover its top-left corner
      // (always uncovered); hovering raises it above the stack (hover:z-[26]).
      const second = page.locator('[data-weather-widget]').nth(1);
      await second.hover({ position: { x: 12, y: 12 } });
      await wait(200);
      await second.locator('button[aria-label="닫기"]').click();
      await wait(200);
      pass('desktop: closing one leaves the others', (await page.locator('[data-weather-widget]').count()) === 2);

      // Reload → the two open windows persist.
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
      await page.keyboard.press('Escape').catch(() => {});
      await wait(400);
      pass('desktop: open windows persist across reload', (await page.locator('[data-weather-widget]').count()) === 2);

      pass('desktop: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    } finally {
      await browser.close();
    }
  }

  // ── Mobile: the chip adds inline cards; each card closes on its own. ──
  {
    const { browser, page, errors } = await launchPage({ viewport: { width: 375, height: 812 } });
    try {
      await gotoApp(page);
      await seedBasicData(page);

      const chip = page.locator('button[aria-label="날씨 창 추가"]').first();
      await chip.scrollIntoViewIfNeeded();
      pass('mobile: weather add chip present', (await chip.count()) > 0);

      await chip.click();
      await wait(150);
      await chip.click();
      await wait(200);
      pass('mobile: two inline cards', (await page.locator('[data-weather-widget]').count()) === 2);
      pass('mobile: chip shows count 2', (await chip.locator('text=2').count()) > 0);

      // Inline cards show their controls without hover.
      await page.locator('[data-weather-widget]').first().locator('button[aria-label="닫기"]').click();
      await wait(200);
      pass('mobile: closing one card leaves the other', (await page.locator('[data-weather-widget]').count()) === 1);

      pass('mobile: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    } finally {
      await browser.close();
    }
  }

  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
