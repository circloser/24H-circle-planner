/**
 * Chart layout: 디자인 → 레이아웃 moves the circle to the left or right edge or
 * hides it (still mounted, so PNG export keeps working, with a way back); the
 * design magician ends on the same choice and moves the widget it placed out of
 * the chart's way; a phone-width window keeps the chart centred whatever is saved.
 */
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { makeReporter, launchPage, gotoApp, seedBasicData, wait, isMain, runStandalone } from './_helpers.mjs';

const W = 1280;
const pngDims = (p) => { const b = readFileSync(p); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length }; };
// The side layouts leave a 40px gap; allow for a scrollbar or a dialog's scroll-lock padding.
const edgeGap = (gap) => gap >= 30 && gap <= 64;

export async function run() {
  const { pass, allOk } = makeReporter('layout');
  const out = mkdtempSync(join(tmpdir(), '24h-e2e-layout-'));
  const { browser, page, errors } = await launchPage({ viewport: { width: W, height: 860 }, acceptDownloads: true });

  const chart = () => page.evaluate(() => {
    const r = document.querySelector('svg[data-circle-timeline]').getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), cx: Math.round(r.left + r.width / 2) };
  });
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('24h-circle-planner.prefs') || '{}').prefs?.chartLayout ?? null);
  const clockPos = () => page.evaluate(() => JSON.parse(localStorage.getItem('24h-circle-planner.clocktools') || '{}').state?.clocks?.[0]?.pos ?? null);
  const openDesign = async (item) => {
    await page.locator('button[aria-label="디자인"]').first().click();
    await wait(250);
    await page.locator(`[role="menuitem"]:has-text("${item}")`).first().click();
    await wait(450);
  };

  try {
    await gotoApp(page);
    await seedBasicData(page);

    let c = await chart();
    pass('the chart starts centred', Math.abs(c.cx - W / 2) <= 16, `cx=${c.cx}`);

    // 1. 디자인 → 레이아웃.
    await openDesign('레이아웃');
    const dialog = page.locator('[role="dialog"]').filter({ has: page.locator('[data-layout-picker]') });
    pass('디자인 → 레이아웃 opens four layout choices', (await dialog.locator('button[data-layout]').count()) === 4);
    pass('centre is marked as the current layout', (await dialog.locator('button[data-layout="center"]').getAttribute('aria-pressed')) === 'true');

    await dialog.locator('button[data-layout="left"]').click();
    await wait(400);
    c = await chart();
    pass('left: the chart hugs the left edge', edgeGap(c.left), `left=${c.left}`);
    pass('left: the choice is saved', (await saved()) === 'left');

    await dialog.locator('button[data-layout="right"]').click();
    await wait(400);
    c = await chart();
    pass('right: the chart hugs the right edge', edgeGap(W - c.right), `gap=${W - c.right}`);

    await dialog.locator('button[data-layout="hidden"]').click();
    await wait(400);
    await page.keyboard.press('Escape');
    await wait(400);
    c = await chart();
    pass('hidden: the chart leaves the screen', c.right < 0, `right=${c.right}`);
    pass('hidden: it stays mounted at full size', c.width >= 600, `width=${c.width}`);
    const showBtn = page.locator('[data-show-chart]');
    pass('hidden: "시간표 보이기" offers the way back',
      (await showBtn.count()) === 1 && (await showBtn.innerText()).includes('시간표 보이기'));

    // Export reads the live svg, so it must still render while hidden.
    await page.locator('button[aria-label="내보내기"]').first().click();
    await wait(400);
    await page.locator('button:has-text("1080px")').first().click();
    await wait(120);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('button:has-text("PNG 내보내기")').first().click()]);
    const png = join(out, 'hidden.png');
    await dl.saveAs(png);
    const d = pngDims(png);
    pass('hidden: PNG export still draws the chart', d.w === 1080 && d.h === 1080 && d.bytes > 15000, `${d.w}x${d.h} ${d.bytes}B`);
    await page.keyboard.press('Escape');
    await wait(400);

    await showBtn.click();
    await wait(400);
    c = await chart();
    pass('"시간표 보이기" brings the chart back to the centre',
      Math.abs(c.cx - W / 2) <= 16 && (await saved()) === 'center', `cx=${c.cx}`);

    // 2. The magician ends on the layout step; the clock it placed steps aside.
    await openDesign('디자인 매지션');
    const mag = page.locator('[role="dialog"][aria-label="디자인 매지션"]');
    const counter = async () => (await mag.locator('span.tabular-nums').innerText()).trim();
    const total = Number((await counter()).split('/')[1]);
    for (let i = 1; i < total; i++) {
      if ((await mag.locator('h3').innerText()).trim() === '시계 표시') {
        await mag.locator('button:has-text("켜기")').first().click();
        await wait(300);
      }
      await mag.locator('button:has-text("다음")').click();
      await wait(180);
    }
    pass('the magician’s last step is the layout choice',
      (await mag.locator('h3').innerText()).trim() === '시간표 배치' && (await counter()) === `${total}/${total}`, await counter());
    const before = await clockPos();
    pass('the magician’s clock starts in the left margin', !!before && before.x < -W / 2 + 60, JSON.stringify(before));

    await mag.locator('button[data-layout="left"]').click();
    await wait(600);
    c = await chart();
    const after = await clockPos();
    pass('magician → 왼쪽 moves the chart live', edgeGap(c.left), `left=${c.left}`);
    pass('…and its clock moves to the free right side', !!after && after.x > 0, JSON.stringify(after));
    const clockLeft = await page.evaluate(() => {
      const el = document.querySelector('[data-clock-widget]');
      return el ? Math.round(el.getBoundingClientRect().left) : null;
    });
    pass('…on screen too, clear of the chart', clockLeft !== null && clockLeft >= c.right, `clock left=${clockLeft} chart right=${c.right}`);
    await mag.locator('button:has-text("완성")').click();
    await wait(500);
    await page.keyboard.press('Escape');
    await wait(300);
    pass('the magician’s choice is saved', (await saved()) === 'left');

    // 3. Phone width: always centred.
    await page.setViewportSize({ width: 390, height: 844 });
    await wait(700);
    c = await chart();
    pass('phone width keeps the chart centred with a side layout saved', Math.abs(c.cx - 195) <= 12, `cx=${c.cx}`);

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    rmSync(out, { recursive: true, force: true });
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
