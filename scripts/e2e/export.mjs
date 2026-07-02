/** Export → PNG: resolution selection is visible AND changes the output pixels. */
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { makeReporter, launchPage, gotoApp, seedBasicData, wait, isMain, runStandalone } from './_helpers.mjs';

const pngDims = (p) => { const b = readFileSync(p); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

export async function run() {
  const { pass, allOk } = makeReporter('export');
  const out = mkdtempSync(join(tmpdir(), '24h-e2e-'));
  const { browser, page, errors } = await launchPage({ acceptDownloads: true });
  try {
    await gotoApp(page);
    await seedBasicData(page);

    await page.locator('button[aria-label="내보내기"]').first().click();
    await wait(400);

    const b1080 = page.locator('button:has-text("1080px")').first();
    const b4k = page.locator('button:has-text("4K (3840px)")').first();
    pass('resolution buttons present', (await b1080.count()) > 0 && (await b4k.count()) > 0);

    await b4k.click();
    await wait(120);
    pass('4K selection reflected (aria-pressed)',
      (await b4k.getAttribute('aria-pressed')) === 'true' && (await b1080.getAttribute('aria-pressed')) === 'false');

    const exportBtn = page.locator('button:has-text("PNG 내보내기")').first();

    await b1080.click();
    await wait(120);
    const [dl1] = await Promise.all([page.waitForEvent('download'), exportBtn.click()]);
    const p1 = join(out, 'res-1080.png');
    await dl1.saveAs(p1);
    const d1 = pngDims(p1);
    pass('1080 export is 1080×1080', d1.w === 1080 && d1.h === 1080, `${d1.w}x${d1.h}`);

    await b4k.click();
    await wait(120);
    const [dl2] = await Promise.all([page.waitForEvent('download'), exportBtn.click()]);
    const p2 = join(out, 'res-4k.png');
    await dl2.saveAs(p2);
    const d2 = pngDims(p2);
    pass('4K export is 3840×3840', d2.w === 3840 && d2.h === 3840, `${d2.w}x${d2.h}`);

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    try { rmSync(out, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
