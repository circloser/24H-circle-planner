import { describe, expect, it } from 'vitest';
import { MAX_SHARE_CODE, decodeLifeShare, encodeLifeShare, lifeSharePayload } from '../life-share';
import { emptyLife, type LifeData, type Milestone } from '../life';

const ms = (id: string, date: string, extra: Partial<Milestone> = {}): Milestone =>
  ({ id, date, title: `사건 ${id}`, category: 'other', isPlan: false, ...extra });
const life = (over: Partial<LifeData> = {}): LifeData => ({
  ...emptyLife(),
  profile: { name: '김하루', birthDate: '1985-05-15' },
  family: [
    { id: 'f1', relation: 'mother', name: '이정숙', birthDate: '1958-03-02', note: '메모', photo: 'p1' },
    { id: 'f2', relation: 'father', name: '김영수' },
  ],
  milestones: [ms('a', '2010-05-15', { title: '첫 직장', category: 'career', description: '작은 스튜디오', photo: 'p2' }), ms('b', '2031', { isPlan: true })],
  endingNote: { text: '고마웠어요', updatedAt: '2026-01-01T00:00:00.000Z' },
  ...over,
});

describe('a life share link', () => {
  it('carries the line, and never a photo', () => {
    const back = decodeLifeShare(encodeLifeShare(life())!)!;
    expect(back.profile).toEqual({ name: '김하루', birthDate: '1985-05-15' });
    expect(back.milestones.map((m) => [m.title, m.date, m.category, m.isPlan]))
      .toEqual([['첫 직장', '2010-05-15', 'career', false], ['사건 b', '2031', 'other', true]]);
    expect(back.milestones[0].description).toBe('작은 스튜디오');
    expect(back.endingNote?.text).toBe('고마웠어요');
    expect(back.family.map((f) => [f.relation, f.name])).toEqual([['mother', '이정숙'], ['father', '김영수']]);
    expect(back.milestones.some((m) => m.photo)).toBe(false);
    expect(back.family.some((f) => f.photo)).toBe(false);
    // …and the parents' notes are theirs, not the viewer's business.
    expect(back.family.some((f) => f.note)).toBe(false);
  });

  it('can leave every name out', () => {
    const payload = lifeSharePayload(life(), { hideNames: true });
    expect(payload.n).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain('이정숙');
    expect(payload.f).toEqual([['mother', ''], ['father', '']]);
  });

  it('trims a very long life until the server will take it', () => {
    const many = life({
      milestones: Array.from({ length: 400 }, (_, i) => ms(`m${i}`, String(1990 + (i % 40)), { description: '가'.repeat(900) })),
    });
    const code = encodeLifeShare(many)!;
    expect(code.length).toBeLessThanOrEqual(MAX_SHARE_CODE);
    expect(decodeLifeShare(code)!.milestones.length).toBeGreaterThan(0);
  });

  it('refuses what is not a life link', () => {
    expect(decodeLifeShare('not-base64url!!')).toBeNull();
    expect(decodeLifeShare(btoa('{"v":1,"n":"x","s":[]}').replace(/=+$/, ''))).toBeNull();
  });
});
