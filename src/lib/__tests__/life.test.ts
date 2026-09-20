import { describe, expect, it } from 'vitest';
import {
  FREE_LIFE_FAMILY, FREE_LIFE_MILESTONES, LIFE_KEY, ageAt, buildTimeline, canAddFamily, canAddMilestone,
  decodeLife, emptyLife, encodeLife, isNewerLife, isPlanned, lifeDate, lifeFile, lifeSummary, photoIds, precisionOf,
  readLifeFile, sortMilestones, spokenLifeDate, type LifeData, type Milestone,
} from '../life';

const TODAY = '2026-09-20';
const ms = (id: string, date: string, extra: Partial<Milestone> = {}): Milestone =>
  ({ id, date, title: id, category: 'other', ...extra });
const life = (over: Partial<LifeData> = {}): LifeData =>
  ({ ...emptyLife(), profile: { birthDate: '1985-05-15' }, ...over });

describe('life dates', () => {
  it('knows how much of a date is given', () => {
    expect(precisionOf('2010')).toBe('year');
    expect(precisionOf('2010-05')).toBe('month');
    expect(precisionOf('2010-05-15')).toBe('day');
    expect(precisionOf('2010-02-30')).toBeNull();
    expect(precisionOf('2010-13')).toBeNull();
    expect(precisionOf('0999')).toBeNull();
    expect(precisionOf('20100515')).toBeNull();
  });

  it('is built from its parts, dropping a day without a month', () => {
    expect(lifeDate(2010, 5, 15)).toBe('2010-05-15');
    expect(lifeDate(2010, 5, null)).toBe('2010-05');
    expect(lifeDate(2010, null, 15)).toBe('2010');
    expect(lifeDate(null, 5, 15)).toBeNull();
    expect(lifeDate(2010, 2, 31)).toBeNull();
  });

  it('is spoken in the reader\'s language', () => {
    expect(spokenLifeDate('2015-03', 'ko')).toBe('2015년 3월');
    expect(spokenLifeDate('2015', 'en')).toBe('2015');
  });
});

describe('age', () => {
  it('counts full years (만 나이)', () => {
    expect(ageAt('1985-05-15', '2010-05-15')).toEqual({ years: 25, approx: false });
    expect(ageAt('1985-05-15', '2010-05-14')).toEqual({ years: 24, approx: false });
    expect(ageAt('1985-05-15', '2010-04')).toEqual({ years: 24, approx: false });
  });

  it('is "about" when the birthday may or may not have come', () => {
    // The birth month without the day: 24 or 25.
    expect(ageAt('1985-05-15', '2010-05')).toEqual({ years: 25, approx: true });
  });

  it('is "about" when only the year is known', () => {
    expect(ageAt('1985-05-15', '2010')).toEqual({ years: 25, approx: true });
  });

  it('has none before birth', () => {
    expect(ageAt('1985-05-15', '1985-05-14')).toBeNull();
    expect(ageAt('1985-05-15', '1984')).toBeNull();
    expect(ageAt('1985-05-15', '1985-05')).toEqual({ years: 0, approx: true });
  });
});

describe('plans and order', () => {
  it('treats anything after today as a plan', () => {
    expect(isPlanned(ms('a', '2027'), TODAY)).toBe(true);
    expect(isPlanned(ms('a', '2026-09-21'), TODAY)).toBe(true);
    expect(isPlanned(ms('a', '2026-09-20'), TODAY)).toBe(false);
    // Nothing in the past can be a plan, however it was once marked.
    expect(isPlanned(ms('a', '2020', { pinned: true }), TODAY)).toBe(false);
  });

  it('sorts by date; the same date keeps the order added', () => {
    const list = [ms('c', '2010-05-01'), ms('a', '2001'), ms('b1', '2010-05-01'), ms('y', '2010'), ms('b2', '2010-05-01')];
    expect(sortMilestones(list).map((m) => m.id)).toEqual(['a', 'y', 'c', 'b1', 'b2']);
  });
});

