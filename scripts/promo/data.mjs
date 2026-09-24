/**
 * Sample data for the marketing captures: one believable person (a woman in
 * her mid-thirties, office job, married, a baby last year) seen through every
 * tab. Localised per run — Korean names and titles for `ko`, English for `en`.
 * Nobody here is a real person.
 *
 * `seedFor(lang)` returns { [localStorageKey]: string } ready to write.
 * The store shapes follow src/lib/{life,relation,place}.ts, hooks/useEvents.tsx
 * and lib/storage.ts (days), exactly as the e2e seeds in scripts/e2e do.
 */

/** "Today" for every capture (the clock is pinned to it). A Thursday. */
export const TODAY = '2026-09-24';
export const NOW_ISO = '2026-09-24T14:20:00';

const L = (lang, ko, en) => (lang === 'ko' ? ko : en);

// ── Timetable: a full weekday ────────────────────────────────────────────────
function slices(lang) {
  const s = (id, start, end, ko, en, color, icon, done) => ({
    id, label: L(lang, ko, en), startTime: start, endTime: end, color, icon, textPosition: 'inside',
    ...(done ? { done: true } : {}),
  });
  return [
    s('sleep', '23:00', '07:00', '수면', 'Sleep', '#c7d2fe', '🌙'),
    s('morning', '07:00', '07:30', '아침 준비', 'Morning', '#a7f3d0', '🪥', true),
    s('commute1', '07:30', '08:30', '출근', 'Commute', '#fde68a', '🚇', true),
    s('deep', '08:30', '12:00', '집중 업무', 'Deep work', '#93c5fd', '💻'),
    s('lunch', '12:00', '13:00', '점심', 'Lunch', '#fca5a5', '🍱'),
    s('meet', '13:00', '15:00', '회의', 'Meetings', '#a5b4fc', '🗣️'),
    s('work', '15:00', '18:00', '업무 마무리', 'Wrap-up work', '#7dd3fc', '🧠'),
    s('commute2', '18:00', '19:00', '퇴근', 'Commute', '#fde68a', '🚇'),
    s('gym', '19:00', '20:00', '운동', 'Workout', '#6ee7b7', '🏃'),
    s('family', '20:00', '21:00', '가족 저녁', 'Family dinner', '#f9a8d4', '🍲'),
    s('study', '21:00', '22:30', '영어 공부', 'Study', '#c4b5fd', '📚'),
    s('wind', '22:30', '23:00', '하루 정리', 'Wind down', '#fdba74', '📝'),
  ];
}

// ── Calendar: September 2026, with a trip and a holiday ──────────────────────
function events(lang) {
  const e = (id, ko, en, color, extra = {}) => ({ id, text: L(lang, ko, en), color, ...extra });
  return {
    '2026-09-01': [e('c1', '월간 회의', 'Monthly review', '#3b82f6', { time: '10:00' }),
      e('c2', '요가', 'Yoga class', '#10b981', { time: '19:30', repeat: 'weekly' })],
    '2026-09-03': [e('c3', '치과 정기검진', 'Dentist', '#f59e0b', { time: '18:30' })],
    '2026-09-05': [e('c4', '대학 동기 결혼식', "Friend's wedding", '#ec4899', { time: '12:30' })],
    '2026-09-09': [e('c5', '프로젝트 마감', 'Project deadline', '#ef4444')],
    '2026-09-11': [e('c6', '제주 가족 여행', 'Family trip to Jeju', '#06b6d4', { days: 3 })],
    '2026-09-17': [e('c7', '엄마 생신', "Mom's birthday", '#ec4899'),
      e('c8', '케이크 픽업', 'Pick up cake', '#f59e0b', { time: '17:00' })],
    '2026-09-19': [e('c9', '독서 모임', 'Book club', '#8b5cf6', { time: '15:00' })],
    '2026-09-22': [e('c10', '분기 보고', 'Quarterly report', '#3b82f6', { time: '14:00' })],
    '2026-09-23': [e('c11', '팀 회식', 'Team dinner', '#f97316', { time: '19:00' })],
    '2026-09-24': [e('c12', '추석 연휴', 'Long weekend', '#ef4444', { days: 3 }),
      e('c13', '부모님 댁 방문', "Visit Mom & Dad", '#ec4899', { time: '11:00' })],
    '2026-09-25': [e('c14', '월급날', 'Payday', '#22c55e', { repeat: 'monthly' })],
    '2026-09-29': [e('c15', '건강검진', 'Health check-up', '#f59e0b', { time: '09:00' })],
    '2026-09-30': [e('c16', '월말 정산', 'Month-end budget', '#64748b', { time: '21:00' })],
    '2026-10-02': [e('c17', '오사카 여행', 'Osaka weekend', '#06b6d4', { days: 3 })],
    '2026-10-09': [e('c18', '한글날 · 캠핑', 'Camping', '#10b981', { days: 2 })],
  };
}

