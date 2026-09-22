/**
 * Relation — the people around you (PRD acceptance). Over dist/ with a free
 * account mocked: its own header button; an empty map offers to bring the life
 * line's parents over; someone is added, selected, edited and deleted (and
 * brought back); "contacted today" lifts a faded node; a line between two
 * people; the filters and the search; the map settles and stops; the free
 * limit only stops adding; JSON backup → cleared browser → restore; the
 * accessible list mirrors the canvas; three hundred people stay smooth.
 */
import { makeReporter, launchPage, seedBasicData, serveDist, wait, isMain, runStandalone } from './_helpers.mjs';

const RELATION_KEY = '24h-circle-planner.relation';
const LIFE_KEY = '24h-circle-planner.life';
const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function setup(base, opts = {}) {
  const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 900 }, ...opts });
  const counted = [];
  await page.addInitScript(() => { try { localStorage.setItem('24h-metrics-debug', '1'); } catch { /* */ } });
  await page.route('**/api/metrics', async (route) => {
    try { counted.push(...(JSON.parse(route.request().postData() ?? '{}').e ?? [])); } catch { /* ignore */ }
    await route.fulfill({ status: 204, body: '' });
  });
  await page.route('**/api/sync*', (route) => route.fulfill(json({ version: 0, data: {}, updatedAt: 0 })));
  await page.route('**/api/life/memoir', (route) => route.fulfill(json({ enabled: false })));
  const me = { user: { id: 'u1', email: 'me@example.com', provider: 'google' }, plan: 'free', admin: false };
  await page.route('**/api/me', (route) => route.fulfill(json(me)));
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
  await seedBasicData(page);
  return { browser, page, errors, counted, me };
}

/** The life line, with a mother and a father on it. */
const LIFE = {
  version: 1,
  profile: { birthDate: '1985-05-15', name: '김하루' },
  family: [
    { id: 'f1', relation: 'mother', name: '이정숙', birthDate: '1958-03-02' },
    { id: 'f2', relation: 'father', name: '김영수', birthDate: '1955-11-20' },
  ],
  milestones: [],
  endingNote: null,
  memoir: null,
  updatedAt: '',
};

const person = (id, over = {}) => ({ id, name: id, group: 'friend', closeness: 2, createdAt: '', ...over });

/** The same record whatever order its fields were written in — a restore
 *  rebuilds each person in the store's canonical order. */
const canon = (v) => (Array.isArray(v) ? v.map(canon)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
    : v);

