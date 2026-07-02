/** Smoke: the app boots, the chart renders, core chrome is present. */
import { makeReporter, launchPage, gotoApp, seedBasicData, wait, isMain, runStandalone } from './_helpers.mjs';

export async function run() {
  const { pass, allOk } = makeReporter('smoke');
  const { browser, page, errors } = await launchPage();
  try {
    await gotoApp(page);
    await seedBasicData(page);

    pass('chart renders', await page.locator('svg[role="img"]').first().isVisible().catch(() => false));
    pass('header export button present', (await page.locator('button[aria-label="내보내기"]').count()) > 0);
    pass('design menu present', (await page.locator('button[aria-label="디자인"]').count()) > 0);

    // Export dialog opens and closes.
    await page.locator('button[aria-label="내보내기"]').first().click();
    await wait(400);
    pass('export dialog opens', (await page.locator('[role="dialog"]').count()) > 0);
    await page.keyboard.press('Escape');
    await wait(300);

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
