/**
 * Life — the whole-life timeline (PRD acceptance). Over dist/ with a free
 * account mocked: its own header button; a birthday alone draws birth, today
 * and the decades; moments are added, sorted, edited, deleted and survive a
 * reload; cards alternate on a wide screen and all sit right of a left line on
 * a phone; the past is solid and the future dashed; the ending note always
 * carries its legal notice; the memoir is bought once and kept on the device;
 * the long PNG; JSON backup → cleared browser →
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
  // The share store, in memory: POST keeps the code, GET hands it back.
  const shares = new Map();
  await page.route('**/api/share', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    const id = `share${shares.size + 1}`;
    shares.set(id, body.d);
    await route.fulfill(json({ id, url: `https://24houring.com/s/${id}` }));
  });
  await page.route('**/api/share/*', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop();
    await route.fulfill(shares.has(id) ? json({ d: shares.get(id), name: '' }) : { status: 404, body: 'no' });
  });
  // 자서전: off until a test sets it up, and the writer is a stub — the point
  // is what the browser sends and keeps, not what a model would write.
  const memoir = { enabled: false, signedIn: false, credits: 0, price: { amount: 100, currency: 'usd' } };
  const memoirCalls = [];
  const checkouts = [];
  await page.route('**/api/life/memoir', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill(json(memoir));
    memoirCalls.push(JSON.parse(route.request().postData() ?? '{}'));
    memoir.credits = Math.max(0, memoir.credits - 1);
    return route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: '## 첫 장\n나는 1985년에 태어났다.\n\n자랐다.\n\n## 끝 장\n여기까지.',
    });
  });
  // Registered after, so they win the longer paths.
  await page.route('**/api/life/memoir/checkout', async (route) => {
    checkouts.push(1);
    // Polar interpolates the checkout id into the address it returns to.
    await route.fulfill(json({ url: `${base}/?view=life&memoir=paid&checkout_id=co_test1234` }));
  });
  // The buyer's own receipt, for when the webhook is off or late.
  const claims = [];
  await page.route('**/api/life/memoir/claim', async (route) => {
    claims.push(JSON.parse(route.request().postData() ?? '{}').checkoutId);
    memoir.credits += 1;
    await route.fulfill(json({ ok: true, credits: memoir.credits }));
  });
  // The account this page sees; the decorating step turns Pro on.
  const me = { user: { id: 'u1', email: 'me@example.com', provider: 'google' }, plan: 'free', admin: false };
  await page.route('**/api/me', (route) => route.fulfill(json(me)));
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
  await seedBasicData(page);
  return { browser, page, errors, counted, me, memoir, memoirCalls, checkouts, claims };
}

const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

