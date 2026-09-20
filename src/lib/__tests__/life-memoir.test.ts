import { describe, expect, it } from 'vitest';
import { decodeLife, emptyLife, encodeLife, type LifeData, type Milestone } from '../life';
import {
  buildMemoirRequest, canWriteMemoir, formatMemoirPrice, memoirBlocks,
} from '../life-memoir';

const ms = (id: string, date: string, extra: Partial<Milestone> = {}): Milestone =>
  ({ id, date, title: id, category: 'other', isPlan: false, ...extra });
const life = (over: Partial<LifeData> = {}): LifeData =>
  ({ ...emptyLife(), profile: { birthDate: '1985-05-15' }, ...over });

describe('what is sent to have a memoir written', () => {
  it('is the line in order, with the ages that are actually known', () => {
    const req = buildMemoirRequest(life({
      profile: { birthDate: '1985-05-15', name: '하늘' },
      milestones: [
        ms('b', '2010-03-02', { title: '첫 직장', category: 'career', description: '서울' }),
        ms('a', '2004', { title: '대학 입학', category: 'education' }),
      ],
      endingNote: { text: '고마웠어요', updatedAt: '' },
    }), 'ko', ' 담담하게 ');
    expect(req).toEqual({
      lang: 'ko',
      name: '하늘',
      birthDate: '1985-05-15',
      moments: [
        // The year alone leaves the birthday open, so no age is claimed.
        { date: '2004', title: '대학 입학', category: 'education' },
        { date: '2010-03-02', title: '첫 직장', category: 'career', description: '서울', age: 24 },
      ],
      endingNote: '고마웠어요',
      wish: '담담하게',
    });
  });

  it('never carries a photograph — there is nowhere for one to go', () => {
    const req = buildMemoirRequest(life({
      milestones: [ms('a', '2004', { photo: 'p1abc234' })],
      family: [{ id: 'f1', relation: 'mother', name: '엄마', photo: 'p2abc234' }],
    }), 'ko');
    expect(JSON.stringify(req)).not.toContain('p1abc234');
    expect(JSON.stringify(req)).not.toContain('p2abc234');
    // The family is not sent at all: those are someone else's facts.
    expect(JSON.stringify(req)).not.toContain('엄마');
  });

  it('leaves out what is not there, rather than sending empty fields', () => {
    const req = buildMemoirRequest(life({ milestones: [ms('a', '2004')], profile: { birthDate: '' } }), 'en');
    expect(req).toEqual({ lang: 'en', moments: [{ date: '2004', title: 'a', category: 'other' }] });
  });

  it('needs a birthday and three moments before it is worth writing', () => {
    expect(canWriteMemoir(life({ milestones: [ms('a', '2004'), ms('b', '2005')] }))).toBe(false);
    expect(canWriteMemoir(life({ milestones: [ms('a', '2004'), ms('b', '2005'), ms('c', '2006')] }))).toBe(true);
    expect(canWriteMemoir(life({ profile: { birthDate: '' }, milestones: [ms('a', '2004'), ms('b', '2005'), ms('c', '2006')] }))).toBe(false);
  });
});

describe('the price', () => {
  it('is written the way the reader writes money', () => {
    expect(formatMemoirPrice({ amount: 100, currency: 'usd' }, 'en')).toBe('$1.00');
    expect(formatMemoirPrice({ amount: 250, currency: 'usd' }, 'ko')).toContain('2.50');
    expect(formatMemoirPrice(null, 'ko')).toBeNull();
  });

  it('says something sensible for a currency the browser does not know', () => {
    // Intl spells an unknown code out; whatever space it picks, both parts show.
    expect(formatMemoirPrice({ amount: 100, currency: 'zzz' }, 'en')).toMatch(/^ZZZ\s1\.00$/);
  });
});

describe('reading the memoir back', () => {
  it('turns chapter titles and paragraphs into what the page shows', () => {
    expect(memoirBlocks('## 첫 장\n나는 1985년에 태어났다.\n\n그리고 자랐다.\n\n## 끝 장\n여기까지.')).toEqual([
      { kind: 'h', text: '첫 장' },
      { kind: 'p', text: '나는 1985년에 태어났다.' },
      { kind: 'p', text: '그리고 자랐다.' },
      { kind: 'h', text: '끝 장' },
      { kind: 'p', text: '여기까지.' },
    ]);
  });

  it('holds together while the text is still arriving', () => {
    expect(memoirBlocks('## 첫')).toEqual([{ kind: 'h', text: '첫' }]);
    expect(memoirBlocks('## ')).toEqual([]);
    expect(memoirBlocks('')).toEqual([]);
    expect(memoirBlocks('\n\n\n')).toEqual([]);
  });
});

describe('the memoir in the record', () => {
  it('survives a save and a load, and is kept byte for byte', () => {
    const written = { ...life(), memoir: { text: '나는 태어났다.', createdAt: '2026-09-20T00:00:00.000Z' } };
    const stored = encodeLife(written);
    expect(stored.memoir).toEqual(written.memoir);
    expect(JSON.stringify(encodeLife(stored))).toBe(JSON.stringify(stored));
  });

  it('is nothing at all when it is empty or malformed', () => {
    expect(decodeLife({ version: 1, profile: { birthDate: '' }, memoir: { text: '' } })?.memoir).toBeNull();
    expect(decodeLife({ version: 1, profile: { birthDate: '' }, memoir: 'a memoir' })?.memoir).toBeNull();
    expect(decodeLife({ version: 1, profile: { birthDate: '' } })?.memoir).toBeNull();
  });

  it('is cut to a length a sync blob can carry', () => {
    const huge = decodeLife({ version: 1, profile: { birthDate: '' }, memoir: { text: 'x'.repeat(60_000) } });
    expect(huge?.memoir?.text.length).toBe(40_000);
  });
});
