/** Settings → Background: no gradient pattern chip; direction picker sets angle. */
import { makeReporter, launchPage, gotoApp, seedBasicData, wait, isMain, runStandalone } from './_helpers.mjs';

export async function run() {
  const { pass, allOk } = makeReporter('settings');
  const { browser, page, errors } = await launchPage();
  try {
    await gotoApp(page);
    await seedBasicData(page);

    await page.locator('button[aria-label="디자인"]').first().click();
    await wait(200);
    await page.locator('[role="menuitem"]:has-text("배경")').first().click();
    await wait(400);

    // The gradient PATTERN chip is gone (the dedicated gradient section covers it).
    pass('no "그라데이션" pattern button', (await page.locator('button:has-text("그라데이션")').count()) === 0);

    // Direction picker sets prefs.gradient.angle and applies the CSS live.
    pass('direction picker rendered', (await page.locator('button[aria-label="90°"]').count()) > 0);
    await page.locator('button[aria-label="90°"]').first().click();
    await wait(250);
    const grad = await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('24h-circle-planner.prefs')).prefs;
      const root = document.documentElement;
      return { angle: p.gradient?.angle, bgType: p.bgType, dataBg: root.getAttribute('data-bg'), css: root.style.getPropertyValue('--app-bg-gradient') };
    });
    pass('90° persisted + gradient mode', grad.angle === 90 && grad.bgType === 'gradient', `angle=${grad.angle}`);
    pass('gradient CSS applied', grad.dataBg === 'gradient-fill' && grad.css.includes('90deg'), grad.css);

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
