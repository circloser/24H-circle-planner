/**
 * Life — the whole-life timeline (PRD acceptance). Over dist/ with a free
 * account mocked: its own header button; a birthday alone draws birth, today
 * and the decades; moments are added, sorted, edited, deleted and survive a
 * reload; cards alternate on a wide screen and all sit right of a left line on
 * a phone; the past is solid and the future dashed; the ending note always
 * carries its legal notice; the long PNG; JSON backup → cleared browser →
 * restore; the free limit only stops adding; reduced motion turns the fade off.
 */
import { readFileSync } from 'node:fs';
import { makeReporter, launchPage, seedBasicData, serveDist, wait, isMain, runStandalone } from './_helpers.mjs';

const LIFE_KEY = '24h-circle-planner.life';
const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function setup(base, opts = {}) {
  const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 900 }, ...opts });
  const counted = [];
  // Usage counting is off on localhost unless asked for.
  await page.addInitScript(() => { try { localStorage.setItem('24h-metrics-debug', '1'); } catch { /* */ } });
  await page.route('**/api/metrics', async (route) => {
    try { counted.push(...(JSON.parse(route.request().postData() ?? '{}').e ?? [])); } catch { /* ignore */ }
    await route.fulfill({ status: 204, body: '' });
  });
  await page.route('**/api/sync*', (route) => route.fulfill(json({ version: 0, data: {}, updatedAt: 0 })));
  await page.route('**/api/me', (route) => route.fulfill(json({ user: { id: 'u1', email: 'me@example.com', provider: 'google' }, plan: 'free', admin: false })));
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
  await seedBasicData(page);
  return { browser, page, errors, counted };
}

const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

