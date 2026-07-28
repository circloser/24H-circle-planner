/**
 * Diary mode: loading a saved day locks editing, hides the live now-line, and
 * writes the synced view cursor; exiting restores everything.
 */
import { makeReporter, launchPage, gotoApp, seedBasicData, loadDiary, exitDiary, wait, isMain, runStandalone } from './_helpers.mjs';

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
    // A loaded diary marks 00:00 with a bold dashed seam (closed snapshot, not
    // the live continuous ring).
    pass('midnight seam shown while viewing a diary', (await page.locator('.midnight-seam').count()) > 0);
    pass('view cursor written on diary load',
      (await page.evaluate((k) => localStorage.getItem(k), VIEW_KEY)) === JSON.stringify({ diaryDate: key }));
    pass('diary exit affordance shown', (await page.locator('text=일기 나가기').count()) > 0);

    await exitDiary(page);
    pass('now-line returns after exit', (await nowLines()) > 0);
    pass('midnight seam gone after exit', (await page.locator('.midnight-seam').count()) === 0);
    pass('view cursor cleared on exit',
      (await page.evaluate((k) => localStorage.getItem(k), VIEW_KEY)) === JSON.stringify({ diaryDate: null }));

    // ── Rim-memo leak guard ──────────────────────────────────────────────────
    // Loading a diary must SHOW that date's saved rim memos (read-only) without
    // overwriting the working day's own list; leaving restores the working list.
    // (Regression: the old code copied the diary's memos into the active day and
    // never restored them, so they lingered on the editing screen after exit.)
    await page.evaluate((k) => {
      localStorage.setItem('24h-circle-planner.rimmemos', JSON.stringify({ version: 1, byDay: { d1: [{ id: 'live', minute: 120, text: 'LIVEMEMO', createdAt: 1 }] } }));
      const d = JSON.parse(localStorage.getItem('24h-circle-planner.diary'));
      d.entries[k].rimMemos = [{ id: 'snap', minute: 600, text: 'DIARYMEMO', createdAt: 2 }];
      localStorage.setItem('24h-circle-planner.diary', JSON.stringify(d));
    }, key);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
    await page.keyboard.press('Escape').catch(() => {});
    await wait(400);

    const rimText = () => page.evaluate(() => [...document.querySelectorAll('.rim-memo-text')].map((e) => e.innerText).join('|'));
    const storedLive = () => page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('24h-circle-planner.rimmemos') || '{}');
      return (s.byDay?.d1 ?? []).map((m) => m.text).join('|');
    });

    pass('working-day rim memo shown normally', (await rimText()).includes('LIVEMEMO'));
    await loadDiary(page, key);
    const inDiary = await rimText();
    pass('diary rim memo shown while viewing diary', inDiary.includes('DIARYMEMO') && !inDiary.includes('LIVEMEMO'), inDiary);
    pass('working-day rim memos NOT overwritten by diary', (await storedLive()) === 'LIVEMEMO', await storedLive());
    await exitDiary(page);
    const afterExit = await rimText();
    pass('working-day rim memo restored after exit', afterExit.includes('LIVEMEMO') && !afterExit.includes('DIARYMEMO'), afterExit);

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
