import { describe, expect, it } from 'vitest';
import { decodeRelation, encodeRelation, emptyRelation } from '../relation';
import {
  MAX_ANSWER_VERSIONS, answered, cleanMeRecord, isMbti, latest, moodAverage, newestFirst, resumeOf,
  type RelationMe,
} from '../relation-me';
import { ME_QUESTIONS } from '../../data/me-questions';

const me = (over: Partial<RelationMe> = {}): RelationMe => ({ name: '나', ...over });

describe('my own record in the middle of the map', () => {
  it('keeps what it understands, in one order, and writes no empty lists', () => {
    const out = decodeRelation({
      version: 3, people: [], links: [],
      me: {
        name: '김하루',
        resume: [
          { k: 'career', v: '첫 회사', from: '2010-03', to: '2014-12' },
          { k: 'nonsense', v: 'x' },
          { k: 'education', v: '대학교', from: 'long ago' },
        ],
        mbti: [{ v: 'INFP', at: '2020-01-01' }, { v: 'XXXX', at: '2021-01-01' }],
        answers: { q002: [{ v: '서울', at: '2026-01-01' }], q001: [{ v: '하루', at: '2026-01-01' }], junk: [{ v: 'x', at: '2026-01-01' }] },
        moods: [{ at: '2026-09-01', v: 4, note: '맑음' }, { at: '2026-09-02', v: 9 }],
        colour: 'red',
      },
    });
    expect(out?.me).toEqual({
      name: '김하루',
      resume: [
        { k: 'career', v: '첫 회사', from: '2010-03', to: '2014-12' },
        // A date nobody can read is dropped; the line is kept.
        { k: 'education', v: '대학교' },
      ],
      mbti: [{ v: 'INFP', at: '2020-01-01' }],
      answers: { q001: [{ v: '하루', at: '2026-01-01' }], q002: [{ v: '서울', at: '2026-01-01' }] },
      moods: [{ at: '2026-09-01', v: 4, note: '맑음' }],
    });
    expect(cleanMeRecord({ resume: [], mbti: [], answers: {}, moods: [] })).toEqual({});
  });

  it('saves the same bytes it loads', () => {
    const once = encodeRelation({
      ...emptyRelation(),
      me: { answers: { q010: [{ v: 'b', at: '2026-02-02' }], q003: [{ v: 'a', at: '2026-01-01' }] }, name: 'x' },
    });
    expect(Object.keys(once.me.answers ?? {})).toEqual(['q003', 'q010']);
    expect(JSON.stringify(encodeRelation(once))).toBe(JSON.stringify(once));
  });

  it('keeps no more versions of one answer than it should', () => {
    const many = Array.from({ length: MAX_ANSWER_VERSIONS + 5 }, (_, i) => ({ v: `a${i}`, at: `2026-01-${String((i % 28) + 1).padStart(2, '0')}` }));
    expect(cleanMeRecord({ answers: { q001: many } }).answers?.q001).toHaveLength(MAX_ANSWER_VERSIONS);
  });

  it('reads back the latest of anything dated, and the rest newest first', () => {
    const list = [{ v: 'ENFP', at: '2019-05-01' }, { v: 'INFP', at: '2024-03-01' }, { v: 'INFJ', at: '2021-01-01' }];
    expect(latest(list)?.v).toBe('INFP');
    expect(newestFirst(list).map((d) => d.v)).toEqual(['INFP', 'INFJ', 'ENFP']);
    expect(latest(undefined)).toBeNull();
    expect(isMbti('INTJ')).toBe(true);
    expect(isMbti('INTX')).toBe(false);
  });

  it('lists a résumé by kind, the one still going first', () => {
    const r = me({ resume: [
      { k: 'career', v: 'A', from: '2010', to: '2014' },
      { k: 'career', v: 'C', from: '2019' },
      { k: 'career', v: 'B', from: '2015', to: '2018' },
      { k: 'education', v: 'U', from: '2004', to: '2008' },
    ] });
    expect(resumeOf(r, 'career').map((e) => e.v)).toEqual(['C', 'B', 'A']);
    expect(resumeOf(r, 'education').map((e) => e.v)).toEqual(['U']);
  });

  it('counts the answered questions and averages the recent moods', () => {
    expect(answered(me({ answers: { q001: [{ v: 'a', at: '2026-01-01' }] } }))).toBe(1);
    expect(moodAverage(me())).toBeNull();
    expect(moodAverage(me({ moods: [{ at: '2026-01-01', v: 2 }, { at: '2026-01-02', v: 5 }] }))).toBe(3.5);
    expect(moodAverage(me({ moods: [{ at: '2026-01-01', v: 1 }, { at: '2026-01-02', v: 5 }] }), 1)).toBe(5);
  });
});

describe('the hundred questions', () => {
  it('are a hundred, each with its own id, in both languages', () => {
    expect(ME_QUESTIONS).toHaveLength(100);
    expect(new Set(ME_QUESTIONS.map((q) => q.id)).size).toBe(100);
    expect(ME_QUESTIONS.every((q, i) => q.id === `q${String(i + 1).padStart(3, '0')}` && q.ko && q.en)).toBe(true);
  });
});