// ── Relation ids are shared by life (who) and place (personIds) ──────────────
const P = {
  mom: 'p_mom', dad: 'p_dad', spouse: 'p_spouse', sis: 'p_sis', aunt: 'p_aunt', baby: 'p_baby',
  u1: 'p_u1', u2: 'p_u2', u3: 'p_u3', h1: 'p_h1', h2: 'p_h2',
  w1: 'p_w1', w2: 'p_w2', o1: 'p_o1', o2: 'p_o2', yoga: 'p_yoga',
};

function names(lang) {
  return lang === 'ko' ? {
    me: '한서윤', mom: '박미영', dad: '한동수', spouse: '정건우', sis: '한서진', aunt: '박미숙', baby: '정하람',
    u1: '송하율', u2: '오세림', u3: '임채윤', h1: '윤다온', h2: '백서준',
    w1: '강도경', w2: '조아린', o1: '배지훈', o2: '문소희', yoga: '서하린',
  } : {
    me: 'Maya Collins', mom: 'Linda Collins', dad: 'Robert Collins', spouse: 'Daniel Reyes', sis: 'Chloe Collins',
    aunt: 'Aunt Grace', baby: 'Mia Reyes',
    u1: 'Priya Shah', u2: 'Ethan Brooks', u3: 'Hannah Kim', h1: 'Leo Martin', h2: 'Nora Quinn',
    w1: 'Owen Hayes', w2: 'Isla Grant', o1: 'Marcus Webb', o2: 'Tessa Lane', yoga: 'Ava Stone',
  };
}

