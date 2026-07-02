/** Goals widget: "목표" labels, no diary hint, background only on real hover. */
import { makeReporter, launchPage, gotoApp, seedBasicData, wait, isMain, runStandalone } from './_helpers.mjs';

export async function run() {
  const { pass, allOk } = makeReporter('goals');
  const { browser, page, errors } = await launchPage({ viewport: { width: 1100, height: 1000 } });
  try {
    await gotoApp(page);
    await seedBasicData(page);
    await page.evaluate(() => {
      localStorage.setItem('24h-circle-planner.goals', JSON.stringify({ version: 1, goals: [{ id: 'g1', label: '수면', targetMinutes: 60, period: 'day' }] }));
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
    await page.keyboard.press('Escape').catch(() => {});
    await wait(400);

    pass('goals FAB labelled "목표"', await page.locator('button[aria-label="목표"]').first().isVisible().catch(() => false));
    await page.locator('button[aria-label="목표"]').first().click();
    await wait(300);

    const card = page.locator('[data-goals-card="1"]').first();
    const title = ((await card.locator('span').first().textContent()) || '').trim();
    pass('goals card title is "목표"', title === '목표', `title=${title}`);
    pass('diary hint removed', !(await card.locator('text=오늘 일기').count()));

    const bgOpen = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    pass('transparent right after opening', bgOpen === 'rgba(0, 0, 0, 0)' || bgOpen === 'transparent', `bg=${bgOpen}`);

    await card.hover();
    await page.mouse.move(820, 600);
    await page.mouse.move(830, 610); // real movement → pointermove fires
    await wait(150);
    const bgHover = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    pass('background appears on hover', bgHover !== 'rgba(0, 0, 0, 0)' && bgHover !== 'transparent', `bg=${bgHover}`);

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
