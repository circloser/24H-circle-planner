/**
 * The calendar in the introductions: the logo's about dialog lists it, the
 * tutorial ends on it (and notices when the calendar is opened), the design
 * magician has a 캘린더 꾸미기 step (Pro: paper applies; the button opens the
 * sticker panel on the calendar), /?view=calendar opens the calendar, and the
 * /calendar page is a real, linked page.
 */
import { makeReporter, launchPage, serveDist, seedBasicData, wait, isMain, runStandalone } from './_helpers.mjs';

const json = (data, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(data) });

export async function run() {
  const { pass, allOk } = makeReporter('intro');
  const { base, close } = await serveDist();
  const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 900 } });
  let me = { user: null, plan: 'free' };
  const count = (sel) => page.locator(sel).count();

  try {
    await page.addInitScript(() => localStorage.setItem('24h-circle-planner.sync-consent', '1'));
    await page.route('**/api/sync*', (route) => route.fulfill(json({ version: 0, data: {}, updatedAt: 0 })));
    await page.route('**/api/me', (route) => route.fulfill(json(me)));
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await seedBasicData(page);

    // 1. The logo's about dialog.
    await page.locator('button[aria-label="24Houring 소개 · 사용 안내"]').click();
    await wait(400);
    const about = await page.locator('[role="dialog"]').innerText();
    pass('the logo’s introduction lists the calendar', about.includes('월간 캘린더') && about.includes('다꾸'), about.slice(0, 60));
    pass('…and the start steps mention it', about.includes('캘린더 꾸미기'));
    await page.keyboard.press('Escape');
    await wait(300);

    // 2. The tutorial ends on the calendar.
    await page.locator('button[aria-label="설정"]').click();
    await wait(300);
    await page.locator('[role="menuitem"]', { hasText: '튜토리얼' }).first().click();
    await wait(500);
    const tut = page.locator('[role="dialog"][aria-label="시간표 튜토리얼"]');
    for (let i = 0; i < 6; i++) {
      await tut.locator('button', { hasText: /건너뛰기|다음/ }).click();
      await wait(200);
    }
    const last = await tut.innerText();
    pass('the tutorial’s last step is the calendar', last.includes('⑦ 캘린더') && last.includes('7/7'), last.slice(0, 40));
    await page.locator('[data-calendar-toggle]').click();
    await wait(900);
    pass('…and it notices when the calendar is opened', (await tut.locator('[role="status"]').innerText().catch(() => '')).includes('잘하셨어요'));
    await tut.locator('button[aria-label="취소"]').click();
    await wait(300);
    await page.locator('[data-calendar-toggle]').click();
    await wait(600);

    // 3. The design magician: 캘린더 꾸미기, just before the layout step.
    const openMagician = async () => {
      await page.locator('button[aria-label="디자인"]').click();
      await wait(300);
      await page.locator('[role="menuitem"]', { hasText: '디자인 매지션' }).click();
      await wait(500);
    };
    const mag = page.locator('[role="dialog"][aria-label="디자인 매지션"]');
    const goToStep = async (title) => {
      for (let i = 0; i < 20; i++) {
        if ((await mag.locator('h3').innerText()).trim() === title) return true;
        await mag.locator('button:has-text("다음")').click();
        await wait(150);
      }
      return false;
    };
    await openMagician();
    const found = await goToStep('캘린더 꾸미기');
    pass('the magician has a 캘린더 꾸미기 step', found);
    const counter = (await mag.locator('span.tabular-nums').innerText()).trim().split('/').map(Number);
    pass('…right before the final layout step', counter[0] === counter[1] - 1, counter.join('/'));
    await mag.locator('[data-magician-paper="grid"]').click();
    await wait(400);
    pass('a free account is offered Pro for the paper', (await count('[role="dialog"]:not([aria-label="디자인 매지션"])')) >= 1
      && (await page.evaluate(() => JSON.parse(localStorage.getItem('24h-circle-planner.prefs')).prefs.calendarPaper)) === 'none');
    await page.keyboard.press('Escape');
    await wait(300);
    await mag.locator('button[aria-label="취소"]').click().catch(() => {});
    await wait(300);

    me = { user: { id: 'u1', email: 'me@example.com', provider: 'google' }, plan: 'pro', admin: false };
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
    await wait(800);
    await openMagician();
    await goToStep('캘린더 꾸미기');
    await mag.locator('[data-magician-paper="kraft"]').click();
    await wait(200);
    pass('Pro: the magician sets the calendar paper',
      (await page.evaluate(() => JSON.parse(localStorage.getItem('24h-circle-planner.prefs')).prefs.calendarPaper)) === 'kraft');
    await mag.locator('[data-magician-decorate]').click();
    await page.waitForSelector('[data-calendar-view]', { timeout: 15000 });
    await wait(700);
    pass('“캘린더에서 꾸미기 시작” opens the calendar with the sticker panel',
      (await count('[data-decor-tray="sticker"]')) === 1 && (await count('[role="dialog"][aria-label="디자인 매지션"]')) === 0
      && (await page.locator('[data-calendar-view]').getAttribute('data-paper')) === 'kraft');
    await page.locator('[data-decor-toggle]').click();
    await page.locator('[data-calendar-toggle]').click();
    await wait(500);

    // 4. /?view=calendar
    await page.goto(`${base}/?view=calendar#x`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-calendar-view]', { timeout: 15000 });
    await wait(300);
    const url = new URL(page.url());
    pass('/?view=calendar opens the calendar and tidies the address', !url.searchParams.has('view') && url.hash === '#x', page.url());

    // 5. The /calendar page.
    const res = await page.goto(`${base}/calendar`, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    pass('/calendar is a page of its own', res?.ok() && title.includes('다꾸 캘린더'), title);
    const meta = await page.evaluate(() => ({
      canonical: document.querySelector('link[rel="canonical"]')?.href,
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)['@type']),
      cta: [...document.querySelectorAll('a.btn')].map((a) => a.getAttribute('href')),
    }));
    pass('…with canonical, breadcrumbs, FAQ data and links into the calendar',
      meta.canonical === 'https://24houring.com/calendar' && meta.ld.includes('FAQPage') && meta.ld.includes('BreadcrumbList')
      && meta.cta.includes('/?view=calendar'), JSON.stringify(meta));

    pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    close();
  }
  return allOk();
}

if (isMain(import.meta.url)) await runStandalone(run);