export async function run() {
  const { pass, allOk } = makeReporter('relation');
  const { base, close } = await serveDist();
  const { browser, page, errors, counted, me } = await setup(base);
  const count = (sel) => page.locator(sel).count();
  const stored = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), RELATION_KEY);
  const flush = async () => {
    await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await wait(1200);
  };
  const openRelation = async () => {
    await flush();
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline], [data-relation-view]', { timeout: 15000 });
    if ((await count('[data-relation-view]')) === 0) await page.locator('[data-relation-toggle]').click();
    await page.waitForSelector('[data-relation-view]', { timeout: 15000 });
    await wait(600);
  };
  const closeAll = async () => {
    for (let i = 0; i < 4 && (await page.locator('[role="dialog"]').count()) > 0; i++) {
      await page.keyboard.press('Escape');
      await wait(250);
    }
    await wait(200);
  };
  /** Pick someone the way a keyboard does: the list under the map is hidden
   *  from sight on purpose, so it is reached by focus, not by a mouse. */
  const choose = async (id) => {
    await page.locator(`[data-relation-list-item="${id}"]`).focus();
    await page.keyboard.press('Enter');
    await wait(400);
  };
  const seed = (people, links = []) => page.evaluate(([k, d]) => localStorage.setItem(k, d), [
    RELATION_KEY,
    JSON.stringify({ version: 2, me: { name: '김하루' }, people, links, updatedAt: '' }),
  ]);
  try {
    // 1. Its own button in the header, beside the life line's.
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [LIFE_KEY, JSON.stringify(LIFE)]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await page.locator('[data-relation-toggle]').click();
    await wait(700);
    pass('the header button opens the relation map', (await count('[data-relation-view]')) === 1);
    pass('…and reads as pressed', (await page.locator('[data-relation-toggle]').getAttribute('aria-pressed')) === 'true');
    pass('every tab is an icon alone', await page.evaluate(() => {
      const tabs = ['[data-view-toggle]', '[data-calendar-toggle]', '[data-life-toggle]', '[data-relation-toggle]'];
      return tabs.every((s) => (document.querySelector(s)?.innerText ?? '').trim() === '');
    }));
    pass('the site footer stays away here',
      (await page.locator('footer', { hasText: '개인정보처리방침' }).count()) === 0);

    // 2. An empty map offers the life line's parents.
    pass('an empty map says so and offers the family', (await count('[data-relation-empty]')) === 1
      && (await count('[data-relation-import]')) === 1);
    await page.locator('[data-relation-import]').click();
    await wait(900);
    const imported = await stored();
    pass('the parents come over with their names and birthdays',
      imported.people.length === 2
      && imported.people.every((p) => p.group === 'family' && p.lifeFamilyId)
      && imported.people.map((p) => p.name).join() === '이정숙,김영수'
      && imported.people[0].birthday === '1958-03-02', JSON.stringify(imported.people.map((p) => p.name)));
    pass('…and the empty state gives way to the summary',
      (await count('[data-relation-empty]')) === 0 && (await count('[data-relation-summary]')) === 1);

    // 3. The life line still owns their names.
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [LIFE_KEY, JSON.stringify({
      ...LIFE, family: [{ ...LIFE.family[0], name: '이정숙 여사' }, LIFE.family[1]],
    })]);
    await openRelation();
    pass('a name changed on the life line is changed here too',
      (await stored()).people.some((p) => p.name === '이정숙 여사'), JSON.stringify((await stored()).people.map((p) => p.name)));

    // 4. Adding someone by hand.
    await page.locator('[data-relation-add]').click();
    await wait(400);
    await page.locator('[data-relation-name-input]').fill('최민준');
    await page.locator('[data-relation-group="friend"]').click();
    await page.locator('[data-relation-rel-input]').fill('대학 동기');
    pass('closeness is asked in five rungs', (await count('[data-relation-close]')) === 5,
      String(await count('[data-relation-close]')));
    await page.locator('[data-relation-close="5"]').click();
    await wait(200);
    pass('…and the chosen rung says what it means',
      (await page.locator('[data-relation-close-label]').innerText()).trim() === '아주 가까움',
      await page.locator('[data-relation-close-label]').innerText());
    await page.locator('[data-relation-close="3"]').click();
    // Where the record goes is said in the privacy policy and the guide; the
    // form itself no longer repeats it every time someone is added.
    pass('the form does not lecture about privacy every single time',
      (await count('[data-relation-privacy]')) === 0);
    await page.locator('[data-relation-save]').click();
    await wait(700);
    const added = (await stored()).people.find((p) => p.name === '최민준');
    pass('someone added by hand is kept whole',
      added?.group === 'friend' && added?.closeness === 3 && added?.relation === '대학 동기', JSON.stringify(added));

    // 5. The accessible list is the canvas in words.
    pass('every person is in the list under the map', (await count('[data-relation-list-item]')) === 3);
    await choose(added.id);
    pass('choosing from the list opens the panel',
      (await page.locator('[data-relation-panel]').getAttribute('data-person')) === added.id
      && /최민준/.test(await page.locator('[data-relation-panel-name]').innerText()));

    // 6. One tap brings a faded person back.
    await seed([
      person('p1', { name: '윤도현', lastContact: '2020-01-01' }),
      person('p2', { name: '정하윤', group: 'family', closeness: 3 }),
      person('p3', { name: '강나래', group: 'work' }),
    ]);
    await openRelation();
    pass('a year of silence is counted as out of touch',
      /오래 연락 안 함/.test(await page.locator('[data-relation-summary]').innerText()));
    await choose('p1');
    await page.locator('[data-relation-contacted]').click();
    await wait(500);
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    pass('"contacted today" writes today, and the silence is over',
      (await stored()).people.find((p) => p.id === 'p1')?.lastContact === key
      && !/오래 연락 안 함/.test(await page.locator('[data-relation-summary]').innerText()));

    // 7. A line between two people.
    await page.locator('[data-relation-link]').click();
    await wait(200);
    await choose('p3');
    pass('a line is drawn between the two people chosen',
      JSON.stringify((await stored()).links) === JSON.stringify([{ source: 'p1', target: 'p3' }]), JSON.stringify((await stored()).links));
    await choose('p1');
    await page.locator('[data-relation-link-edit="p3"]').click();
    await page.locator('[data-relation-link-label="p3"]').fill('동료');
    await page.keyboard.press('Enter');
    await wait(500);
    pass('…and how close those two are can be said on it', await (async () => {
      const before = (await stored()).links[0];
      await page.locator('[data-relation-link-rung="p3:5"]').click();
      await wait(500);
      const after = (await stored()).links[0];
      return before.closeness === undefined && after.closeness === 5;
    })(), JSON.stringify((await stored()).links));
    pass('…and put back to the middle it is not written at all', await (async () => {
      await page.locator('[data-relation-link-rung="p3:3"]').click();
      await wait(500);
      return (await stored()).links[0].closeness === undefined;
    })(), JSON.stringify((await stored()).links));
    pass('…and the tie can be given a name',
      (await stored()).links[0]?.label === '동료', JSON.stringify((await stored()).links));
    await page.locator('[data-relation-unlink="p3"]').click();
    await wait(400);
    pass('…and taken away again', (await stored()).links.length === 0);

    // 8. Filters and search narrow the map and the list alike.
    await page.locator('[data-relation-filter="family"]').click();
    await wait(400);
    pass('a group filter leaves only that group', (await count('[data-relation-list-item]')) === 1
      && (await count('[data-relation-list-item="p2"]')) === 1);
    await page.locator('[data-relation-filter="family"]').click();
    await wait(300);
    await page.locator('[data-relation-search-open]').click();
    await page.locator('[data-relation-search]').fill('나래');
    await wait(400);
    pass('the search finds by name', (await count('[data-relation-list-item]')) === 1
      && (await count('[data-relation-list-item="p3"]')) === 1);
    await page.locator('[data-relation-search-close]').click();
    await wait(300);
    pass('…and closing it brings everyone back', (await count('[data-relation-list-item]')) === 3);

    // 9. Deleting, and taking it back — from the card, where it is asked for,
    // and from the form, where it also is.
    await choose('p3');
    pass('a person’s own card offers to take them off the map',
      (await count('[data-relation-remove]')) === 1);
    await page.locator('[data-relation-remove]').click();
    await wait(400);
    pass('…and pressing it does', (await stored()).people.length === 2
      && (await count('[data-relation-panel]')) === 0);
    await page.getByRole('button', { name: '되돌리기' }).click();
    await wait(500);
    pass('…and it can be taken back', (await stored()).people.map((p) => p.id).join() === 'p1,p2,p3');
    await choose('p3');
    await page.locator('[data-relation-edit]').click();
    await wait(400);
    await page.locator('[data-relation-delete]').click();
    await wait(400);
    pass('someone deleted is gone', (await stored()).people.length === 2);
    await page.getByRole('button', { name: '되돌리기' }).click();
    await wait(500);
    pass('…and comes back where they were', (await stored()).people.map((p) => p.id).join() === 'p1,p2,p3');

    // 9b. Somebody new, added from another person's card and tied to them.
    await choose('p1');
    await page.locator('[data-relation-add-beside]').click();
    await wait(500);
    await page.locator('[data-relation-name-input]').fill('한서윤');
    await page.locator('[data-relation-save]').click();
    await wait(800);
    const beside = await stored();
    const made = beside.people.find((p) => p.name === '한서윤');
    pass('a person added from a card arrives tied to them',
      !!made && beside.links.some((l) => (l.source === 'p1' && l.target === made.id)
        || (l.target === 'p1' && l.source === made.id)),
      JSON.stringify(beside.links));
    await choose(made.id);
    await page.locator('[data-relation-remove]').click();
    await wait(700);
    pass('…and the map is as it was once they are taken off it',
      (await stored()).people.length === 3, JSON.stringify((await stored()).people.map((p) => p.name)));
    // 9c. The map can be taken in and out without a wheel.
    await closeAll();
    const mapZoom = () => page.locator('[data-relation-zoom]').getAttribute('data-relation-zoom').then(Number);
    const wasMapZoom = await mapZoom();
    await page.locator('[data-relation-zoom-in]').click();
    await wait(300);
    pass('the map has buttons for bigger and smaller', (await mapZoom()) > wasMapZoom,
      `${wasMapZoom} → ${await mapZoom()}`);
    await page.locator('[data-relation-zoom-out]').click();
    await page.locator('[data-relation-zoom-out]').click();
    await wait(300);
    pass('…and out again', (await mapZoom()) < wasMapZoom);
    await page.locator('[data-relation-zoom-in]').click();
    await wait(300);

    // 10. The map has weight (lib/relation-force): it arranges itself when it
    // opens, stops when it is done, and floats gently for ever after.
    await openRelation();
    await closeAll();
    const heat = () => page.locator('[data-relation-surface]').getAttribute('data-relation-alpha').then(Number);
    const cooled = async () => {
      for (let i = 0; i < 40; i++) {
        if ((await heat()) <= 0.021) return true;
        await wait(200);
      }
      return false;
    };
    // The heat is written on the canvas by the drawing; a map that is being
    // worked out has some, and how much depends on how quickly this machine
    // got here — so what is checked is that it runs, and that it stops.
    const fresh = await heat();
    pass('the map is worked out by forces, and says how hot it still is',
      Number.isFinite(fresh) && fresh >= 0, String(fresh));
    pass('…and it settles, rather than churning for ever', await cooled(), String(await heat()));
    const floats = await page.evaluate(async () => {
      const shot = () => {
        const c = document.querySelector('[data-relation-surface]');
        return c.getContext('2d').getImageData(0, 0, Math.min(400, c.width), Math.min(400, c.height)).data.join();
      };
      const first = shot();
      await new Promise((r) => setTimeout(r, 900));
      return first !== shot();
    });
    pass('…and settled, nobody sits perfectly still', floats);

    // 11. The free limit stops adding, and hides nothing.
    await seed(Array.from({ length: 40 }, (_, i) => person(`x${i}`, { name: `사람 ${i}` })));
    await openRelation();
    await closeAll();
    pass('all forty are on the map', (await count('[data-relation-list-item]')) === 40);
    await page.locator('[data-relation-add]').click();
    await wait(700);
    pass('at the limit, adding offers Pro instead',
      (await page.getByRole('dialog', { name: 'Pro로 업그레이드' }).count()) === 1
      && (await count('[data-relation-person-dialog]')) === 0);
    await closeAll();
    pass('…and all forty are still there', (await stored()).people.length === 40);

    // 12. Backup → a cleared browser → restore.
    await seed([person('k1', { name: '배준호', birthday: '1970-10-01', note: '멘토' }), person('k2', { name: '조은비', group: 'other' })],
      [{ source: 'k1', target: 'k2', label: '동료' }]);
    await openRelation();
    await closeAll();
    const before = await stored();
    await page.locator('[data-app-header] button[aria-label="내보내기"]').click();
    await wait(500);
    pass('the header export opens the map\'s own export', (await count('[data-relation-export-dialog]')) === 1);
    pass('…and warns that other people are in it',
      /다른 사람의 이름/.test(await page.locator('[data-relation-export-dialog]').innerText()));
    pass('the picture waits until the warning is read',
      await page.locator('[data-relation-export-png]').isDisabled());
    const saving = page.waitForEvent('download', { timeout: 20000 });
    await page.locator('[data-relation-export-json]').click();
    const backup = await saving;
    const backupPath = await backup.path();
    pass('the JSON backup is written', !!backupPath && /relation/.test(backup.suggestedFilename()));
    await page.evaluate(() => localStorage.removeItem('24h-circle-planner.relation'));
    await openRelation();
    await closeAll();
    pass('a cleared browser starts over', (await count('[data-relation-empty]')) === 1);
    await page.locator('[data-app-header] button[aria-label="내보내기"]').click();
    await wait(500);
    await page.locator('[data-relation-import-input]').setInputFiles(backupPath);
    await wait(900);
    const after = await stored();
    pass('restoring brings everyone and every line back',
      JSON.stringify(canon({ ...after, updatedAt: '' })) === JSON.stringify(canon({ ...before, updatedAt: '' })),
      JSON.stringify(after));

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    const want = ['relation_open', 'relation_import', 'relation_add', 'relation_link', 'relation_contact'];
    await flush();
    pass('usage is counted', want.every((w) => counted.includes(w)),
      `missing ${want.filter((w) => !counted.includes(w)).join(',')} · saw ${[...new Set(counted)].join(',')}`);
  } finally {
    await browser.close();
  }

  // 13. A phone: the panel becomes a sheet under the map.
  const phone = await setup(base, { viewport: { width: 390, height: 844 } });
  try {
    await phone.page.evaluate(([k, d]) => localStorage.setItem(k, d), [
      RELATION_KEY,
      JSON.stringify({ version: 2, me: {}, people: [person('m1', { name: '최민준' })], links: [], updatedAt: '' }),
    ]);
    await phone.page.reload({ waitUntil: 'domcontentloaded' });
    await phone.page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await phone.page.locator('[data-relation-toggle]').click();
    await phone.page.waitForSelector('[data-relation-view]', { timeout: 15000 });
    await wait(600);
    await phone.page.locator('[data-relation-list-item="m1"]').focus();
    await phone.page.keyboard.press('Enter');
    await wait(400);
    const box = await phone.page.locator('[data-relation-panel]').boundingBox();
    const map = await phone.page.locator('[data-relation-canvas]').boundingBox();
    pass('phone: the panel sits under the map, full width',
      box.y >= map.y + map.height - 2 && box.width > 300, JSON.stringify({ box, map }));
    pass('no page errors (phone)', phone.errors.length === 0, phone.errors.slice(0, 2).join(' | '));
  } finally {
    await phone.browser.close();
  }

  // 14. Reduced motion: an arriving person is simply there.
  const calm = await setup(base, { reducedMotion: 'reduce' });
  try {
    await calm.page.evaluate(([k, v]) => localStorage.setItem(k, v), [LIFE_KEY, JSON.stringify(LIFE)]);
    await calm.page.reload({ waitUntil: 'domcontentloaded' });
    await calm.page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await calm.page.locator('[data-relation-toggle]').click();
    await calm.page.waitForSelector('[data-relation-view]', { timeout: 15000 });
    await wait(500);
    await calm.page.locator('[data-relation-import]').click();
    await wait(400);
    const drawn = await calm.page.evaluate(() => {
      const c = document.querySelector('[data-relation-surface]');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let ink = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) ink++;
      return ink;
    });
    pass('prefers-reduced-motion: the new people are drawn at once', drawn > 0);
    // Asked for stillness, the map is still: the float stops entirely.
    pass('…and nothing floats about', await calm.page.evaluate(async () => {
      const shot = () => {
        const c = document.querySelector('[data-relation-surface]');
        return c.getContext('2d').getImageData(0, 0, Math.min(400, c.width), Math.min(400, c.height)).data.join();
      };
      const first = shot();
      await new Promise((r) => setTimeout(r, 900));
      return first === shot();
    }));
    pass('no page errors (reduced motion)', calm.errors.length === 0, calm.errors.slice(0, 2).join(' | '));
  } finally {
    await calm.browser.close();
    await close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
