/** Desktop post-it: drag moves it when not editing; a plain click enters edit. */
import { makeReporter, launchPage, gotoApp, wait, isMain, runStandalone } from './_helpers.mjs';

export async function run() {
  const { pass, allOk } = makeReporter('memo');
  const { browser, page, errors } = await launchPage({ viewport: { width: 1600, height: 900 } });
  try {
    await gotoApp(page);
    // Seed one visible post-it in an empty corner (must not overlap the centered
    // chart — the note renders behind it there and isn't hit-testable).
    await page.evaluate(() => {
      const memo = { id: 'm1', text: '드래그 테스트', x: 1250, y: 120, color: '#fef08a', fontFamily: 'Pretendard', align: 'center', createdAt: 1, onScreen: true };
      localStorage.setItem('24h-circle-planner.memos', JSON.stringify({ version: 1, memos: [memo], visible: true }));
      localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs: { language: 'ko' } }));
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
    await page.keyboard.press('Escape').catch(() => {});
    await wait(400);

    const note = page.locator('.memo-note').first();
    pass('post-it rendered', await note.isVisible().catch(() => false));
    const box0 = await note.boundingBox();

    // Drag from the centre (over the text) — should MOVE, not edit.
    const cx = box0.x + box0.width / 2;
    const cy = box0.y + box0.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 160, cy + 120, { steps: 10 });
    await page.mouse.up();
    await wait(250);
    const box1 = await note.boundingBox();
    pass('drag over text moves the note', box1 && Math.abs(box1.x - box0.x) > 100 && Math.abs(box1.y - box0.y) > 80,
      `from=(${Math.round(box0.x)},${Math.round(box0.y)}) to=(${box1 ? Math.round(box1.x) : '?'},${box1 ? Math.round(box1.y) : '?'})`);

    const persisted = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('24h-circle-planner.memos')).memos[0]; } catch { return null; } });
    pass('moved position persisted', persisted && persisted.x > 300, `x=${persisted && persisted.x}`);

    // A plain click (no drag) focuses the text for editing.
    const box2 = await note.boundingBox();
    await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 2);
    await wait(200);
    pass('a click enters edit mode', await page.evaluate(() => document.activeElement?.classList?.contains('memo-text') ?? false));

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
