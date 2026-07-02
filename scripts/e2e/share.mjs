/**
 * Read-only share viewer (/s#d=…): renders schedule + note without touching the
 * viewer's data; / still serves the full app. Needs dist/ over http (routing).
 */
import { makeReporter, launchPage, serveDist, wait, isMain, runStandalone } from './_helpers.mjs';

const b64url = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url');

export async function run() {
  const { pass, allOk } = makeReporter('share');
  const { base, close } = await serveDist();
  const { browser, page, errors } = await launchPage({ viewport: { width: 900, height: 1000 } });
  try {
    const payload = {
      v: 1,
      n: '테스트 하루',
      s: [[0, '수면', '#a78bfa', ''], [480, '일', '#60a5fa', ''], [1080, '휴식', '#34d399', '']],
      t: '오늘은 잘 잤다.\n둘째 줄 노트입니다.',
    };

    // 1. Viewer with schedule + note.
    await page.goto(`${base}/s#d=${b64url(payload)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
    await wait(400);
    pass('viewer renders the chart', await page.locator('svg[role="img"]').first().isVisible().catch(() => false));
    pass('shows the shared name', (await page.locator('h1:has-text("테스트 하루")').count()) > 0);
    pass('shows the note body', (await page.getByText('둘째 줄 노트입니다.').count()) > 0);
    pass('shows the CTA', (await page.locator('a:has-text("나만의 하루 시간표 만들기")').count()) > 0);
    pass('viewer only (no editor chrome)', (await page.locator('button[aria-label="내보내기"]').count()) === 0);
    pass('no live now-line', (await page.locator('.now-indicator').count()) === 0);

    // 2. No note → note section absent. (Fresh document: fragment-only navs
    //    don't remount the SPA; real share links always open fresh.)
    await page.goto('about:blank');
    await page.goto(`${base}/s#d=${b64url({ ...payload, t: undefined })}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
    await wait(300);
    pass('note section absent when no note', (await page.getByText('둘째 줄 노트입니다.').count()) === 0);

    // 3. /s with no payload → friendly empty state.
    await page.goto('about:blank');
    await page.goto(`${base}/s`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await wait(400);
    pass('empty state without a payload', (await page.locator('text=이 링크에서 시간표를 찾을 수 없어요.').count()) > 0);

    // 4. Regression: / still loads the full app.
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
    await wait(400);
    pass('/ still loads the full app', (await page.locator('button[aria-label="내보내기"]').count()) > 0);

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