function relation(lang) {
  const n = names(lang);
  const p = (id, key, group, closeness, over = {}) => ({ id, name: n[key], group, closeness, createdAt: '2026-01-10T09:00:00.000Z', ...over });
  const sub = { uni: L(lang, '대학 동기', 'College'), hs: L(lang, '고등학교', 'High school'), team: L(lang, '우리 팀', 'My team'),
    old: L(lang, '전 직장', 'Old job'), mat: L(lang, '외가', "Mom's side") };
  const people = [
    p(P.mom, 'mom', 'family', 5, { relation: L(lang, '엄마', 'Mom'), birthday: '1963-09-17', lastContact: '2026-09-21', lifeFamilyId: 'f_mom', pinned: true,
      facts: [{ k: 'home', v: L(lang, '대전', 'Portland'), at: '1995' }] }),
    p(P.dad, 'dad', 'family', 4, { relation: L(lang, '아빠', 'Dad'), birthday: '1960-02-14', lastContact: '2026-09-21', lifeFamilyId: 'f_dad' }),
    p(P.spouse, 'spouse', 'family', 5, { relation: L(lang, '남편', 'Husband'), birthday: '1989-11-03', lastContact: '2026-09-24', pinned: true }),
    p(P.baby, 'baby', 'family', 5, { relation: L(lang, '딸', 'Daughter'), birthday: '2025-08-19', lastContact: '2026-09-24' }),
    p(P.sis, 'sis', 'family', 4, { relation: L(lang, '여동생', 'Sister'), birthday: '1994-06-30', lastContact: '2026-09-12' }),
    p(P.aunt, 'aunt', 'family', 2, { relation: L(lang, '이모', 'Aunt'), sub: sub.mat, lastContact: '2026-02-17' }),
    p(P.u1, 'u1', 'friend', 5, { relation: L(lang, '대학 룸메이트', 'College roommate'), sub: sub.uni, birthday: '1991-10-08', lastContact: '2026-09-05',
      log: [{ at: '2026-09-05', k: 'event', v: L(lang, '세림 결혼식', "Ethan's wedding") }] }),
    p(P.u2, 'u2', 'friend', 4, { relation: L(lang, '대학 동기', 'College friend'), sub: sub.uni, lastContact: '2026-09-05' }),
    p(P.u3, 'u3', 'friend', 3, { relation: L(lang, '대학 동기', 'College friend'), sub: sub.uni, lastContact: '2026-04-11' }),
    p(P.h1, 'h1', 'friend', 3, { relation: L(lang, '고등학교 친구', 'School friend'), sub: sub.hs, lastContact: '2026-06-20' }),
    p(P.h2, 'h2', 'friend', 2, { relation: L(lang, '고등학교 친구', 'School friend'), sub: sub.hs, lastContact: '2025-10-02' }),
    p(P.w1, 'w1', 'work', 4, { relation: L(lang, '팀원', 'Teammate'), sub: sub.team, lastContact: '2026-09-23' }),
    p(P.w2, 'w2', 'work', 3, { relation: L(lang, '팀원', 'Teammate'), sub: sub.team, lastContact: '2026-09-23' }),
    p(P.o1, 'o1', 'work', 3, { relation: L(lang, '전 직장 선배', 'Former mentor'), sub: sub.old, lastContact: '2026-03-14',
      facts: [{ k: 'work', v: L(lang, '스타트업 대표', 'Runs a startup'), at: '2024' }] }),
    p(P.o2, 'o2', 'work', 2, { relation: L(lang, '전 직장 동기', 'Former colleague'), sub: sub.old, lastContact: '2025-12-20' }),
    p(P.yoga, 'yoga', 'other', 3, { relation: L(lang, '요가 선생님', 'Yoga teacher'), lastContact: '2026-09-22' }),
  ];
  const links = [
    { source: P.mom, target: P.dad, label: L(lang, '부부', 'Married'), closeness: 5 },
    { source: P.mom, target: P.aunt, label: L(lang, '자매', 'Sisters'), closeness: 4 },
    { source: P.spouse, target: P.baby, closeness: 5 },
    { source: P.u1, target: P.u2, label: L(lang, '커플', 'Couple'), closeness: 5 },
    { source: P.u1, target: P.u3, closeness: 4 },
    { source: P.h1, target: P.h2 },
    { source: P.w1, target: P.w2, label: L(lang, '입사 동기', 'Same intake'), closeness: 4 },
    { source: P.o1, target: P.o2 },
    { source: P.spouse, target: P.u2, label: L(lang, '소개해 줌', 'Introduced us'), closeness: 2 },
  ];
  // Hand-placed (turns from the top, clockwise; distance in outer-ring units)
  // so the map fills a tall phone screen evenly instead of bunching.
  const AT = {
    [P.spouse]: [0.965, 0.72], [P.baby]: [0.04, 0.78], [P.sis]: [0.0, 1.45], [P.mom]: [0.12, 0.95], [P.dad]: [0.17, 0.72],
    [P.aunt]: [0.15, 1.35], [P.u1]: [0.37, 0.75], [P.u2]: [0.41, 1.05], [P.u3]: [0.45, 0.8], [P.h1]: [0.5, 1.05],
    [P.h2]: [0.52, 1.5], [P.w1]: [0.66, 0.7], [P.w2]: [0.7, 1.0], [P.o1]: [0.8, 0.85], [P.o2]: [0.84, 1.2], [P.yoga]: [0.91, 1.5],
  };
  for (const person of people) if (AT[person.id]) person.at = { a: AT[person.id][0], r: AT[person.id][1] };
  return { version: 3, me: { name: names(lang).me }, people, links, updatedAt: '2026-09-24T05:00:00.000Z' };
}