export async function run() {
  const { pass, allOk } = makeReporter('life');
  const { base, close } = await serveDist();
  const { browser, page, errors, counted } = await setup(base);
  const count = (sel) => page.locator(sel).count();
  const stored = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), LIFE_KEY);
  const titles = () => page.$$eval('[data-life-moment]', (els) => els.map((e) => e.querySelector('.life-serif')?.textContent ?? ''));
  const openLife = async () => {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline], [data-life-view]', { timeout: 15000 });
    if ((await count('[data-life-view]')) === 0) await page.locator('[data-life-toggle]').click();
    await page.waitForSelector('[data-life-view]', { timeout: 15000 });
    await wait(500);
  };
  const fillMoment = async ({ title, y, m, d, cat }) => {
    await page.locator('[data-life-title-input]').fill(title);
    await page.locator('#life-date-y').fill(String(y));
    if (m) await page.locator('#life-date-m').selectOption(String(m));
    if (d) await page.locator('#life-date-d').selectOption(String(d));
    if (cat) await page.locator(`[data-life-cat="${cat}"]`).click();
  };
  /** Usage counts go out in batches when the page is hidden. */
  const flush = async () => {
    await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await wait(800);
  };
  /** Add without a button: the keyboard's way in (Tab reaches it). */
  const add = async () => {
    await page.locator('[data-life-add]').focus();
    await page.keyboard.press('Enter');
    await wait(300);
  };
  const headerExport = async () => {
    await page.locator('[data-app-header] button[aria-label="내보내기"]').click();
    await wait(400);
  };
  const blurNote = () => page.locator('[data-life-ending-input]').evaluate((el) => el.blur());
  const save = async () => {
    await page.locator('[data-life-save]').click();
    await wait(400);
  };

  try {
    // 1. Its own button beside the calendar's.
    const fabs = await page.locator('button[class*="bottom-5"]').count();
    await page.locator('[data-life-toggle]').click();
    await wait(600);
    pass('the header button opens the life page', (await count('[data-life-view]')) === 1);
    pass('…and reads as pressed', (await page.locator('[data-life-toggle]').getAttribute('aria-pressed')) === 'true');
    pass('the floating widgets step aside', (await page.locator('button[class*="bottom-5"]').count()) === 0, `${fabs} → 0`);
    pass('a first visit asks only for the birthday', (await count('[data-life-onboarding]')) === 1);

    // 2. A birthday alone draws the line.
    await page.locator('[data-life-birth-input]').fill('1985-05-15');
    await page.locator('[data-life-start]').click();
    await wait(600);
    pass('birth, today and the decades appear at once',
      (await count('[data-life-birth]')) === 1 && (await count('[data-life-today]')) === 1 && (await count('[data-life-decade]')) >= 10,
      `decades ${await count('[data-life-decade]')}`);
    pass('today reads as 만 나이', /오늘 · 만 \d+세/.test(await page.locator('[data-life-today]').innerText()));
    pass('an empty line offers three example cards', (await count('[data-life-example]')) === 3);
    pass('the page body has no add or export buttons', (await count('[data-life-export]')) === 0
      && (await page.locator('[data-life-add]').evaluate((el) => el.getBoundingClientRect().width)) <= 1);
    pass('only a mother and a father at the top, no other family', (await count('[data-life-slot="mother"]')) === 1
      && (await count('[data-life-slot="father"]')) === 1 && (await count('[data-life-add-family]')) === 0);
    const bodyText = await page.locator('[data-life-view]').innerText();
    pass('no will wording, no "뿌리", no filler under the page', !/유언|뿌리/.test(bodyText) && (await count('[data-life-footer]')) === 0);
    pass('the site footer and reading copy stay away here',
      (await page.locator('#site-copy-wrap').evaluate((el) => getComputedStyle(el).display).catch(() => 'none')) === 'none'
      && (await page.locator('footer', { hasText: '개인정보처리방침' }).count()) === 0);

    // Hovering the line offers a faint + that adds a moment in that year.
    const spot = await page.evaluate(() => {
      const ol = document.querySelector('[data-life-timeline]').getBoundingClientRect();
      const el = document.querySelector('[data-life-decade][data-year="1990"]');
      el.scrollIntoView({ block: 'center' });
      const row = el.getBoundingClientRect();
      return { x: ol.left + ol.width / 2, y: row.top + 12 };
    });
    await page.mouse.move(spot.x + 30, spot.y);
    await page.mouse.move(spot.x, spot.y, { steps: 4 });
    await wait(200);
    pass('hovering the line shows a bare + circle', (await count('[data-life-ghost]')) === 1
      && (await page.locator('[data-life-ghost]').innerText()).trim() === '');
    // It glides the whole way down, markers and labels included.
    const marker = await page.locator('[data-life-birth] [data-life-marker]').boundingBox();
    await page.mouse.move(spot.x, marker.y + marker.height / 2, { steps: 6 });
    await wait(150);
    pass('…that stays as it passes a marker', (await count('[data-life-ghost]')) === 1);
    await page.mouse.move(spot.x, spot.y, { steps: 4 });
    await wait(150);
    await page.locator('[data-life-ghost]').click();
    await wait(400);
    pass('…which opens the add form in that year', (await page.locator('#life-date-y').inputValue()) === '1990');
    await page.keyboard.press('Escape');
    await wait(300);
    await page.mouse.move(spot.x + 200, spot.y);
    await wait(150);
    pass('…and leaves when the pointer leaves the line', (await count('[data-life-ghost]')) === 0);

    // 3. An example card opens the form already filled in.
    await page.locator('[data-life-example] button[aria-label]').first().click();
    await wait(400);
    pass('an example opens the add form, filled in', (await page.locator('[data-life-title-input]').inputValue()) === '첫 등교');
    await save();
    pass('…and becomes the first moment', (await count('[data-life-moment]')) === 1 && (await count('[data-life-example]')) === 0);
    await wait(500);
    const firstOpacity = await page.locator('[data-life-moment] .life-reveal').first().evaluate((el) => getComputedStyle(el).opacity);
    pass('…which fades in (not left transparent)', firstOpacity === '1', firstOpacity);

    // 4. Adding from the header; a future date is a plan by itself.
    await add();
    await fillMoment({ title: '첫 직장 입사', y: 2010, m: 5, d: 15, cat: 'career' });
    await save();
    await add();
    await fillMoment({ title: '세계 여행', y: 2031, cat: 'travel' });
    const plan = page.locator('[data-life-plan-input]');
    pass('a date after today is ticked as a plan, and locked', (await plan.isChecked()) && (await plan.isDisabled()));
    await save();
    await add();
    // A day past the end of a newly picked month is dropped, not hidden.
    await fillMoment({ title: '대학 입학', y: 2004, m: 1, d: 31, cat: 'education' });
    await page.locator('#life-date-m').selectOption('2');
    pass('Jan 31 → February drops the day and keeps Save usable',
      (await page.locator('#life-date-d').inputValue()) === '' && !(await page.locator('[data-life-save]').isDisabled()));
    await page.locator('#life-date-m').selectOption('3');
    await save();
    pass('moments sort by date whatever order they were added in',
      JSON.stringify(await titles()) === JSON.stringify(['첫 등교', '대학 입학', '첫 직장 입사', '세계 여행']), JSON.stringify(await titles()));
    const order = await page.$$eval('[data-life-timeline] > li', (els) => els.map((e) => (e.hasAttribute('data-life-today') ? 'today' : e.getAttribute('data-life-moment') ? 'm' : '')).filter(Boolean));
    pass('today sits between the past and the plans', order.indexOf('today') === 3, order.join(','));

    // 5. Solid above today, dashed below.
    const lines = await page.$$eval('[data-life-moment]', (els) => els.map((e) => ({
      future: e.hasAttribute('data-future'),
      dashed: getComputedStyle(e.querySelector('.life-line')).backgroundImage.includes('repeating-linear-gradient'),
    })));
    pass('the line is solid in the past and dashed after today', lines.every((l) => l.future === l.dashed) && lines.some((l) => l.dashed) && lines.some((l) => !l.dashed));
    const planMarker = page.locator('[data-life-moment][data-plan] [data-life-marker]');
    pass('a plan has a dashed marker', (await planMarker.evaluate((el) => getComputedStyle(el).borderTopStyle)) === 'dashed');
    pass('a past moment has a solid one', (await page.locator('[data-life-moment]:not([data-plan]) [data-life-marker]').first().evaluate((el) => getComputedStyle(el).borderTopStyle)) === 'solid');

    // 6. Desktop: the cards alternate around the centre line.
    const sides = await page.evaluate(() => {
      const ol = document.querySelector('[data-life-timeline]').getBoundingClientRect();
      const mid = ol.left + ol.width / 2;
      return [...document.querySelectorAll('[data-life-birth] [data-life-card], [data-life-moment] [data-life-card]')]
        .map((c) => { const r = c.getBoundingClientRect(); return r.right < mid ? 'L' : r.left > mid ? 'R' : '?'; }).join('');
    });
    pass('wide screen: cards alternate left and right of the line', sides === 'LRLRL', sides);

    // 7. It all survives a reload.
    await openLife();
    pass('moments survive a reload', (await count('[data-life-moment]')) === 4);
    pass('ages are shown in 만 나이', (await page.locator('[data-life-moment]', { hasText: '첫 직장 입사' }).innerText()).includes('25세'));

    // 8. Edit and delete through the card.
    await page.locator('[data-life-moment]', { hasText: '첫 직장 입사' }).locator('button[aria-label]').click();
    await wait(300);
    await page.locator('[data-life-title-input]').fill('첫 직장');
    await save();
    pass('a card opens its editor, and the edit shows', (await titles()).includes('첫 직장'));
    await page.locator('[data-life-moment]', { hasText: '대학 입학' }).locator('button[aria-label]').click();
    await wait(300);
    await page.locator('[data-life-delete]').click();
    await page.locator('[data-life-delete]').click();
    await wait(400);
    pass('delete asks twice, then removes', !(await titles()).includes('대학 입학') && (await stored()).milestones.length === 3);

    // 9. Roots: a parent, with the note about other people's details.
    await page.locator('[data-life-slot="mother"]').click();
    await wait(300);
    await page.locator('[data-life-name-input]').fill('이정숙');
    await page.locator('#life-fam-birth-y').fill('1958');
    await save();
    pass('a parent fills the slot', (await count('[data-life-member="mother"]')) === 1 && (await count('[data-life-slot="mother"]')) === 0);
    pass('…and the card is actually visible', (await page.locator('[data-life-member="mother"]').evaluate((el) => getComputedStyle(el).opacity)) === '1');

    // 10. The ending note.
    await page.locator('[data-life-ending-input]').fill('함께해 준 모든 날이 고마웠어요.');
    await blurNote();
    await wait(300);
    pass('the ending note is kept', (await stored()).endingNote?.text === '함께해 준 모든 날이 고마웠어요.');
    pass('…with the day it was last changed', (await count('[data-life-ending-updated]')) === 1);

    // 11. Filters: a round button in the bottom-right corner, opening upward.
    const fab = await page.locator('[data-life-filter-toggle]').boundingBox();
    const vp = page.viewportSize();
    pass('the filter is a round button in the bottom-right corner', !!fab && fab.width === fab.height
      && vp.width - (fab.x + fab.width) < 40 && vp.height - (fab.y + fab.height) < 40);
    await page.locator('[data-life-filter-toggle]').click();
    await wait(200);
    const chipsBox = await page.locator('[data-life-filters]').boundingBox();
    pass('…and its choices unfold above it', !!chipsBox && chipsBox.y + chipsBox.height <= fab.y);
    await page.locator('[data-life-filter="travel"]').click();
    await wait(300);
    pass('a category filter shows only its moments', JSON.stringify(await titles()) === JSON.stringify(['세계 여행']), JSON.stringify(await titles()));
    await page.locator('[data-life-filters] button').first().click();
    await wait(300);
    pass('"all" brings everything back', (await titles()).length === 3);

    // 12. The long PNG (from the header's 내보내기), only after the privacy check.
    await page.keyboard.press('Escape');
    await headerExport();
    pass('export opens with a preview', (await page.waitForSelector('[data-life-export-preview] img', { timeout: 15000 }).catch(() => null)) !== null);
    pass('saving the image waits for the privacy check', await page.locator('[data-life-export-png]').isDisabled());
    await page.locator('[data-life-export-check]').check();
    const [png] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('[data-life-export-png]').click()]);
    const size = pngSize(readFileSync(await png.path()));
    pass('one tall PNG, 1080 laid out at 2×', /^24houring-life-\d{4}-\d{2}-\d{2}\.png$/.test(png.suggestedFilename()) && size.w === 2160 && size.h > size.w * 2,
      `${png.suggestedFilename()} ${size.w}×${size.h}`);

    // 13. The app header's 내보내기 opens the same export here.
    await headerExport();
    pass('the header export opens the life export', (await count('[data-life-export-dialog]')) === 1);

    // 14. JSON backup → a cleared browser → restore.
    const before = await stored();
    const [backup] = await Promise.all([page.waitForEvent('download'), page.locator('[data-life-export-json]').click()]);
    const backupPath = await backup.path();
    pass('the backup is a life file', /^24houring-life-.*\.json$/.test(backup.suggestedFilename()) && JSON.parse(readFileSync(backupPath, 'utf8')).kind === 'life');
    // Restoring over a record whose note has changed since: the field shows
    // the restored note, and leaving it does not write the old one back.
    await page.keyboard.press('Escape');
    await wait(300);
    await page.locator('[data-life-ending-input]').fill('나중에 바꾼 글');
    await blurNote();
    await headerExport();
    await page.locator('[data-life-import-input]').setInputFiles(backupPath);
    await wait(400);
    await page.locator('[data-life-import-go]').click();
    await wait(500);
    await page.locator('[data-life-ending-input]').focus();
    await blurNote();
    await wait(300);
    pass('restoring over an edited note shows and keeps the restored one',
      (await page.locator('[data-life-ending-input]').inputValue()) === before.endingNote.text && (await stored()).endingNote.text === before.endingNote.text);
    await flush();
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('24h-circle-planner.onboarded', '1'); });
    await openLife();
    pass('a cleared browser starts over', (await count('[data-life-onboarding]')) === 1);
    await headerExport();
    await page.locator('[data-life-import-input]').setInputFiles(backupPath);
    await wait(400);
    await page.locator('[data-life-import-go]').click();
    await wait(600);
    const after = await stored();
    pass('restoring brings everything back', JSON.stringify({ ...after, updatedAt: '' }) === JSON.stringify({ ...before, updatedAt: '' })
      && (await count('[data-life-moment]')) === 3 && (await count('[data-life-member="mother"]')) === 1);
    await openLife();
    pass('…and it stays after a reload', (await count('[data-life-moment]')) === 3);

    // 15. The free limit stops adding — and nothing is lost.
    await page.evaluate((k) => {
      const life = JSON.parse(localStorage.getItem(k));
      life.milestones = Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, date: String(1990 + i), title: `사건 ${i + 1}`, category: 'other', isPlan: false }));
      localStorage.setItem(k, JSON.stringify(life));
    }, LIFE_KEY);
    await openLife();
    await add();
    await wait(200);
    pass('at the free limit, adding opens the Pro offer instead', (await page.getByRole('dialog', { name: 'Pro로 업그레이드' }).count()) === 1
      && (await count('[data-life-moment-dialog]')) === 0);
    await page.keyboard.press('Escape');
    await wait(300);
    pass('…and all 30 moments are still there', (await count('[data-life-moment]')) === 30 && (await stored()).milestones.length === 30);
    pass('the backup banner asks, with 10+ moments and no backup', (await count('[data-life-backup-banner]')) === 1);

    // 16. Cards fade in as they scroll in.
    const last = page.locator('[data-life-moment] .life-reveal').last();
    pass('a card below the fold waits to fade in', (await last.evaluate((el) => getComputedStyle(el).opacity)) === '0');
    await last.scrollIntoViewIfNeeded();
    await wait(600);
    pass('…and shows once scrolled to', (await last.evaluate((el) => getComputedStyle(el).opacity)) === '1');

    // 17. A phone: the line on the left, every card to its right.
    await page.setViewportSize({ width: 390, height: 844 });
    await wait(500);
    const phone = await page.evaluate(() => {
      const line = document.querySelector('[data-life-moment] .life-line').getBoundingClientRect();
      const cards = [...document.querySelectorAll('[data-life-moment] [data-life-card]')].map((c) => c.getBoundingClientRect());
      return { line: line.left, allRight: cards.every((r) => r.left > line.right + 20 && r.right <= window.innerWidth - 8) };
    });
    pass('phone: a left line with every card on its right', phone.line < 40 && phone.allRight, JSON.stringify(phone));
    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    const want = ['life_open', 'life_add', 'life_image:downloaded', 'life_backup:json', 'upgrade_open:life'];
    await flush();
    pass('usage is counted', want.every((w) => counted.includes(w)), want.filter((w) => !counted.includes(w)).join(','));
  } finally {
    await browser.close();
  }

  // 18. Reduced motion: nothing waits to fade in.
  const calm = await setup(base, { reducedMotion: 'reduce' });
  try {
    await calm.page.evaluate((k) => {
      localStorage.setItem(k, JSON.stringify({
        version: 1, profile: { birthDate: '1985-05-15' }, family: [], endingNote: null, updatedAt: '',
        milestones: Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, date: String(1990 + i), title: `사건 ${i + 1}`, category: 'other', isPlan: false })),
      }));
    }, LIFE_KEY);
    await calm.page.reload({ waitUntil: 'domcontentloaded' });
    await calm.page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await calm.page.locator('[data-life-toggle]').click();
    await calm.page.waitForSelector('[data-life-timeline]');
    await wait(400);
    const op = await calm.page.locator('[data-life-moment] .life-reveal').last().evaluate((el) => getComputedStyle(el).opacity);
    const pulse = await calm.page.locator('[data-life-today] .life-pulse').evaluate((el) => getComputedStyle(el).animationName);
    pass('prefers-reduced-motion: every card is already shown', op === '1', op);
    pass('…and today does not pulse', pulse === 'none', pulse);
    pass('no page errors (reduced motion)', calm.errors.length === 0, calm.errors.slice(0, 2).join(' | '));
  } finally {
    await calm.browser.close();
    await close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