export async function run() {
  const { pass, allOk } = makeReporter('life');
  const { base, close } = await serveDist();
  const { browser, page, errors, counted, me, memoir, memoirCalls, checkouts, claims } = await setup(base);
  const count = (sel) => page.locator(sel).count();
  const stored = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), LIFE_KEY);
  const titles = () => page.$$eval('[data-life-moment]', (els) => els.map((e) => e.querySelector('.life-serif')?.textContent ?? ''));
  /** Usage counts go out in batches when the page is hidden. */
  const flush = async () => {
    await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await wait(1200); // the beacon is fire-and-forget: give it room
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
  /** Shut every dialog: an overlay left open swallows the next click. */
  const closeAll = async () => {
    for (let i = 0; i < 4 && (await page.locator('[role="dialog"]').count()) > 0; i++) {
      await page.keyboard.press('Escape');
      await wait(250);
    }
    await wait(200);
  };
  const openLife = async () => {
    await flush(); // the counts of this page session, before it goes away
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline], [data-life-view], [data-calendar-view]', { timeout: 15000 });
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
    pass('…and never how long the visitor expects to live',
      !/기대|수명/.test(await page.locator('[data-life-onboarding]').innerText()));

    // 2. A birthday alone draws the line.
    await page.locator('[data-life-birth-input]').fill('1985-05-15');
    await page.locator('[data-life-start]').click();
    await wait(600);
    pass('birth, today and the decades appear at once',
      (await count('[data-life-birth]')) === 1 && (await count('[data-life-today]')) === 1 && (await count('[data-life-decade]')) >= 10,
      `decades ${await count('[data-life-decade]')}`);
    pass('today reads as 만 나이', /오늘 · 만 \d+세/.test(await page.locator('[data-life-today]').innerText()));
    pass('an empty line offers the usual moments to start from', (await count('[data-life-quick-item]')) === 10);
    // `offsetWidth`, not a rectangle: the board is drawn at its own zoom, and a
    // rectangle is measured in the screen's pixels, so a one-pixel button reads
    // as one and a half. The layout box is written in the board's own.
    pass('the page body has no add or export buttons', (await count('[data-life-export]')) === 0
      && (await page.locator('[data-life-add]').evaluate((el) => el.offsetWidth)) <= 1);
    pass('the line starts at the birth, with nothing joined on above it',
      (await count('[data-life-roots]')) === 0 && (await count('[data-life-slot]')) === 0
      && (await count('[data-life-birth]')) === 1);
    // The page opens at today, so the birth is off the top and its card has not
    // been revealed yet (the reveal holds a row 16px low until it scrolls in).
    // Bring it in, let it land, and then measure.
    await page.locator('[data-life-birth]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await wait(400);
    pass('…and no line at all is drawn above that first marker', await page.evaluate(() => {
      const marker = document.querySelector('[data-life-birth] [data-life-marker]');
      const box = marker.getBoundingClientRect();
      const middle = box.top + box.height / 2;
      return [...document.querySelectorAll('.life-line')].every((l) => l.getBoundingClientRect().bottom > middle - 2);
    }));
    pass('…and the year no longer follows the scroll in a black badge',
      (await count('[data-life-year]')) === 0);
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

    // 3. The quick start fills the line in one go.
    await page.locator('[data-life-quick-item="life.quick.school"]').click();
    await page.locator('[data-life-quick-item="life.quick.job"]').click();
    await page.locator('[data-life-quick-add]').click();
    await wait(600);
    pass('picking a few of them writes them all at once',
      (await count('[data-life-moment]')) === 2 && (await count('[data-life-quick]')) === 0, JSON.stringify(await titles()));
    await wait(500);
    const firstOpacity = await page.locator('[data-life-moment] .life-reveal').first().evaluate((el) => getComputedStyle(el).opacity);
    pass('…which fades in (not left transparent)', firstOpacity === '1', firstOpacity);

    // 4. Adding from the header; a future date is a plan by itself.
    await add();
    await fillMoment({ title: '첫 직장 입사', y: 2010, m: 5, d: 15, cat: 'career' });
    await save();
    await add();
    await fillMoment({ title: '세계 여행', y: 2031, cat: 'travel' });
    pass('a date after today is a plan by itself — nothing to tick',
      (await count('[data-life-plan-auto]')) === 1 && (await count('[data-life-plan-input]')) === 0);
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
      JSON.stringify(await titles()) === JSON.stringify(['초등학교 입학', '대학 입학', '첫 직장', '첫 직장 입사', '세계 여행']), JSON.stringify(await titles()));
    const order = await page.$$eval('[data-life-timeline] > li', (els) => els.map((e) => (e.hasAttribute('data-life-today') ? 'today' : e.getAttribute('data-life-moment') ? 'm' : '')).filter(Boolean));
    pass('today sits between the past and the plans', order.indexOf('today') === 4, order.join(','));

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
    pass('wide screen: cards alternate left and right of the line',
      sides.length >= 5 && /^(LR)*L?$/.test(sides), sides);

    // 7. It all survives a reload.
    await openLife();
    pass('moments survive a reload', (await count('[data-life-moment]')) === 5);
    pass('ages are shown in 만 나이', (await page.locator('[data-life-moment]', { hasText: '첫 직장 입사' }).innerText()).includes('25세'));

    // 8. Edit and delete through the card.
    await page.locator('[data-life-moment]', { hasText: '첫 직장 입사' }).locator('button[aria-label]').click();
    await wait(300);
    await page.locator('[data-life-title-input]').fill('첫 회사');
    await save();
    pass('a card opens its editor, and the edit shows', (await titles()).includes('첫 회사'));

    // 8b. Who was there — the people from the relation map, by name.
    const openMoment = async (title) => {
      await page.locator('[data-life-moment]', { hasText: title }).locator('button[aria-label]').click();
      await wait(300);
    };
    await openMoment('첫 회사');
    pass('with nobody on the relation map, the form says where people come from',
      (await count('[data-life-who-empty]')) === 1);
    await page.keyboard.press('Escape');
    await wait(300);
    await page.evaluate(() => localStorage.setItem('24h-circle-planner.relation', JSON.stringify({
      version: 2, me: {}, updatedAt: '',
      people: [
        { id: 'r1', name: '윤도현', group: 'work', closeness: 4, createdAt: '' },
        { id: 'r2', name: '정하윤', group: 'friend', closeness: 3, createdAt: '' },
      ],
      links: [],
    })));
    await openLife();
    await openMoment('첫 회사');
    await page.locator('[data-life-who-search]').fill('도현');
    await wait(150);
    await page.locator('[data-life-who-option="r1"]').click();
    await save();
    const firstJob = (await stored()).milestones.find((m) => m.title === '첫 회사');
    pass('a moment keeps who was there — as ids, not names',
      JSON.stringify(firstJob?.who) === JSON.stringify(['r1']), JSON.stringify(firstJob));
    pass('…and the card names them',
      (await page.locator('[data-life-moment]', { hasText: '첫 회사' }).locator('[data-life-who]').innerText()).includes('윤도현'));
    // Renamed on the map, renamed on the line: only the id was ever kept.
    await page.evaluate(() => {
      const k = '24h-circle-planner.relation';
      const d = JSON.parse(localStorage.getItem(k));
      d.people[0].name = '윤도현 팀장';
      localStorage.setItem(k, JSON.stringify(d));
    });
    await openLife();
    pass('…and somebody renamed on the map is renamed on the line',
      (await page.locator('[data-life-moment]', { hasText: '첫 회사' }).locator('[data-life-who]').innerText()).includes('윤도현 팀장'));
    const del = async (title) => {
      await page.locator('[data-life-moment]', { hasText: title }).locator('button[aria-label]').click();
      await wait(300);
      await page.locator('[data-life-delete]').click();
      await page.locator('[data-life-delete]').click();
      await wait(400);
    };
    await del('대학 입학');
    const afterDelete = (await stored()).milestones.length;
    pass('delete asks twice, then removes', !(await titles()).includes('대학 입학') && afterDelete === 4);
    // …and it can be taken back.
    await page.getByRole('button', { name: '되돌리기' }).last().click();
    await wait(500);
    pass('a deleted moment can be taken back',
      (await stored()).milestones.length === 5 && (await titles()).includes('대학 입학'));
    await del('대학 입학');
    pass('…and deleting it again sticks', (await stored()).milestones.length === 4);

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
    const decorFab = await page.locator('[data-life-decor-fab]').boundingBox();
    pass('decorating is the round button to its left', !!decorFab
      && decorFab.x + decorFab.width <= fab.x
      && Math.abs((decorFab.y + decorFab.height) - (fab.y + fab.height)) < 4,
      JSON.stringify({ decorFab, fab }));
    await page.locator('[data-life-filter-toggle]').click();
    await wait(200);
    const chipsBox = await page.locator('[data-life-filters]').boundingBox();
    pass('…and its choices unfold above it', !!chipsBox && chipsBox.y + chipsBox.height <= fab.y);
    await page.locator('[data-life-filter="travel"]').click();
    await wait(300);
    pass('a category filter shows only its moments', JSON.stringify(await titles()) === JSON.stringify(['세계 여행']), JSON.stringify(await titles()));
    await page.locator('[data-life-filters] button').first().click();
    await wait(300);
    pass('"all" brings everything back', (await titles()).length === 4);

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
      && (await count('[data-life-moment]')) === 4);
    await openLife();
    pass('…and it stays after a reload', (await count('[data-life-moment]')) === 4);

    // 15. The free limit stops adding — and nothing is lost.
    await page.evaluate((k) => {
      const life = JSON.parse(localStorage.getItem(k));
      life.milestones = Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, date: String(1990 + i), title: `사건 ${i + 1}`, category: 'other' }));
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

    // 15b. Another life beside mine — the same drawing again, not a chart.
    await page.locator('[data-life-line-add]').scrollIntoViewIfNeeded();
    pass('mine is the only line until somebody is added',
      (await count('[data-life-column]')) === 1 && (await count('[data-life-column="me"]')) === 1);
    pass('…and the board can still be taken in and out on its own',
      (await count('[data-life-board-in]')) === 1 && (await count('[data-life-board-out]')) === 1);
    await page.locator('[data-life-line-add]').click();
    await wait(500);
    await page.locator('[data-life-line-name]').fill('이정숙');
    await page.locator('#life-line-birth-y').fill('1958');
    await page.locator('#life-line-birth-m').selectOption('3');
    await page.locator('#life-line-birth-d').selectOption('2');
    await page.locator('[data-life-line-save]').click();
    await wait(800);
    const withLine = await stored();
    const her = withLine.others?.[0]?.id ?? '';
    pass('somebody else can be put beside it',
      withLine.others?.length === 1 && withLine.others[0].name === '이정숙',
      JSON.stringify(withLine.others));
    pass('…and they are drawn as a life of their own, in the same hand',
      (await count('[data-life-column]')) === 2 && (await count('[data-life-timeline]')) === 2
      && (await count(`[data-life-column="${her}"]`)) === 1);
    pass('…starting at their own birth, with their own name on it',
      (await count(`[data-life-column="${her}"] [data-life-birth]`)) === 1
      && /이정숙/.test(await page.locator(`[data-life-column="${her}"] [data-life-birth]`).innerText())
      && /1958/.test(await page.locator(`[data-life-column="${her}"] [data-life-birth]`).innerText()));
    pass('today is at the same height on every line', await page.evaluate(() => {
      const dots = [...document.querySelectorAll('[data-life-column] [data-life-today] .life-pulse')]
        .map((d) => d.getBoundingClientRect().top);
      return dots.length === 2 && Math.abs(dots[0] - dots[1]) < 1.5;
    }));
    pass('…and so is every decade', await page.evaluate(() => {
      const cols = [...document.querySelectorAll('[data-life-column]')];
      const rows = cols.map((c) => [...c.querySelectorAll('li[data-life-decade]')]);
      const year = (row) => (row.querySelector('[data-life-label]') ?? row).getBoundingClientRect().top;
      if (rows[0].length !== rows[1].length) return false;
      return rows[0].every((row, i) => Math.abs(year(row) - year(rows[1][i])) < 1.5
        && row.dataset.year === rows[1][i].dataset.year);
    }));
    pass('…and the two columns stand side by side, not one under the other',
      await page.evaluate(() => {
        const [a, b] = [...document.querySelectorAll('[data-life-column]')].map((c) => c.getBoundingClientRect());
        return !!b && b.left >= a.right - 1 && Math.abs(a.top - b.top) < 2;
      }));

    // The board can be taken in and out, which is what several lines need.
    const zoomNow = () => page.locator('[data-life-board-zoom]').getAttribute('data-life-board-zoom');
    const wasZoom = Number(await zoomNow());
    await page.locator('[data-life-board-in]').click();
    await wait(400);
    pass('the board zooms in', Number(await zoomNow()) > wasZoom, `${wasZoom} → ${await zoomNow()}`);
    await page.locator('[data-life-board-out]').click();
    await page.locator('[data-life-board-out]').click();
    await wait(400);
    pass('…and out again', Number(await zoomNow()) < wasZoom);

    await page.locator('[data-life-line-add]').click();
    await wait(600);
    pass('a third life is where the free plan stops',
      (await page.getByRole('dialog', { name: 'Pro로 업그레이드' }).count()) === 1
      && (await count('[data-life-line-dialog]')) === 0);
    await closeAll();
    pass('…and the one already there is untouched', (await stored()).others.length === 1);

    // Folding somebody away is a way of looking, not a change to the record.
    await page.locator(`[data-life-line-toggle="${her}"]`).click();
    await wait(500);
    pass('a line can be folded away without being deleted',
      (await count('[data-life-column]')) === 1 && (await stored()).others.length === 1);
    await page.locator(`[data-life-line-toggle="${her}"]`).click();
    await wait(500);
    pass('…and brought back', (await count('[data-life-column]')) === 2);

    // A name carries the way to let that line go, beside it.
    pass('every other line offers to be taken off the page',
      (await count(`[data-life-line-remove="${her}"]`)) === 1
      && (await count('[data-life-line-remove="me"]')) === 0);
    await page.locator(`[data-life-line-remove="${her}"]`).click();
    await wait(500);
    pass('…and it asks before it does', (await count('[data-life-line-drop]')) === 1
      && ((await stored()).others ?? []).length === 1);
    await closeAll();
    pass('…and says no by saying nothing', ((await stored()).others ?? []).length === 1);
    await page.locator(`[data-life-line-remove="${her}"]`).click();
    await wait(500);
    await page.locator('[data-life-line-drop-yes]').click();
    await wait(600);
    pass('…and takes them off the page once told to',
      ((await stored()).others ?? []).length === 0 && (await count('[data-life-column]')) === 1);
    await page.getByRole('button', { name: '되돌리기' }).click();
    await wait(700);
    pass('…and the toast puts them back, moments and all',
      (await stored()).others.length === 1 && (await stored()).others[0].name === '이정숙'
      && (await count('[data-life-column]')) === 2);

    // 15b2. Whose line goes where: the names are dragged along the row.
    await page.evaluate((k) => {
      const life = JSON.parse(localStorage.getItem(k));
      life.others = [
        { id: 'o1', name: '첫째', birthDate: '1960-01-02', milestones: [] },
        { id: 'o2', name: '둘째', birthDate: '1970-01-02', milestones: [] },
      ];
      localStorage.setItem(k, JSON.stringify(life));
    }, LIFE_KEY);
    await openLife();
    await closeAll();
    const columns = async () => page.$$eval('[data-life-column]', (els) => els.map((e) => e.dataset.lifeColumn));
    pass('the lines are drawn in the order the record holds them',
      (await columns()).join() === 'me,o1,o2', (await columns()).join());
    await page.dragAndDrop('[data-life-line-toggle="o2"]', '[data-life-line-toggle="o1"]');
    await wait(600);
    pass('…and a name dragged past another takes its column with it',
      (await columns()).join() === 'me,o2,o1', (await columns()).join());
    pass('…and the new order is kept in the record',
      (await stored()).others.map((o) => o.id).join() === 'o2,o1');
    // The same move without a mouse, which is the only way on a phone.
    await page.locator('[data-life-line-toggle="o2"]').focus();
    await page.keyboard.press('Alt+ArrowRight');
    await wait(500);
    pass('…and alt with an arrow does it from the keyboard',
      (await columns()).join() === 'me,o1,o2', (await columns()).join());
    pass('mine stays the first line, whatever is moved',
      (await columns())[0] === 'me');

    // 15c. A wide screen holds them all; a phone holds two.
    await page.evaluate((k) => {
      const life = JSON.parse(localStorage.getItem(k));
      life.others = ['a', 'b', 'c'].map((id, i) => ({
        id, name: `사람 ${id}`, birthDate: `${1950 + i * 10}-03-02`,
        milestones: [{ id: `${id}m`, date: String(1990 + i), title: `일 ${id}`, category: 'other' }],
      }));
      localStorage.setItem(k, JSON.stringify(life));
    }, LIFE_KEY);
    await openLife();
    await closeAll();
    pass('a wide screen holds every line there is', (await count('[data-life-column]')) === 4);
    pass('…and stands back far enough to show them',
      Number(await zoomNow()) < 1, await zoomNow());
    // The whole point of reading them together: one day, one height.
    pass('a day two lines share is at one height on both', await page.evaluate(() => {
      const scale = parseFloat(getComputedStyle(document.querySelector('[data-life-board]')).zoom) || 1;
      const mark = (row) => {
        const pad = parseFloat(getComputedStyle(row).paddingTop) || 0;
        return row.getBoundingClientRect().top + (pad + Number(row.dataset.lifeAnchor ?? 0)) * scale;
      };
      const cols = [...document.querySelectorAll('[data-life-column]')].map((c) => {
        const map = new Map();
        for (const row of c.querySelectorAll('li[data-life-at]')) {
          if (!map.has(row.dataset.lifeAt)) map.set(row.dataset.lifeAt, mark(row));
        }
        return map;
      });
      let shared = 0;
      for (const key of cols[0].keys()) {
        const all = cols.map((m) => m.get(key)).filter((v) => v !== undefined);
        if (all.length < 2) continue;
        shared += 1;
        if (Math.max(...all) - Math.min(...all) > 1.5) return false;
      }
      // The decades alone would pass this; the seeded moment is the real test.
      return shared > 3;
    }));
    // Halfway down the page, each line still says whose it is: the name rides
    // on it under the header once the row of names has scrolled away.
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(400);
    pass('at the top, the row of names says whose line is whose (no tags yet)',
      (await count('[data-life-name-tag]')) === 4 && (await count('[data-life-name-tag][data-shown]')) === 0);
    await page.evaluate(() => {
      document.querySelector('[data-life-column="me"] [data-life-today]')?.scrollIntoView({ block: 'center' });
    });
    await wait(500);
    const tags = await page.evaluate(() => {
      const header = document.querySelector('[data-app-header]').getBoundingClientRect().bottom;
      return [...document.querySelectorAll('[data-life-name-tag][data-shown]')].map((el) => {
        const r = el.getBoundingClientRect();
        const col = el.closest('[data-life-column]').getBoundingClientRect();
        return { text: el.textContent.trim(), top: Math.round(r.top - header), inside: r.left >= col.left - 2 && r.right <= col.right + 2 };
      });
    });
    pass('scrolled down, every line carries the name of whose it is, just under the header',
      tags.length === 4 && tags.every((t) => t.text && t.top >= 0 && t.top < 30 && t.inside), JSON.stringify(tags));
    // Zoomed out, the circle that offers a new moment still lands under the
    // pointer: it is written in the board's pixels, not the screen's.
    // Somewhere on my own line and BELOW its first marker — nothing may be
    // added above a birth, so a point above it would rightly do nothing.
    await page.evaluate(() => {
      document.querySelector('[data-life-column="me"] [data-life-birth]')
        ?.scrollIntoView({ block: 'center' });
    });
    await wait(400);
    const mePlace = await page.evaluate(() => {
      const ol = document.querySelector('[data-life-column="me"] [data-life-timeline]').getBoundingClientRect();
      const marker = document.querySelector('[data-life-column="me"] [data-life-birth] [data-life-marker]');
      const under = (marker ? marker.getBoundingClientRect().bottom : ol.top) + 40;
      return { x: ol.left + ol.width / 2, y: Math.min(innerHeight - 40, under) };
    });
    await page.mouse.move(mePlace.x, mePlace.y);
    await wait(300);
    const ghost = await page.evaluate(() => {
      const g = document.querySelector('[data-life-ghost]');
      if (!g) return null;
      const r = g.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    pass('the + follows the pointer even on a zoomed-out board',
      !!ghost && Math.abs(ghost.x - mePlace.x) < 6 && Math.abs(ghost.y - mePlace.y) < 6,
      JSON.stringify({ ghost, at: mePlace }));
    await page.setViewportSize({ width: 390, height: 844 });
    await wait(600);
    pass('a phone holds two: mine, and the one chosen',
      (await count('[data-life-column]')) === 2 && (await count('[data-life-column="me"]')) === 1);
    await page.locator('[data-life-line-toggle="c"]').click();
    await wait(500);
    pass('…and choosing another swaps it, rather than squeezing it in',
      (await count('[data-life-column]')) === 2 && (await count('[data-life-column="c"]')) === 1);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await wait(500);
    await page.evaluate((k) => {
      const life = JSON.parse(localStorage.getItem(k));
      delete life.others;
      localStorage.setItem(k, JSON.stringify(life));
    }, LIFE_KEY);
    await openLife();
    await closeAll();

    // 16. Cards fade in as they scroll in. The page opens with today in the
    // middle of the screen, so the two ends of the line have both been seen;
    // a moment from the middle of the life is the one still waiting.
    const far = page.locator('[data-life-moment] .life-reveal').nth(14);
    pass('a card off the screen waits to fade in', (await far.evaluate((el) => getComputedStyle(el).opacity)) === '0');
    await far.scrollIntoViewIfNeeded();
    await wait(600);
    pass('…and shows once scrolled to', (await far.evaluate((el) => getComputedStyle(el).opacity)) === '1');

    // 16b. A read-only link for the family.
    await headerExport();
    await page.locator('[data-life-share-hide]').check();
    await page.locator('[data-life-share]').click();
    await page.waitForSelector('[data-life-share-url]', { timeout: 15000 });
    const shareUrl = await page.locator('[data-life-share-url]').inputValue();
    pass('a share link is made', /\/s\/share\d+$/.test(shareUrl), shareUrl);
    await page.keyboard.press('Escape');
    await page.goto(`${base}/s/${shareUrl.split('/').pop()}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-life-timeline]', { timeout: 15000 });
    await wait(500);
    const shared = await page.$$eval('[data-life-moment] .life-serif', (els) => els.map((e) => e.textContent));
    pass('…that opens as a line of its own', shared.length === 30, `${shared.length} moments`);
    pass('…read-only: nothing to press, and no + on the line',
      (await page.locator('[data-life-moment] button').count()) === 0 && (await count('[data-life-add]')) === 0);
    pass('…and it left the names out', !(await page.locator('body').innerText()).includes('이정숙'));

    // 16b2. The other half of a share: whoever opens it can keep the line.
    pass('a reader is offered the line to keep', (await count('[data-life-keep]')) === 1);
    await page.locator('[data-life-keep]').click();
    await wait(600);
    const said = await page.locator('[data-life-keep-said]').innerText().catch(() => '(nothing said)');
    await wait(1200);
    const keptRecord = await stored();
    pass('…and it lands beside their own, with its moments',
      keptRecord.others?.length === 1 && keptRecord.others[0].milestones.length === 30
      && keptRecord.others[0].birthDate === '1985-05-15',
      `${said} · ${JSON.stringify({ n: keptRecord.others?.length, m: keptRecord.others?.[0]?.milestones.length })}`);
    pass('…and their own line is untouched',
      keptRecord.milestones.length === 30 && keptRecord.profile.birthDate === '1985-05-15');
    pass('…and a line shared without a name is called by its year',
      keptRecord.others[0].name === '1985', keptRecord.others?.[0]?.name);
    await openLife();
    await closeAll();
    pass('…and it is drawn as a column of its own', (await count('[data-life-column]')) === 2);
    // Read twice is still one person; and a third is where the free plan stops.
    await page.goto(`${base}/s/${shareUrl.split('/').pop()}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-life-keep]', { timeout: 15000 });
    await page.locator('[data-life-keep]').click();
    await wait(1600);
    pass('…and opening the same link again does not make two of them',
      (await stored()).others.length === 1);
    await page.evaluate((k) => {
      const life = JSON.parse(localStorage.getItem(k));
      delete life.others;
      localStorage.setItem(k, JSON.stringify(life));
    }, LIFE_KEY);
    await openLife();

    // 16c. The calendar shows the line's birthdays and pinned anniversaries.
    await page.evaluate((k) => {
      const now = new Date();
      const life = JSON.parse(localStorage.getItem(k));
      const pad = (n) => String(n).padStart(2, '0');
      const md = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      life.profile.birthDate = `1985-${md}`;
      life.milestones = [{ id: 'p1', date: `2015-${md}`, title: '결혼', category: 'relationship', pinned: true }];
      localStorage.setItem(k, JSON.stringify(life));
      localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs: { language: 'ko', chartView: 'calendar' } }));
    }, LIFE_KEY);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-calendar-view]', { timeout: 15000 });
    await wait(800);
    const today = new Date();
    const todayCell = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const chips = await page.locator(`[data-day="${todayCell}"]`).first().innerText();
    pass('the calendar carries the birthday and the pinned anniversary',
      /생일/.test(chips) && /결혼/.test(chips), JSON.stringify(chips));
    pass('…read-only, like an imported calendar',
      (await page.locator(`[data-day="${todayCell}"] [data-event][data-imported]`).count()) >= 2);
    await page.locator('[data-app-header] button[aria-label="설정"]').click();
    await wait(300);
    await page.locator('[data-life-cal-toggle]').click();
    await wait(600);
    await page.keyboard.press('Escape');
    await wait(400);
    pass('…and the ⚙ switch takes them away',
      !/생일/.test(await page.locator(`[data-day="${todayCell}"]`).first().innerText()));
    await openLife();

    // 16d. Decorating the line (다꾸) — Pro only.
    await page.locator('button[aria-label="디자인"]').click();
    await wait(300);
    pass('the 디자인 menu offers 라이프 꾸미기', (await count('[data-life-decor-tool]')) === 3);
    await page.locator('[data-life-decor-tool="sticker"]').click();
    await wait(500);
    pass('a free account is offered Pro instead of the tray',
      (await count('[data-decor-tray]')) === 0 && (await page.getByRole('dialog', { name: 'Pro로 업그레이드' }).count()) === 1);
    await closeAll();
    await page.locator('[data-life-decor-fab]').click();
    await wait(500);
    pass('…and the corner button asks the same question',
      (await count('[data-decor-tray]')) === 0 && (await page.getByRole('dialog', { name: 'Pro로 업그레이드' }).count()) === 1);
    await closeAll();
    me.plan = 'pro';
    // Pro turns sync on, which asks its privacy question once: answer it here.
    await page.evaluate(() => localStorage.setItem('24h-circle-planner.sync-consent', '1'));
    await openLife();
    await closeAll();
    await page.locator('button[aria-label="디자인"]').click();
    await wait(300);
    await page.locator('[data-life-decor-tool="sticker"]').click();
    await wait(600);
    pass('with Pro, the tray opens on the line', (await count('[data-decor-tray]')) === 1 && (await count('[data-life-decor-on]')) === 1);
    pass('…and the corner button reads as pressed while it is open',
      (await page.locator('[data-life-decor-fab]').getAttribute('aria-pressed')) === 'true');
    await page.locator('[data-sticker]').first().click();
    await wait(300);
    // The page opens on today, so bring the birth row into view before aiming.
    await page.locator('[data-life-birth]').scrollIntoViewIfNeeded();
    await wait(300);
    // Somewhere on the birth row that the decor layer itself would receive:
    // a fixed fraction of the row lands on the card once the type size
    // changes, and then the sticker goes nowhere at all.
    const stickerSpot = await page.evaluate(() => {
      const el = document.querySelector('[data-life-birth] [data-life-row-decor]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      for (let fx = 0.05; fx < 0.96; fx += 0.05) {
        for (const fy of [0.5, 0.25, 0.75]) {
          const x = r.x + r.width * fx;
          const y = r.y + r.height * fy;
          if (document.elementFromPoint(x, y) === el) return { x, y };
        }
      }
      return null;
    });
    pass('the line has somewhere a sticker can actually be put', !!stickerSpot);
    await page.mouse.click(stickerSpot.x, stickerSpot.y);
    await wait(500);
    const stored3 = () => page.evaluate(() => JSON.parse(localStorage.getItem('24h-circle-planner.life-decor') ?? 'null'));
    pass('a sticker lands on the row it was placed on',
      (await count('[data-life-decor-item]')) === 1 && !!(await stored3())?.rows?.birth?.length, JSON.stringify(await stored3()));
    await openLife();
    pass('…and it is still there after a reload', (await count('[data-life-decor-item]')) === 1);

    // 16e. 자서전 — bought once, written from the line, kept on the device.
    await closeAll();
    memoir.enabled = true;
    memoir.signedIn = true;
    await openLife();
    await closeAll();
    pass('with too little written down, nothing is offered', (await count('[data-life-memoir]')) === 0);
    // Three moments is where a life becomes something worth writing about.
    await page.evaluate((k) => {
      const life = JSON.parse(localStorage.getItem(k));
      life.milestones = [1990, 2004, 2010, 2016].map((y, i) => (
        { id: `mm${i}`, date: String(y), title: `사건 ${i + 1}`, category: 'other' }));
      localStorage.setItem(k, JSON.stringify(life));
    }, LIFE_KEY);
    await openLife();
    await closeAll();
    pass('the memoir section shows once the server has a writer', (await count('[data-life-memoir]')) === 1);
    pass('…and asks the price of one, not of a subscription',
      /\$1\.00/.test(await page.locator('[data-life-memoir-start]').innerText()),
      await page.locator('[data-life-memoir-start]').innerText());
    await page.locator('[data-life-memoir-start]').click();
    await wait(400);
    const ask = await page.locator('[data-life-memoir-dialog]').innerText();
    pass('what leaves the device is said before it leaves',
      /사진은 보내지 않습니다/.test(ask) && /구독이 아닙니다/.test(ask), ask.replace(/\n/g, ' ').slice(0, 90));
    // Nothing is paid for yet: the button goes to the till, not to the writer.
    await page.locator('[data-life-memoir-go]').click();
    await page.waitForSelector('[data-life-memoir-dialog]', { timeout: 20000 });
    await wait(600);
    pass('with nothing paid for, it goes to the till and not to the writer',
      checkouts.length === 1 && memoirCalls.length === 0, `${checkouts.length} / ${memoirCalls.length}`);
    pass('…and the purchase is claimed on the way back, webhook or no webhook',
      claims.length === 1 && claims[0] === 'co_test1234', JSON.stringify(claims));
    pass('…and the form is open and waiting', (await count('[data-life-memoir-dialog]')) === 1);
    pass('…with the address tidied up again',
      !page.url().includes('memoir=') && !page.url().includes('checkout_id'), page.url());
    await page.locator('[data-life-memoir-wish]').fill('담담하게');
    await page.locator('[data-life-memoir-go]').click();
    await wait(1600);
    const sent = memoirCalls[0] ?? {};
    pass('the writer is given the line, the wish and no picture',
      (sent.moments?.length ?? 0) >= 3 && sent.wish === '담담하게'
      && !JSON.stringify(sent).includes('photo'), JSON.stringify(sent).slice(0, 140));
    pass('…and the birthday, which is what makes the ages true',
      /^\d{4}-\d{2}-\d{2}$/.test(sent.birthDate ?? ''), String(sent.birthDate));
    pass('the memoir is laid out as chapters and paragraphs',
      (await page.locator('[data-life-memoir-text] h4').count()) === 2
      && (await page.locator('[data-life-memoir-text] p').count()) === 3);
    pass('…and is kept in the record on this device',
      /나는 1985년에 태어났다/.test((await stored())?.memoir?.text ?? ''));
    await openLife();
    await closeAll();
    pass('…and is still there after a reload', (await count('[data-life-memoir-text]')) === 1);
    pass('a second one has to be paid for again',
      /다시 쓰기/.test(await page.locator('[data-life-memoir-start]').innerText()));

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
    const want = ['life_open', 'life_start', 'life_add', 'life_image:downloaded', 'life_backup:json', 'upgrade_open:life',
      'memoir_buy', 'memoir_paid', 'memoir_write'];
    await flush();
    pass('usage is counted', want.every((w) => counted.includes(w)), `missing ${want.filter((w) => !counted.includes(w)).join(',')} · saw ${[...new Set(counted)].join(',')}`);
  } finally {
    await browser.close();
  }

  // 18. Reduced motion: nothing waits to fade in.
  const calm = await setup(base, { reducedMotion: 'reduce' });
  try {
    await calm.page.evaluate((k) => {
      localStorage.setItem(k, JSON.stringify({
        version: 1, profile: { birthDate: '1985-05-15' }, family: [], endingNote: null, updatedAt: '',
        milestones: Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, date: String(1990 + i), title: `사건 ${i + 1}`, category: 'other' })),
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
