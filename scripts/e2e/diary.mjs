/**
 * Diary mode: loading a saved day locks editing, hides the live now-line, and
 * writes the synced view cursor; exiting restores everything.
 */
import { makeReporter, launchPage, gotoApp, seedBasicData, loadDiary, exitDiary, isMain, runStandalone } from './_helpers.mjs';

const VIEW_KEY = '24h-circle-planner.view';

export async function run() {
  const { pass, allOk } = makeReporter('diary');
  const { browser, page, errors } = await launchPage();
  try {
    await gotoApp(page);
    const key = await seedBasicData(page);

    const nowLines = () => page.locator('.now-indicator').count();
    pass('now-line visible in normal mode', (await nowLines()) > 0);

    await loadDiary(page, key);
    pass('now-line hidden while viewing a diary', (await nowLines()) === 0);
    pass('view cursor written on diary load',
      (await page.evaluate((k) => localStorage.getItem(k), VIEW_KEY)) === JSON.stringify({ diaryDate: key }));
    pass('diary exit affordance shown', (await page.locator('text=일기 나가기').count()) > 0);

    await exitDiary(page);
    pass('now-line returns after exit', (await nowLines()) > 0);
    pass('view cursor cleared on exit',
      (await page.evaluate((k) => localStorage.getItem(k), VIEW_KEY)) === JSON.stringify({ diaryDate: null }));

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
