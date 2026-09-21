import { beforeEach, describe, expect, it } from 'vitest';
import { addSharedLine, lineFromShared, readLife } from '../life-invite';
import { LIFE_KEY, emptyLife, type LifeData } from '../life';

const shared = (over: Partial<LifeData> = {}): LifeData => ({
  ...emptyLife(),
  profile: { birthDate: '1958-03-02', name: '이정숙' },
  milestones: [{ id: 'a', date: '1984-05-01', title: '결혼', category: 'relationship' }],
  ...over,
});

const mine = (others: LifeData['others'] = []): LifeData => ({
  ...emptyLife(),
  profile: { birthDate: '1985-05-15', name: '나' },
  ...(others?.length ? { others } : {}),
});

const store = (life: LifeData) => localStorage.setItem(LIFE_KEY, JSON.stringify(life));

describe('a shared life, kept', () => {
  beforeEach(() => localStorage.clear());

  it('arrives as a line of its own, with its moments', () => {
    const line = lineFromShared(shared(), '');
    expect(line.name).toBe('이정숙');
    expect(line.birthDate).toBe('1958-03-02');
    expect(line.milestones).toHaveLength(1);
    expect(line.milestones[0].id).not.toBe('a'); // ids of its own on this device
    expect(line.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('is written beside my own line, which is not touched', () => {
    store(mine());
    expect(addSharedLine(shared())).toBe('added');
    const back = readLife();
    expect(back.profile.name).toBe('나');
    expect(back.others).toHaveLength(1);
    expect(back.others![0].name).toBe('이정숙');
  });

  it('is not added twice by opening the link again', () => {
    store(mine());
    expect(addSharedLine(shared())).toBe('added');
    expect(addSharedLine(shared())).toBe('already');
    expect(readLife().others).toHaveLength(1);
  });

  it('stops at the free plan rather than half-adding', () => {
    store(mine([{ id: 'x', name: '누구', birthDate: '1990-01-01', milestones: [] }]));
    expect(addSharedLine(shared())).toBe('full');
    expect(readLife().others).toHaveLength(1);
    expect(addSharedLine(shared(), { pro: true })).toBe('added');
    expect(readLife().others).toHaveLength(2);
  });

  it('is always called something, because a nameless line is dropped', () => {
    // A sharer may leave their name out; the record's own decoder will not
    // keep a line without one, so it must never be written without one.
    store(mine());
    expect(addSharedLine(shared({ profile: { birthDate: '1958-03-02' } }))).toBe('added');
    const kept = readLife().others;
    expect(kept).toHaveLength(1);
    expect(kept![0].name).toBe('1958');
    expect(lineFromShared(shared({ profile: { birthDate: '1958-03-02' } }), '이름 없음').name).toBe('이름 없음');
  });

  it('refuses a life it cannot draw', () => {
    expect(addSharedLine(null)).toBe('blank');
    expect(addSharedLine(shared({ profile: { birthDate: '1958' } }))).toBe('blank');
  });

  it('starts a record when there is not one yet', () => {
    expect(addSharedLine(shared())).toBe('added');
    expect(readLife().others).toHaveLength(1);
  });
});