describe('the stored envelope', () => {
  const full = life({
    profile: { name: '나', birthDate: '1985-05-15' },
    family: [{ id: 'f1', relation: 'mother', name: '엄마', birthDate: '1960', note: '메모', photo: 'p1' }],
    milestones: [
      ms('m1', '2010-05-15', { title: '입사', category: 'career', description: '첫 직장', endDate: '2015', photo: 'p2', pinned: true }),
      ms('m2', '2030', { title: '세계 여행', category: 'travel' }),
    ],
    endingNote: { text: '고마웠어요', updatedAt: '2026-09-01T00:00:00.000Z' },
    updatedAt: '2026-09-20T00:00:00.000Z',
  });

  it('round-trips byte for byte (the sync blob depends on it)', () => {
    const once = JSON.stringify(encodeLife(full));
    const twice = JSON.stringify(encodeLife(decodeLife(JSON.parse(once))!));
    expect(twice).toBe(once);
    expect(decodeLife(JSON.parse(once))).toEqual(full);
  });

  it('stores one canonical shape whatever order an edit built its fields in', () => {
    const shuffled = { ...full, milestones: [{ category: 'career', title: 'x', date: '2011', id: 'z' }] };
    expect(Object.keys(encodeLife(shuffled as LifeData).milestones[0])).toEqual(['id', 'date', 'title', 'category']);
  });

  it('drops what it does not understand instead of failing', () => {
    const got = decodeLife({
      version: 1,
      profile: { birthDate: 'soon', lifeExpectancy: 999 },
      family: [{ id: 'x', relation: 'cousin', name: 'a' }, { id: 'y', relation: 'father', name: '' }, 5],
      milestones: [
        ms('ok', '2001'), ms('ok', '2002'), { id: 'bad', date: '2001-02-30', title: 't' },
        { id: 'nt', date: '2001', title: '   ' }, { ...ms('born', '1985'), category: 'birth' },
        { ...ms('end', '2010'), endDate: '2009' },
      ],
      endingNote: { text: 42 },
    })!;
    expect(got.profile).toEqual({ birthDate: '' });
    expect(got.family).toEqual([]);
    expect(got.milestones.map((m) => m.id)).toEqual(['ok', 'born', 'end']);
    expect(got.milestones[1].category).toBe('other');
    expect(got.milestones[2].endDate).toBeUndefined();
    expect(got.endingNote).toBeNull();
  });

  it('keeps titles that pass once passing on every later load', () => {
    const padded = `${' '.repeat(80)}x`;
    expect(decodeLife({ version: 1, milestones: [{ id: 'a', date: '2001', title: padded }] })!.milestones).toEqual([]);
  });

  it('refuses an unknown version rather than guessing', () => {
    expect(isNewerLife({ version: 2 })).toBe(true);
    expect(isNewerLife({ version: 1 })).toBe(false);
    expect(decodeLife({ version: 2 })).toBeNull();
    expect(decodeLife(null)).toBeNull();
  });
});

describe('the free plan', () => {
  it('stops adding at the limit and never takes anything away', () => {
    const many = life({ milestones: Array.from({ length: FREE_LIFE_MILESTONES + 5 }, (_, i) => ms(`m${i}`, '2001')) });
    expect(canAddMilestone(many, false)).toBe(false);
    expect(canAddMilestone(many, true)).toBe(true);
    // Over the limit (a lapsed Pro): everything still decodes and shows.
    expect(decodeLife(JSON.parse(JSON.stringify(many)))!.milestones).toHaveLength(FREE_LIFE_MILESTONES + 5);
    expect(buildTimeline(many, { today: TODAY }).filter((i) => i.kind === 'moment')).toHaveLength(FREE_LIFE_MILESTONES + 5);
    const fam = life({ family: Array.from({ length: FREE_LIFE_FAMILY }, (_, i) => ({ id: `f${i}`, relation: 'other' as const, name: 'n' })) });
    expect(canAddFamily(fam, false)).toBe(false);
    expect(canAddFamily(fam, true)).toBe(true);
  });
});

