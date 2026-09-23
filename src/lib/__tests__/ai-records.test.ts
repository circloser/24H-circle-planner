import { beforeEach, describe, expect, it } from 'vitest';
import { gatherRecords, memoirReadiness } from '../ai-records';
import { buildSajuRequest, decodeSaju, emptySaju, viewChart } from '../saju-reading';

const put = (key: string, value: unknown) => localStorage.setItem(`24h-circle-planner.${key}`, JSON.stringify(value));

beforeEach(() => localStorage.clear());

describe('gathering the records', () => {
  it('reads every page, boiled down, and names who was there', () => {
    put('life', {
      version: 1, profile: { birthDate: '1990-05-15', name: '김하루' }, family: [], endingNote: null, memoir: null, updatedAt: '',
      milestones: [
        { id: 'm2', date: '2019', title: '이사', category: 'home' },
        { id: 'm1', date: '2012-03', title: '첫 직장', category: 'career', who: ['p1'] },
      ],
    });
    put('relation', {
      version: 3, links: [], updatedAt: '',
      me: { mbti: [{ v: 'INFP', at: '2024-01-01' }], answers: { q001: [{ v: '하루', at: '2026-01-01' }] }, moods: [{ at: '2026-01-02', v: 4 }, { at: '2026-01-05', v: 2 }] },
      people: [{ id: 'p1', name: '윤도현', group: 'friend', closeness: 4, sub: '대학', createdAt: '', log: [{ at: '2026-01-01', k: 'meet' }] }],
    });
    put('diary', { version: 1, entries: { '2026-01-03': { date: '2026-01-03', name: 'x', slices: [], note: '비 오는 날' }, '2026-01-04': { date: '2026-01-04', name: 'x', slices: [] } } });
    put('place', { version: 1, countries: [{ code: 'JP', firstYear: 2015 }, { code: 'IS', wish: true }], cities: [], pins: [], updatedAt: '' });

    const { digest, count } = gatherRecords('ko');
    expect(digest.moments.map((m) => m.title)).toEqual(['첫 직장', '이사']);
    expect(digest.moments[0].with).toEqual(['윤도현']);
    expect(digest.me.mbti).toEqual(['INFP (2024-01-01)']);
    expect(digest.me.answers?.[0]).toMatchObject({ a: '하루' });
    expect(digest.me.moods).toEqual([{ month: '2026-01', avg: 3, days: 2 }]);
    expect(digest.people[0]).toMatchObject({ name: '윤도현', sub: '대학', met: 1, lastMet: '2026-01-01' });
    expect(digest.places.been).toEqual(['JP (2015)']);
    expect(digest.places.wish).toEqual(['IS']);
    expect(digest.diary).toEqual([{ date: '2026-01-03', note: '비 오는 날' }]);
    expect(count).toEqual({ moments: 2, people: 1, diary: 1, places: 1, me: 2 });
  });

  it('is empty, not broken, on a new device', () => {
    const { count } = gatherRecords('ko');
    expect(count).toEqual({ moments: 0, people: 0, diary: 0, places: 0, me: 0 });
  });
});

describe('is there enough for a memoir', () => {
  it('needs the life line, and two of the other four', () => {
    expect(memoirReadiness({ moments: 10, people: 5, diary: 10, places: 0, me: 0 }).ok).toBe(true);
    expect(memoirReadiness({ moments: 10, people: 5, diary: 0, places: 0, me: 0 }).ok).toBe(false);
    expect(memoirReadiness({ moments: 9, people: 50, diary: 50, places: 50, me: 50 }).ok).toBe(false);
    const r = memoirReadiness({ moments: 3, people: 1, diary: 0, places: 7, me: 0 });
    expect(r.items.map((i) => [i.key, i.have, i.need, i.met])).toEqual([
      ['moments', 3, 10, false], ['people', 1, 5, false], ['diary', 0, 10, false], ['places', 7, 5, true], ['me', 0, 10, false],
    ]);
  });
});

describe('the 사주 store and request', () => {
  it('keeps the hour, the gender and the readings, and nothing broken', () => {
    expect(decodeSaju({ version: 1, time: '25:00', gender: 'other', readings: [{ text: ' ', createdAt: 'x' }, { text: '글', createdAt: '2026-01-01' }] }))
      .toEqual({ version: 1, readings: [{ text: '글', createdAt: '2026-01-01' }] });
    expect(decodeSaju({ version: 2 })).toBeNull();
    const s = decodeSaju({ version: 1, gender: 'female', time: '08:30', readings: [] });
    expect(JSON.stringify(decodeSaju(s))).toBe(JSON.stringify(s));
  });

  it('draws the chart, with the ten-year periods only once a gender is given', () => {
    const plain = viewChart('1990-05-15', '08:30', undefined, new Date(2026, 8, 23));
    expect(plain.columns.map((c) => c.label)).toEqual(['hour', 'day', 'month', 'year']);
    expect(plain.daeun).toBeNull();
    const withGender = viewChart('1990-05-15', '08:30', 'female', new Date(2026, 8, 23));
    expect(withGender.daeun?.periods).toHaveLength(10);
    expect(withGender.current).toBeGreaterThanOrEqual(0);
    expect(viewChart('1990-05-15', undefined, undefined).columns[0].pillar).toBeNull();
  });

  it('tells the writer the chart in words, and says what is not known', () => {
    const { digest } = gatherRecords('ko');
    const req = buildSajuRequest('ko', '1990-05-15', emptySaju(), digest, new Date(2026, 8, 23));
    expect(req.chart.pillars[0]).toContain('hour unknown');
    expect(req.chart.pillars[1]).toMatch(/^일주 /);
    expect(req.chart.notes.join(' ')).toMatch(/hour of birth is not known/);
    expect(req.chart.daeun).toEqual([]);
    expect(req.chart.thisYear).toMatch(/^2026 병오\(丙午\)$/);
  });
});
