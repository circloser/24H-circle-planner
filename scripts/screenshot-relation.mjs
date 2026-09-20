/**
 * Two pictures of the relation map, desktop and phone, for a look before the
 * rest is built (PRD stage 3). Run over dist/ so it is the real build:
 *   npm run build && node scripts/screenshot-relation.mjs
 */
import { launchPage, serveDist, seedBasicData, wait } from './e2e/_helpers.mjs';

const RELATION_KEY = '24h-circle-planner.relation';
const LIFE_KEY = '24h-circle-planner.life';
const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

const p = (id, name, group, closeness, over = {}) =>
  ({ id, name, group, closeness, createdAt: '', ...over });

const PEOPLE = [
  p('p1', '이정숙', 'family', 3, { relation: '어머니', birthday: '1958-03-02', lastContact: '2026-09-18' }),
  p('p2', '김영수', 'family', 3, { relation: '아버지', birthday: '1955-11-20', lastContact: '2026-09-10' }),
  p('p3', '박서연', 'family', 2, { relation: '누나', birthday: '1982-10-05' }),
  p('p4', '최민준', 'friend', 3, { relation: '대학 동기', lastContact: '2026-09-19' }),
  p('p5', '정하윤', 'friend', 2, { relation: '고등학교 친구', lastContact: '2026-01-02' }),
  p('p6', '윤도현', 'friend', 2, { lastContact: '2024-05-05' }),
  p('p7', '한지우', 'friend', 1, { relation: '동호회' }),
  p('p8', '오세훈', 'friend', 1, {}),
  p('p9', '강나래', 'work', 2, { relation: '팀장', lastContact: '2026-09-15' }),
  p('p10', '문태일', 'work', 2, { relation: '동료' }),
  p('p11', '서예진', 'work', 1, { relation: '전 직장' }),
  p('p12', '배준호', 'work', 3, { relation: '멘토', birthday: '1970-10-01' }),
  p('p13', '신유나', 'other', 1, { relation: '단골 카페' }),
  p('p14', '조은비', 'other', 2, { relation: '이웃', lastContact: '2025-06-06' }),
];

const shot = async (base, name, viewport) => {
  const { browser, page } = await launchPage({ viewport });
  await page.route('**/api/sync*', (route) => route.fulfill(json({ version: 0, data: {}, updatedAt: 0 })));
  await page.route('**/api/me', (route) => route.fulfill(json({ user: null, plan: 'free' })));
  await page.route('**/api/life/memoir', (route) => route.fulfill(json({ enabled: false })));
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
  await seedBasicData(page);
  await page.evaluate(([rk, lk, people]) => {
    localStorage.setItem(rk, JSON.stringify({
      version: 1, me: { name: '김하루' }, people,
      links: [{ source: 'p1', target: 'p2', label: '부부' }, { source: 'p4', target: 'p5' }],
      updatedAt: '',
    }));
    localStorage.setItem(lk, JSON.stringify({
      version: 1, profile: { birthDate: '1985-05-15', name: '김하루' },
      family: [], milestones: [], endingNote: null, memoir: null, updatedAt: '',
    }));
  }, [RELATION_KEY, LIFE_KEY, PEOPLE]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('svg[data-circle-timeline]', { timeout: 15000 });
  await page.locator('[data-relation-toggle]').click();
  await page.waitForSelector('[data-relation-view]', { timeout: 15000 });
  await wait(1200);
  await page.screenshot({ path: name });
  await browser.close();
  console.log('wrote', name);
};

const { base, close } = await serveDist();
try {
  await shot(base, 'relation-desktop.png', { width: 1440, height: 900 });
  await shot(base, 'relation-phone.png', { width: 390, height: 844 });
} finally {
  await close();
}
