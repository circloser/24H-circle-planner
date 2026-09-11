/**
 * Mailing list: joined only from ⚙, never prompted. Mocks /api/me (admin,
 * non-admin, signed out), /api/marketing and /api/admin/marketing, then checks
 * that nothing opens or is fetched on its own, that ⚙ → 메일링 리스트 records
 * exactly the chosen answer, that admins get a 관리자 group listing subscribers
 * with search, that non-admins don't, and that a signed-out visitor is offered
 * sign-in instead of consent buttons. Needs dist/ over http.
 */
import { makeReporter, launchPage, serveDist, seedBasicData, wait, isMain, runStandalone } from './_helpers.mjs';

const json = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });

export async function run() {
  const { pass, allOk } = makeReporter('mailing');
  const { base, close } = await serveDist();
  const { browser, page, errors } = await launchPage({ viewport: { width: 1280, height: 900 } });
  let me = { user: { id: 'u1', email: 'admin@example.com', provider: 'google' }, plan: 'free', admin: true };
  const marketingGets = [];
  const puts = [];

  const openGear = async () => {
    await page.locator('button[aria-label="설정"]').first().click();
    await wait(300);
  };
  const reloadApp = async () => {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await wait(800);
  };

  try {
    await page.route('**/api/me', (route) => route.fulfill(json(me)));
    await page.route('**/api/marketing', (route) => {
      const req = route.request();
      if (req.method() === 'PUT') {
        const body = JSON.parse(req.postData() || '{}');
        puts.push(body);
        return route.fulfill(json({ decided: true, optIn: body.optIn, version: body.version, decidedAt: Date.now() }));
      }
      marketingGets.push(req.url());
      return route.fulfill(json({ decided: false, optIn: false, version: 'x', decidedAt: null }));
    });
    await page.route('**/api/admin/marketing*', (route) => {
      const url = route.request().url();
      if (url.includes('format=list')) {
        return route.fulfill(json({
          subscribers: [
            { email: 'newest@example.com', agreedAt: Date.UTC(2026, 8, 11, 3) },
            { email: 'older@example.com', agreedAt: Date.UTC(2026, 8, 10, 3) },
          ],
          total: 2,
          limit: 10000,
        }));
      }
      return route.fulfill(json({ optedIn: 2, declined: 1, undecided: 5, version: 'x' }));
    });

    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await seedBasicData(page);

    // 1. Signed in and left alone: no prompt, and not even a request.
    await wait(6000);
    pass('no mailing-list prompt appears on its own', (await page.locator('[role="dialog"]:has-text("새 소식을 이메일로 받아볼까요?")').count()) === 0);
    pass('nothing is fetched until the user asks', marketingGets.length === 0, `gets=${marketingGets.length}`);

    // 2. ⚙ → 메일링 리스트 → join.
    await openGear();
    await page.getByRole('menuitem', { name: '메일링 리스트', exact: true }).click();
    await wait(700);
    const dlg = page.locator('[role="dialog"]:has-text("새 소식을 이메일로 받아볼까요?")');
    pass('⚙ → 메일링 리스트 opens the dialog', (await dlg.count()) > 0);
    pass('the dialog carries the consent disclosures',
      (await dlg.locator('text=수집·이용 항목').count()) > 0 && (await dlg.locator('text=보유·이용 기간').count()) > 0);
    await dlg.locator('button:has-text("동의하고 받기")').click();
    await wait(600);
    pass('joining records exactly that answer', puts.length === 1 && puts[0].optIn === true && typeof puts[0].version === 'string', JSON.stringify(puts));
    pass('the dialog closes after answering', (await dlg.count()) === 0);

    // 3. Admin group → subscribers.
    await openGear();
    pass('an admin sees the 관리자 group', (await page.locator('[data-admin-menu]').count()) > 0);
    await page.getByRole('menuitem', { name: '메일링 리스트 가입자', exact: true }).click();
    await wait(900);
    pass('the admin list shows who joined', (await page.locator('[data-mailing-row]').count()) === 2);
    pass('the admin list shows the counts', /가입\s*2명/.test(await page.locator('[data-mailing-counts]').innerText()));
    await page.getByLabel('이메일 검색').fill('older');
    await wait(250);
    pass('search narrows the list', (await page.locator('[data-mailing-row]').count()) === 1);
    await page.keyboard.press('Escape');
    await wait(300);

    // 4. Non-admin: the option stays, the admin group does not.
    me = { ...me, admin: false };
    await reloadApp();
    await openGear();
    pass('a non-admin sees no admin group', (await page.locator('[data-admin-menu]').count()) === 0);
    pass('a non-admin still sees the mailing-list option', (await page.getByRole('menuitem', { name: '메일링 리스트', exact: true }).count()) === 1);
    await page.keyboard.press('Escape');
    await wait(300);

    // 5. Signed out: sign-in instead of consent buttons.
    me = { user: null };
    await reloadApp();
    await openGear();
    await page.getByRole('menuitem', { name: '메일링 리스트', exact: true }).click();
    await wait(700);
    const out = page.locator('[role="dialog"]:has-text("먼저 로그인해 주세요")');
    pass('signed out: offered sign-in instead of answers',
      (await out.count()) > 0 && (await out.locator('button:has-text("동의하고 받기")').count()) === 0);
    pass('signed out: a sign-in button is there', (await out.locator('button:has-text("구글로 로그인")').count()) === 1);

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