// ── Life: ~18 moments over four decades, plus Mom's line beside it ──────────
function life(lang) {
  const n = names(lang);
  const m = (id, date, ko, en, category, over = {}) => ({ id, date, title: L(lang, ko, en), category, ...over });
  const milestones = [
    m('m01', '1998-03', '초등학교 입학', 'First day of school', 'education'),
    m('m02', '2004-08', '첫 해외여행 · 도쿄', 'First trip abroad · Tokyo', 'travel', { placeRef: { countryCode: 'JP', cityId: 'JP-tokyo' }, who: [P.mom, P.dad, P.sis] }),
    m('m03', '2007-03', '고등학교 입학', 'Started high school', 'education', { who: [P.h1, P.h2] }),
    m('m04', '2010-03', '대학교 입학', 'Started university', 'education', { endDate: '2014-02', who: [P.u1, P.u2, P.u3] }),
    m('m05', '2012-07', '유럽 배낭여행', 'Backpacking in Europe', 'travel', { placeRef: { countryCode: 'FR', cityId: 'FR-paris' }, who: [P.u1],
      description: L(lang, '파리 · 피렌체 · 바르셀로나, 한 달 동안 기차로.', 'Paris, Florence and Barcelona — a month on trains.') }),
    m('m06', '2013-01', '밴쿠버 교환학생', 'Exchange year in Vancouver', 'education', { endDate: '2013-12', placeRef: { countryCode: 'CA', cityId: 'CA-vancouver' } }),
    m('m07', '2014-02', '대학교 졸업', 'Graduated', 'achievement', { pinned: true }),
    m('m08', '2015-01', '첫 직장 입사', 'First job', 'career', { endDate: '2020-12', who: [P.o1, P.o2] }),
    m('m09', '2017-10', '첫 마라톤 완주', 'Ran my first marathon', 'health'),
    m('m10', '2019-04', '첫 독립 · 자취 시작', 'Moved out on my own', 'home'),
    m('m11', '2021-01', '지금 회사로 이직', 'Joined my current company', 'career', { who: [P.w1, P.w2] }),
    m('m12', '2022-05-21', '결혼', 'Got married', 'relationship', { pinned: true, who: [P.spouse, P.mom, P.dad, P.sis, P.u1] }),
    m('m13', '2023-11', '뉴욕 여행', 'New York trip', 'travel', { placeRef: { countryCode: 'US', cityId: 'US-new-york' }, who: [P.spouse] }),
    m('m14', '2024-03', '첫 집 마련', 'Bought our first home', 'home'),
    m('m15', '2025-08-19', '하람이 태어남', 'Mia was born', 'family', { pinned: true, who: [P.spouse, P.baby] }),
    m('m16', '2026-05', '팀장 승진', 'Promoted to team lead', 'career'),
    m('m17', '2027-06', '가족 유럽 여행', 'Family trip to Europe', 'travel', { placeRef: { countryCode: 'IS' } }),
    m('m18', '2030', '석사 학위', "Master's degree", 'education'),
    m('m19', '2045', '제주에서 살아보기', 'A year living by the sea', 'home'),
  ];
  const mom = {
    id: 'l_mom', name: n.mom, birthDate: '1963-09-17',
    milestones: [
      m('o1', '1985', '대학 졸업', 'Graduated', 'education'),
      m('o2', '1988-10', '결혼', 'Got married', 'relationship'),
      m('o3', '1991-04-12', '첫째 탄생', 'First child', 'family'),
      m('o4', '1994-06-30', '둘째 탄생', 'Second child', 'family'),
      m('o5', '2003', '꽃집 개업', 'Opened a flower shop', 'career'),
      m('o6', '2010-03', '첫째 대학 입학', 'First child off to university', 'family'),
      m('o7', '2013-09', '딸 보러 밴쿠버 여행', 'Visited her daughter in Vancouver', 'travel'),
      m('o8', '2016-05', '가게 2호점', 'A second shop', 'career'),
      m('o9', '2018', '은퇴', 'Retired', 'career'),
      m('o10', '2020-04', '제주 한 달 살기', 'A month in Jeju', 'travel'),
      m('o11', '2022-05-21', '딸 결혼식', "Her daughter's wedding", 'family'),
      m('o12', '2025-08-19', '할머니가 되다', 'Became a grandma', 'family'),
    ],
  };
  return {
    version: 1,
    profile: { name: n.me, birthDate: '1991-04-12' },
    family: [
      { id: 'f_mom', relation: 'mother', name: n.mom, birthDate: '1963-09-17' },
      { id: 'f_dad', relation: 'father', name: n.dad, birthDate: '1960-02-14' },
    ],
    milestones,
    others: [mom],
    endingNote: null,
    memoir: null,
    updatedAt: '2026-09-24T05:00:00.000Z',
  };
}

