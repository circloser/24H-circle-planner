import { describe, expect, it } from 'vitest';
import { emptyLife, type LifeData, type Milestone } from '../life';
import {
  EDGE_PX, MAX_SPAN, MIN_SPAN, YEAR_PX, ageAtYear, buildParallel, linesOf, stackLabels, yearAt,
} from '../life-parallel';

const moment = (id: string, date: string, title = id): Milestone =>
  ({ id, date, title, category: 'other' });

const life = (over: Partial<LifeData> = {}): LifeData => ({
  ...emptyLife(),
  profile: { birthDate: '1985-05-15', name: '나' },
  milestones: [moment('m1', '2005-03-02', '대학 입학')],
  ...over,
});

const other = (id: string, birth: string, ms: Milestone[] = []) =>
  ({ id, name: id, birthDate: birth, milestones: ms });

describe('a date as a place on the year axis', () => {
  it('puts a year at the year, and a month part way through it', () => {
    expect(yearAt('2010')).toBe(2010);
    expect(yearAt('2010-07')).toBeCloseTo(2010.5, 1);
    expect(yearAt('2010-12-31')).toBeGreaterThan(yearAt('2010-01-01'));
    expect(yearAt('2010-12-31')).toBeLessThan(2011);
  });

  it('says how old somebody was, and nothing when they were not born yet', () => {
    expect(ageAtYear('1985-05-15', '2005-03-02')).toBe(19);
    expect(ageAtYear('1985-05-15', '1985-06-01')).toBe(0);
    expect(ageAtYear('1985-05-15', '1980-01-01')).toBeNull();
    expect(ageAtYear('', '2005-01-01')).toBeNull();
  });
});

describe('who is on the chart', () => {
  it('is me first, and then whoever was added', () => {
    const out = linesOf(life({ others: [other('a', '1960'), other('b', '2012')] }));
    expect(out.map((l) => l.line.id)).toEqual(['me', 'a', 'b']);
    expect(out[0].mine).toBe(true);
    expect(out.slice(1).some((l) => l.mine)).toBe(false);
  });

  it('never draws more lines than can be read at once', () => {
    const many = Array.from({ length: 20 }, (_, i) => other(`p${i}`, '1990'));
    expect(linesOf(life({ others: many })).length).toBeLessThanOrEqual(10);
  });
});

describe('the chart itself', () => {
  it('gives every line the same scale, so a year is one height', () => {
    const chart = buildParallel(life({
      others: [other('mum', '1958-03-02', [moment('x', '2005-03-02')])],
    }), { today: '2026-09-21' });
    const mine = chart.lines.find((l) => l.mine)!;
    const mum = chart.lines.find((l) => l.id === 'mum')!;
    // The same year on two different lines is the same place down the page —
    // that is the whole reason for putting them side by side.
    expect(mine.moments[0].y).toBeCloseTo(mum.moments[0].y, 6);
    // And the older line starts higher up.
    expect(mum.from).toBeLessThan(mine.from);
  });

  it('runs from the earliest birth to the furthest thing on it', () => {
    const chart = buildParallel(life({
      others: [other('gran', '1930-01-01')],
    }), { today: '2026-09-21' });
    expect(chart.first).toBe(1930);
    expect(chart.last).toBeGreaterThanOrEqual(2050);
    expect(chart.height).toBeGreaterThan(0);
  });

  it('stretches with the zoom, and stops stretching at the ends', () => {
    const at = (span: number) => buildParallel(life(), { today: '2026-09-21', span }).height;
    expect(at(2)).toBeGreaterThan(at(1));
    expect(at(MAX_SPAN * 4)).toBe(at(MAX_SPAN));
    expect(at(MIN_SPAN / 4)).toBe(at(MIN_SPAN));
  });

  it('labels every year when there is room and every tenth when there is not', () => {
    const close = buildParallel(life(), { today: '2026-09-21', span: 1 });
    const far = buildParallel(life(), { today: '2026-09-21', span: MIN_SPAN });
    const gap = (c: typeof close) => c.ticks[1].year - c.ticks[0].year;
    expect(gap(close)).toBe(1);
    expect(gap(far)).toBeGreaterThan(1);
    expect(far.ticks.length).toBeLessThan(close.ticks.length);
  });

  it('folds a line away when asked, and never folds mine', () => {
    const data = life({ others: [other('a', '1960')] });
    const chart = buildParallel(data, { today: '2026-09-21', hidden: new Set(['a', 'me']) });
    expect(chart.lines.map((l) => l.id)).toEqual(['me']);
  });

  it('leaves out anyone with no birthday to hang the years on', () => {
    const chart = buildParallel(life({ others: [{ id: 'x', name: 'x', birthDate: '', milestones: [] }] }),
      { today: '2026-09-21' });
    expect(chart.lines.map((l) => l.id)).toEqual(['me']);
  });

  it('has something to say even about an empty life', () => {
    const chart = buildParallel(emptyLife(), { today: '2026-09-21' });
    expect(chart.lines).toEqual([]);
    expect(chart.height).toBe(EDGE_PX * 2);
    expect(chart.ticks).toEqual([]);
  });

  it('marks where today falls, on the same scale as everything else', () => {
    const chart = buildParallel(life(), { today: '2026-09-21', span: 1 });
    const mine = chart.lines[0];
    expect(chart.today).toBeGreaterThan(mine.from);
    expect(chart.today).toBeLessThan(mine.to);
    expect(mine.now).toBeCloseTo(chart.today, 6);
    // A year is YEAR_PX at rest, whatever else changes.
    const ticks = chart.ticks;
    expect(ticks[1].y - ticks[0].y).toBeCloseTo(YEAR_PX, 6);
  });

  it('puts the moments in the order they happened, with an age on each', () => {
    const chart = buildParallel(life({
      milestones: [moment('b', '2012-06-01'), moment('a', '2005-03-02')],
    }), { today: '2026-09-21' });
    expect(chart.lines[0].moments.map((m) => m.milestone.id)).toEqual(['a', 'b']);
    expect(chart.lines[0].moments[0].age).toBe(19);
    expect(chart.lines[0].moments[0].year).toBe(2005);
  });
});

describe('labels that would land on each other', () => {
  it('keeps them in order and a readable distance apart', () => {
    const out = stackLabels([10, 12, 13, 60], 16);
    expect(out).toEqual([10, 26, 42, 60]);
    for (let i = 1; i < out.length; i++) expect(out[i] - out[i - 1]).toBeGreaterThanOrEqual(16);
  });

  it('leaves alone what was never crowded', () => {
    expect(stackLabels([0, 40, 80], 16)).toEqual([0, 40, 80]);
    expect(stackLabels([], 16)).toEqual([]);
  });
});
