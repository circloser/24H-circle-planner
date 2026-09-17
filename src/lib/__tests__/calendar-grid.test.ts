import { describe, expect, it } from 'vitest';
import { addDays, dateKey, dayGap, homeOf, monthCells, monthPair, partsOf, shiftMonth, thisMonth, todayKey, weekdayOf } from '../calendar-grid';

describe('calendar grid', () => {
  it('moves by whole months, rolling the year over both ways', () => {
    expect(shiftMonth({ y: 2026, m: 10 }, 1)).toEqual({ y: 2026, m: 11 });
    expect(shiftMonth({ y: 2026, m: 11 }, 1)).toEqual({ y: 2027, m: 0 });
    expect(shiftMonth({ y: 2026, m: 0 }, -1)).toEqual({ y: 2025, m: 11 });
    expect(shiftMonth({ y: 2026, m: 5 }, -18)).toEqual({ y: 2024, m: 11 });
  });

  it('shows a month and the one after it side by side', () => {
    expect(monthPair({ y: 2026, m: 11 })).toEqual([{ y: 2026, m: 11 }, { y: 2027, m: 0 }]);
  });

  it('keys days in local time (an evening is not filed under the next day)', () => {
    expect(dateKey(2026, 8, 5)).toBe('2026-09-05');
    const evening = new Date(2026, 8, 5, 23, 30);
    expect(todayKey(evening)).toBe('2026-09-05');
    expect(thisMonth(evening)).toEqual({ y: 2026, m: 8 });
    expect(partsOf('2026-09-05')).toEqual({ y: 2026, m: 8, d: 5 });
    expect(weekdayOf('2026-09-05')).toBe(6); // a Saturday
    expect(weekdayOf('2026-09-06')).toBe(0); // …and the Sunday after it
  });

  it('always lays a month out as five weeks from Sunday', () => {
    // 2026-09-01 is a Tuesday, so the grid opens on Sunday 2026-08-30.
    const cells = monthCells(2026, 8);
    expect(cells).toHaveLength(35);
    expect(cells[0]).toEqual({ day: 30, key: '2026-08-30', inMonth: false });
    expect(cells[2]).toEqual({ day: 1, key: '2026-09-01', inMonth: true });
    expect(cells.filter((c) => c.inMonth)).toHaveLength(30);
    // The padding days are real neighbouring dates, not blanks.
    expect(cells.at(-1)).toEqual({ day: 3, key: '2026-10-03', inMonth: false });
  });

  it('carries a sixth week\'s days over to the next month', () => {
    // August 2026 opens on a Saturday: its 30th and 31st do not fit in five
    // weeks, and open September's grid instead.
    const aug = monthCells(2026, 7);
    expect(aug.filter((c) => c.inMonth).map((c) => c.day).at(-1)).toBe(29);
    expect(homeOf('2026-08-31')).toEqual({ y: 2026, m: 8, index: 1 });
    expect(homeOf('2026-08-29')).toEqual({ y: 2026, m: 7, index: 34 });
    expect(homeOf('2026-12-31')).toEqual({ y: 2026, m: 11, index: 32 });
    // Every day of a year has exactly one home where it is drawn as its own
    // month's day or as the carried-over head of the next.
    for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 1)) {
      const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      const home = homeOf(key);
      expect(monthCells(home.y, home.m)[home.index]?.key).toBe(key);
    }
  });

  it('handles a leap February', () => {
    expect(monthCells(2024, 1).filter((c) => c.inMonth)).toHaveLength(29);
    expect(monthCells(2026, 1).filter((c) => c.inMonth)).toHaveLength(28);
  });
});

describe('day arithmetic', () => {
  it('steps forward and back across month and year ends', () => {
    expect(addDays('2026-09-16', 3)).toBe('2026-09-19');
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('counts whole days between two dates, in either direction', () => {
    expect(dayGap('2026-09-16', '2026-09-19')).toBe(3);
    expect(dayGap('2026-09-19', '2026-09-16')).toBe(-3);
    expect(dayGap('2026-09-16', '2026-09-16')).toBe(0);
    // A daylight-saving change in between must not cost a day.
    expect(dayGap('2026-03-01', '2026-04-01')).toBe(31);
  });
});