// ── Place: 12 countries, wishes, cities and pins with notes ─────────────────
function place(lang) {
  const c = (code, firstYear, over = {}) => ({ code, ...(firstYear ? { firstYear } : {}), ...over });
  const city = (id, name, countryCode, lng, lat, firstYear, lived) => ({ id, name, countryCode, lat, lng, firstYear, ...(lived ? { lived: true } : {}) });
  const pin = (id, ko, en, category, lat, lng, countryCode, date, noteKo, noteEn, over = {}) => ({
    id, name: L(lang, ko, en), category, lat, lng, countryCode, date,
    ...(noteKo ? { note: L(lang, noteKo, noteEn) } : {}), createdAt: '2026-01-10T09:00:00.000Z', ...over,
  });
  return {
    version: 1,
    home: { countryCode: 'KR', cityId: 'KR-seoul' },
    countries: [
      c('KR', 1991, { lived: true }), c('JP', 2004), c('FR', 2012), c('IT', 2012), c('ES', 2012), c('GB', 2012),
      c('CA', 2013, { lived: true }), c('TH', 2016), c('VN', 2018), c('TW', 2019), c('US', 2023), c('AU', 2015),
      c('IS', 0, { wish: true, note: L(lang, '오로라 보러 가기', 'See the northern lights') }),
      c('NZ', 0, { wish: true }), c('PE', 0, { wish: true }), c('MA', 0, { wish: true }), c('NO', 0, { wish: true }),
    ],
    cities: [
      city('KR-seoul', 'Seoul', 'KR', 127, 37.57, 1991, true),
      city('KR-busan', 'Busan', 'KR', 129.01, 35.1, 2009),
      city('KR-jeju', 'Jeju', 'KR', 126.52, 33.51, 2016),
      city('JP-tokyo', 'Tokyo', 'JP', 139.75, 35.69, 2004),
      city('JP-kyoto', 'Kyoto', 'JP', 135.75, 35.03, 2019),
      city('FR-paris', 'Paris', 'FR', 2.35, 48.86, 2012),
      city('IT-florence', 'Florence', 'IT', 11.25, 43.78, 2012),
      city('ES-barcelona', 'Barcelona', 'ES', 2.18, 41.39, 2012),
      city('CA-vancouver', 'Vancouver', 'CA', -123.12, 49.28, 2013, true),
      city('US-new-york', 'New York', 'US', -74, 40.72, 2023),
      city('TH-bangkok', 'Bangkok', 'TH', 100.51, 13.75, 2016),
      city('VN-da-nang', 'Da Nang', 'VN', 108.25, 16.06, 2018),
      city('TW-taipei', 'Taipei', 'TW', 121.57, 25.04, 2019),
    ],
    pins: [
      pin('pin_home', '우리 집', 'Home', 'home', 37.5445, 127.0557, 'KR', '2024-03-02', '첫 집. 창밖으로 한강이 조금 보인다.', 'Our first home — a sliver of river view.', { star: true, personIds: [P.spouse, P.baby], lifeMilestoneId: 'm14' }),
      pin('pin_office', '회사', 'Office', 'work', 37.4979, 127.0276, 'KR', '2021-01-04', null, null, { star: true }),
      pin('pin_parents', '부모님 댁', "Mom & Dad's", 'home', 36.3504, 127.3845, 'KR', '1995', '추석엔 여기로.', 'Where we go for the holidays.', { star: true, personIds: [P.mom, P.dad] }),
      pin('pin_jeju', '제주 협재 숙소', 'Jeju beach stay', 'stay', 33.394, 126.2397, 'KR', '2026-09-11', '하람이의 첫 바다.', "Mia's first time at the sea.", { personIds: [P.spouse, P.baby] }),
      pin('pin_busan', '해운대 국밥집', 'Busan soup spot', 'food', 35.1631, 129.1635, 'KR', '2009', '줄 서도 먹을 가치 있음.', 'Worth the queue.'),
      pin('pin_seoraksan', '설악산 대청봉', 'Seoraksan summit', 'nature', 38.1195, 128.4656, 'KR', '2017-10-15', '마라톤 끝나고 일주일 뒤.', 'A week after the marathon.'),
      pin('pin_tokyo', '츠키지 스시', 'Tsukiji sushi', 'food', 35.6655, 139.7707, 'JP', '2004-08-10', '첫 해외여행에서 먹은 초밥.', 'First sushi abroad.', { personIds: [P.mom, P.dad, P.sis] }),
      pin('pin_kyoto', '후시미 이나리', 'Fushimi Inari', 'culture', 34.9671, 135.7727, 'JP', '2019-04-06', '새벽에 가면 사람이 없다.', 'Go at dawn — nobody there.'),
      pin('pin_paris', '몽마르트 언덕', 'Montmartre', 'culture', 48.8867, 2.3431, 'FR', '2012-07-08', '해 질 녘 버스킹.', 'Buskers at sunset.', { personIds: [P.u1] }),
      pin('pin_van', '스탠리 파크', 'Stanley Park', 'nature', 49.3043, -123.1443, 'CA', '2013-05-01', '교환학생 시절 매주 달리던 곳.', 'My weekly run in the exchange year.'),
      pin('pin_nyc', '센트럴 파크', 'Central Park', 'nature', 40.7812, -73.9665, 'US', '2023-11-12', null, null, { personIds: [P.spouse] }),
      pin('pin_bkk', '짜뚜짝 시장', 'Chatuchak market', 'food', 13.7999, 100.5505, 'TH', '2016-02-20', null, null),
    ],
    updatedAt: '2026-09-24T05:00:00.000Z',
  };
}