describe('the timeline', () => {
  it('is empty until the birthday is known', () => {
    expect(buildTimeline(emptyLife(), { today: TODAY })).toEqual([]);
  });

  it('from a birthday alone: decades, birth, today, and the decades ahead', () => {
    const items = buildTimeline(life(), { today: TODAY });
    const shape = items.map((i) => (i.kind === 'decade' ? `${i.decade}s${i.future ? '~' : ''}` : i.kind));
    expect(items.filter((i) => i.kind === 'decade').every((i) => i.count === 0)).toBe(true);
    expect(shape).toEqual([
      '1980s', 'birth', '1990s', '2000s', '2010s', '2020s', 'today',
      '2030s~', '2040s~', '2050s~', '2060s~', '2070s~', '2080s~', '2090s~', '2100s~',
    ]);
  });

  it('alternates sides, packs same-year cards, and puts plans below today', () => {
    const items = buildTimeline(life({
      milestones: [ms('school', '1992-03'), ms('grad', '1992-12'), ms('job', '2010'), ms('trip', '2031', { title: 'trip' })],
    }), { today: TODAY });
    const cards = items.filter((i) => i.kind === 'birth' || i.kind === 'moment');
    expect(cards.map((c) => c.side)).toEqual(['left', 'right', 'left', 'right', 'left']);
    const byKey = Object.fromEntries(items.map((i) => [i.key, i]));
    expect(byKey['grad']).toMatchObject({ tight: true, future: false, plan: false });
    expect(byKey['school']).toMatchObject({ tight: false });
    // Two moments in the 1990s, one each in the 2010s and 2030s.
    expect(items.filter((i) => i.kind === 'decade').map((i) => [i.decade, i.count]))
      .toEqual([[1980, 0], [1990, 2], [2000, 0], [2010, 1], [2020, 0], [2030, 1], [2040, 0], [2050, 0], [2060, 0], [2070, 0], [2080, 0], [2090, 0], [2100, 0]]);
    expect(byKey['trip']).toMatchObject({ future: true, plan: true });
    expect(items.findIndex((i) => i.kind === 'today')).toBeLessThan(items.findIndex((i) => i.key === 'trip'));
  });

  it('puts a moment from before the birth above the birth card', () => {
    const keys = buildTimeline(life({ milestones: [ms('wedding', '1983'), ms('school', '1992')] }), { today: TODAY })
      .map((i) => i.key);
    expect(keys.slice(0, 5)).toEqual(['d1980', 'wedding', 'birth', 'd1990', 'school']);
  });

  it('filters by category, keeping birth and today', () => {
    const items = buildTimeline(life({
      milestones: [ms('a', '2000', { category: 'travel' }), ms('b', '2001', { category: 'career' })],
    }), { today: TODAY, only: new Set(['travel'] as const) });
    expect(items.filter((i) => i.kind !== 'decade').map((i) => i.key)).toEqual(['birth', 'a', 'today']);
  });

  it('runs the same hundred and twenty years past the birthday for everyone', () => {
    const items = buildTimeline(life(), { today: TODAY });
    const last = items.filter((i) => i.kind === 'decade').at(-1);
    expect(last).toMatchObject({ kind: 'decade', decade: 2100 });
  });

  it('reaches further still when a plan is dated beyond it', () => {
    const items = buildTimeline(life({ milestones: [ms('late', '2130')] }), { today: TODAY });
    expect(items.slice(-2)).toMatchObject([{ kind: 'decade', decade: 2130 }, { key: 'late' }]);
  });
});

describe('the summary', () => {
  it('counts records and plans, the age, and the years ahead', () => {
    const s = lifeSummary(life({ milestones: [ms('a', '2000'), ms('b', '2030'), ms('c', '2031')] }), TODAY);
    expect(s).toEqual({ records: 1, plans: 2, age: 41, remaining: 79 });
  });
});

describe('the backup file', () => {
  const data = life({ milestones: [ms('m', '2001', { photo: 'p9' })], family: [{ id: 'f', relation: 'father', name: 'a', photo: 'p8' }] });

  it('carries the photos and restores them', () => {
    expect(photoIds(data)).toEqual(['p9', 'p8']);
    const text = JSON.stringify(lifeFile(data, { p9: 'data:image/jpeg;base64,AAA', evil: 'javascript:alert(1)' }));
    const back = readLifeFile(text);
    expect(back.life).toEqual(decodeLife(data));
    expect(back.photos).toEqual({ p9: 'data:image/jpeg;base64,AAA' });
  });

  it('also reads the whole-app backup', () => {
    const text = JSON.stringify({ app: '24h-circle-planner', version: 1, data: { [LIFE_KEY]: JSON.stringify(data) } });
    expect(readLifeFile(text).life.milestones).toHaveLength(1);
  });

  it('refuses other files', () => {
    expect(() => readLifeFile('{"app":"other"}')).toThrow();
    expect(() => readLifeFile('{"app":"24h-circle-planner","kind":"life","life":{"version":7}}')).toThrow();
    expect(() => readLifeFile('not json')).toThrow();
  });
});
