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

    // Hub title: clearing the name falls back to today's date (seed name was
    // '테스트 하루'). Regression: an empty save used to be dropped, so the old
    // name lingered.
    {
      const hubText = () => page.evaluate(() =>
        [...document.querySelectorAll('svg[role="img"] text')].map((t) => t.textContent.trim()));
      pass('hub shows the schedule name', (await hubText()).includes('테스트 하루'));

      await page.locator('svg[role="img"] circle.glass-hub-disc').first().click();
      await wait(300);
      const editor = page.locator('div[aria-label="시간표 제목 편집"]');
      pass('hub title editor opens', await editor.isVisible().catch(() => false));
      await editor.locator('input').fill('');
      await page.keyboard.press('Enter');
      await wait(400);

      const after = await hubText();
      const expectedDate = await page.evaluate(() =>
        new Date().toLocaleDateString('ko', { weekday: 'short', month: 'short', day: 'numeric' }));
      pass('cleared title removes the old name', !after.includes('테스트 하루'), after.join('|'));
      pass('cleared title shows today’s date', after.some((s) => s.includes(expectedDate)), `expected=${expectedDate} got=${after.join('|')}`);
    }

    // In-app slice-start popup: fires on the window event, sits above the app,
    // auto-dismisses after ~5s. (The alarm hook dispatches this on a boundary.)
    {
      await page.evaluate(() =>
        window.dispatchEvent(new CustomEvent('slice-alarm', { detail: { title: '수면알림', body: '00:00–08:00' } })));
      await wait(250);
      const popup = page.locator('[data-slice-alarm]');
      pass('slice-alarm popup appears', (await popup.count()) > 0);
      pass('slice-alarm popup shows the block', ((await popup.innerText().catch(() => '')) || '').includes('수면알림'));
      await wait(5200);
      pass('slice-alarm popup auto-dismisses (~5s)', (await page.locator('[data-slice-alarm]').count()) === 0);
    }

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