/** Everything the app reads, keyed by its localStorage key. */
export function seedFor(lang, { chartView = 'full', chartLayout = 'center' } = {}) {
  const day = {
    id: 'd1',
    schedule: {
      id: 's1', version: 1, name: L(lang, '평일 루틴', 'My weekday'), presetSource: null,
      updatedAt: '2026-09-24T05:00:00.000Z', slices: slices(lang),
    },
  };
  return {
    '24h-circle-planner.days': JSON.stringify({ version: 1, activeId: 'd1', days: [day] }),
    '24h-circle-planner.prefs': JSON.stringify({ version: 1, prefs: { language: lang, chartView, chartLayout } }),
    '24h-circle-planner.app-language-v1': '1',
    '24h-circle-planner.events': JSON.stringify({ version: 1, events: events(lang) }),
    '24h-circle-planner.life': JSON.stringify(life(lang)),
    '24h-circle-planner.relation': JSON.stringify(relation(lang)),
    '24h-circle-planner.place': JSON.stringify(place(lang)),
    '24h-circle-planner.done-date': TODAY,
  };
}

/** First-run cards, banners, nudges and tours that would cover a capture. */
export const QUIET = {
  '24h-circle-planner.onboarded': '1',
  '24h-circle-planner.design-magician': '1',
  '24h-circle-planner.tutorial-seen': '1',
  '24h-circle-planner.getapp-banner': '1',
  '24h-circle-planner.getapp-dismissed': '1',
  '24h-circle-planner.ios-install-dismissed': '1',
  '24h-circle-planner.weekday-prompted': TODAY,
  '24h-life-banner-off': String(Date.parse('2026-09-20T09:00:00')),
  '24h-tour-offered.calendar': '1',
  '24h-tour-offered.life': '1',
  '24h-tour-offered.relation': '1',
  '24h-tour-offered.place': '1',
  '24h-ga-choice': 'denied',
  '24h-tama-intro': '1',
  '24h-life-backup-at': String(Date.parse('2026-09-20T09:00:00')),
};
