import { describe, expect, it } from 'vitest';
import { MIN_BOARD_ZOOM, PHONE_LINES, boardLines, boardZoom, lineAsLife } from '../life-lines';
import { buildTimeline, emptyLife, type LifeData, type LifeLine } from '../life';

const moment = (id: string, date: string, title = id) =>
  ({ id, date, title, category: 'career' as const });

const line = (id: string, birthDate: string, name = id): LifeLine =>
  ({ id, name, birthDate, milestones: [moment(`${id}-1`, '2010-03-02')] });

const mine = (others?: LifeLine[]): LifeData => ({
  ...emptyLife(),
  profile: { birthDate: '1985-05-15', name: '나' },
  milestones: [moment('m1', '2008-01-01')],
  ...(others ? { others } : {}),
});

describe('the columns on the board', () => {
  it('always starts with mine', () => {
    const board = boardLines(mine([line('a', '1958-03-02')]));
    expect(board.map((b) => b.id)).toEqual(['me', 'a']);
    expect(board[0].mine).toBe(true);
    expect(board[1].name).toBe('a');
  });

  it('is mine alone when nobody else has been added', () => {
    expect(boardLines(mine()).map((b) => b.id)).toEqual(['me']);
  });

  it('leaves out whoever is folded away', () => {
    const board = boardLines(mine([line('a', '1958'), line('b', '1990')]), { hidden: new Set(['a']) });
    expect(board.map((b) => b.id)).toEqual(['me', 'b']);
  });

  it('holds two on a phone: mine, and the first of the others', () => {
    const life = mine([line('a', '1958'), line('b', '1990'), line('c', '2011')]);
    expect(boardLines(life, { max: PHONE_LINES }).map((b) => b.id)).toEqual(['me', 'a']);
    // Choosing somebody on a phone moves them to the front of the record, so
    // the phone and the wide screen never disagree about who is where.
    const moved = { ...life, others: [life.others![2], life.others![0], life.others![1]] };
    expect(boardLines(moved, { max: PHONE_LINES }).map((b) => b.id)).toEqual(['me', 'c']);
    expect(boardLines(moved).map((b) => b.id)).toEqual(['me', 'c', 'a', 'b']);
  });

  it('draws somebody else exactly as a life of their own', () => {
    const l = lineAsLife(line('a', '1958-03-02', '이정숙'));
    expect(l.profile).toEqual({ birthDate: '1958-03-02', name: '이정숙' });
    expect(l.milestones).toHaveLength(1);
    // The same builder draws it: that is the whole point of the shape.
    const items = buildTimeline(l, { today: '2026-09-21' });
    expect(items.some((i) => i.kind === 'birth')).toBe(true);
    expect(items.some((i) => i.kind === 'today')).toBe(true);
  });

  it('keeps a nameless line nameless rather than inventing one', () => {
    expect(lineAsLife({ id: 'x', name: '', birthDate: '1990', milestones: [] }).profile.name).toBeUndefined();
  });

  it('fills in a half-known birthday so the line can still be drawn', () => {
    // A record from an older version, or a restored backup, may hold a year.
    expect(lineAsLife({ id: 'x', name: 'n', birthDate: '1990', milestones: [] }).profile.birthDate).toBe('1990-01-01');
    expect(lineAsLife({ id: 'x', name: 'n', birthDate: '1990-03', milestones: [] }).profile.birthDate).toBe('1990-03-01');
    expect(buildTimeline(lineAsLife({ id: 'x', name: 'n', birthDate: '1990', milestones: [] }), { today: '2026-09-21' })
      .some((i) => i.kind === 'birth')).toBe(true);
  });
});

describe('the order the lines are drawn in', () => {
  it('follows the record, mine first', () => {
    const life = mine([line('a', '1958'), line('b', '1990')]);
    expect(boardLines(life).map((b) => b.id)).toEqual(['me', 'a', 'b']);
    const swapped = { ...life, others: [life.others![1], life.others![0]] };
    expect(boardLines(swapped).map((b) => b.id)).toEqual(['me', 'b', 'a']);
  });

  it('and a phone takes the first two of that same order', () => {
    const life = mine([line('a', '1958'), line('b', '1990')]);
    const swapped = { ...life, others: [life.others![1], life.others![0]] };
    expect(boardLines(swapped, { max: PHONE_LINES }).map((b) => b.id)).toEqual(['me', 'b']);
    // Whoever is folded away is not in that order at all.
    expect(boardLines(swapped, { max: PHONE_LINES, hidden: new Set(['b']) }).map((b) => b.id))
      .toEqual(['me', 'a']);
  });
});

describe('how far out the board starts', () => {
  const desk = 1900;
  const laptop = 1280;

  it('draws them at their own size while there is room for it', () => {
    expect(boardZoom(1, desk)).toBe(1);
    expect(boardZoom(2, desk)).toBe(1);
    expect(boardZoom(3, desk)).toBe(1);
  });

  it('stands further back the more lines share the room', () => {
    expect(boardZoom(5, desk)).toBeLessThan(1);
    expect(boardZoom(6, desk)).toBeLessThan(boardZoom(5, desk));
  });

  it('and further back on a smaller screen, for the same lines', () => {
    expect(boardZoom(4, laptop)).toBeLessThan(boardZoom(4, desk));
  });

  it('never goes smaller than it can be read at', () => {
    expect(boardZoom(10, desk)).toBe(MIN_BOARD_ZOOM);
    expect(boardZoom(10, 320)).toBe(MIN_BOARD_ZOOM);
  });

  it('answers something sensible before the board has been measured', () => {
    expect(boardZoom(4)).toBe(1);
    expect(boardZoom(0, desk)).toBe(1);
  });
});
