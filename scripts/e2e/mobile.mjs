/**
 * Mobile usability sweep (390×844 touch emulation) — added for the Play Store
 * launch. Asserts the things that break small screens:
 *  1. the slice editor stays FULLY on-screen when opened from edge slices
 *     (top/right/bottom/left of the ring — regression: it used to centre on the
 *     label anchor unclamped and hang off the left edge),
 *  2. the main dialogs (settings/export/presets/upgrade/icon picker) fit the
 *     viewport width with no horizontal document scroll,
 *  3. the main page itself has no horizontal overflow.
 */
import { makeReporter, launchPage, gotoApp, wait, isMain, runStandalone } from './_helpers.mjs';

const VW = 390;
const VH = 844;

export async function run() {
  const { pass, allOk } = makeReporter('mobile');
  const { browser, page, errors } = await launchPage({
    viewport: { width: VW, height: VH },
    isMobile: true,
    hasTouch: true,
  });
  try {
    // Four slices whose labels sit at the ring's cardinal points.
    await page.addInitScript(() => {
      const sl = [
        { id: 'top', label: '위쪽', startTime: '22:00', endTime: '02:00', color: '#c7d2fe', icon: '', textPosition: 'inside' },
        { id: 'right', label: '오른쪽', startTime: '02:00', endTime: '08:00', color: '#93c5fd', icon: '', textPosition: 'inside' },
        { id: 'bottom', label: '아래쪽', startTime: '08:00', endTime: '14:00', color: '#fca5a5', icon: '', textPosition: 'inside' },
        { id: 'left', label: '왼쪽', startTime: '14:00', endTime: '22:00', color: '#6ee7b7', icon: '', textPosition: 'inside' },
      ];
      localStorage.setItem('24h-circle-planner.onboarded', '1');
      localStorage.setItem('24h-circle-planner.schedule', JSON.stringify({ version: 1, schedule: { id: 's1', name: '모바일', updatedAt: new Date().toISOString(), slices: sl } }));
      localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs: { language: 'ko' } }));
      // Rim (edge) memos at the far right / left / top — the positions that used
      // to spill past the viewport and stretch the page on phones. Flat format
      // folds into the active day at mount.
      // Minutes are kept off the four cardinal slice-label angles (0/300/660/1080)
      // so a memo's delete button never lands on a label the editor test taps.
      localStorage.setItem('24h-circle-planner.rimmemos', JSON.stringify({ version: 1, memos: [
        { id: 'rm-r', minute: 360, text: '오른쪽 테두리 메모 긴 텍스트 테스트', createdAt: 1 },
        { id: 'rm-l', minute: 1140, text: '왼쪽 테두리 메모', createdAt: 1 },
        { id: 'rm-t', minute: 90, text: '위쪽 메모', createdAt: 1 },
      ] }));
    });
    await gotoApp(page);

    // ── 1. Slice editor fully on-screen from every cardinal slice ────────────
    const editor = page.locator('div[aria-label="슬라이스 편집"]');
    for (const id of ['top', 'right', 'bottom', 'left']) {
      const lbl = page.locator(`[data-label-id="${id}"]`).first();
      const bb = await lbl.boundingBox().catch(() => null);
      if (!bb) {
        pass(`editor on-screen (${id})`, false, 'label not found');
        continue;
      }
      await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await wait(500);
      const er = await editor.boundingBox().catch(() => null);
      const ok = !!er && er.x >= 4 && er.y >= 4 && er.x + er.width <= VW - 4 && er.y + er.height <= VH - 4;
      pass(`editor on-screen (${id})`, ok, er ? `x=${Math.round(er.x)} y=${Math.round(er.y)} ${Math.round(er.width)}×${Math.round(er.height)}` : 'editor did not open');
      await page.keyboard.press('Escape');
      await wait(250);
    }

    // ── 1.5 Editor: direct start/end time editing (mobile-only inputs) ───────
    {
      const bb = await page.locator('[data-label-id="right"]').first().boundingBox();
      await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await wait(500);
      const timeInputs = editor.locator('input[type="time"]');
      pass('editor has time inputs', (await timeInputs.count()) === 2, `count=${await timeInputs.count()}`);
      // The inputs must stay INSIDE the editor box (they used to overflow the
      // 280px editor and hang off the screen edge on Samsung's wide time picker).
      {
        const er = await editor.boundingBox();
        const t0 = await timeInputs.first().boundingBox();
        const t1 = await timeInputs.nth(1).boundingBox();
        const fits = !!er && !!t0 && !!t1
          && t0.x >= er.x - 0.5 && t0.x + t0.width <= er.x + er.width + 0.5
          && t1.x >= er.x - 0.5 && t1.x + t1.width <= er.x + er.width + 0.5
          && t1.x + t1.width <= VW - 4;
        pass('time inputs fit inside editor', fits, t1 ? `endRight=${Math.round(t1.x + t1.width)} editorRight=${Math.round((er?.x ?? 0) + (er?.width ?? 0))} VW=${VW}` : 'no box');
      }
      // right slice is 02:00–08:00 → move its start to 03:00 (top grows to 22–03).
      await timeInputs.first().fill('03:00');
      await wait(400);
      const v = await timeInputs.first().inputValue().catch(() => '');
      pass('start time edit applies', v === '03:00', `value=${v}`);
      await page.keyboard.press('Escape');
      await wait(300);
    }

    // ── 2. Icon picker (opened from the editor's 더보기) fits ────────────────
    {
      const bb = await page.locator('[data-label-id="right"]').first().boundingBox();
      if (bb) {
        await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
        await wait(400);
        const more = page.getByRole('button', { name: '더보기' }).first();
        if (await more.isVisible().catch(() => false)) {
          await more.click();
          await wait(500);
          const dlg = page.locator('[role="dialog"]').last();
          const r = await dlg.boundingBox().catch(() => null);
          pass('icon picker fits', !!r && r.x >= 0 && r.x + r.width <= VW + 0.5, r ? `w=${Math.round(r.width)}` : 'no dialog');
          await page.keyboard.press('Escape');
          await wait(250);
        } else {
          pass('icon picker fits', false, '더보기 not visible');
        }
        await page.keyboard.press('Escape');
        await wait(250);
      }
    }

    // ── 3. Main dialogs fit the viewport width ───────────────────────────────
    const checkDialog = async (name, open) => {
      try {
        await open();
        await wait(600);
        const dlg = page.locator('[role="dialog"]').last();
        const r = await dlg.boundingBox().catch(() => null);
        const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
        const ok = !!r && r.x >= 0 && r.x + r.width <= VW + 0.5 && noHScroll;
        pass(`${name} dialog fits`, ok, r ? `w=${Math.round(r.width)} x=${Math.round(r.x)} hscroll=${!noHScroll}` : 'no dialog');
      } catch (e) {
        pass(`${name} dialog fits`, false, String(e).slice(0, 60));
      }
      await page.keyboard.press('Escape');
      await wait(350);
      await page.keyboard.press('Escape');
      await wait(200);
    };
    await checkDialog('settings', async () => {
      // The settings DIALOG opens via 디자인 → a section item (the gear button
      // is the account/language dropdown, not a dialog).
      await page.locator('button[aria-label="디자인"]').first().click();
      await wait(250);
      await page.getByRole('menuitem', { name: '폰트' }).click();
    });
    await checkDialog('export', () => page.locator('button[aria-label="내보내기"]').first().click());
    await checkDialog('upgrade', () => page.evaluate(() => { window.location.hash = '#coupons'; }));
    await page.evaluate(() => { window.location.hash = ''; });
    await checkDialog('presets', async () => {
      await page.locator('button[aria-label="디자인"]').first().click();
      await wait(250);
      await page.getByRole('menuitem', { name: '프리셋' }).click();
    });

    // ── 4. Main page: no horizontal overflow (with rim memos present) ────────
    pass('no horizontal overflow (main)', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

    // ── 5. Rim (edge) memos: dots on the rim → tap → popup → delete ──────────
    {
      const dots = await page.evaluate(() =>
        [...document.querySelectorAll('[data-rim-dot]')].map((el) => {
          const r = el.getBoundingClientRect();
          return [Math.round(r.left), Math.round(r.right)];
        }),
      );
      pass('rim memo dots rendered', dots.length === 3, `count=${dots.length}`);
      pass('rim memo dots on-screen', dots.every(([l, r]) => l >= -1 && r <= VW + 1), JSON.stringify(dots));
      pass('no rim text boxes on mobile', (await page.locator('.rim-memo-text').count()) === 0);
      // Tap the first dot (rm-r) → popup shows that memo's text.
      await page.locator('[data-rim-dot]').first().tap();
      await wait(500);
      const dlg = page.locator('[role="dialog"]').last();
      const dlgText = (await dlg.innerText().catch(() => '')).replace(/\n/g, ' ');
      pass('rim popup shows memo text', dlgText.includes('오른쪽 테두리 메모'), dlgText.slice(0, 50));
      await dlg.locator('button[aria-label="메모 삭제"]').tap();
      await wait(400);
      const left = await page.locator('[data-rim-dot]').count();
      pass('rim delete via popup', left === 2, `dots left=${left}`);
    }

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
