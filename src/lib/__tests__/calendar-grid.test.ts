import { describe, expect, it } from 'vitest';
import { dateKey, monthCells, monthPair, shiftMonth, thisMonth, todayKey } from '../calendar-grid';

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
  });

  it('lays a month out in whole weeks starting Sunday', () => {
    // 2026-09-01 is a Tuesday → two leading blanks, 30 days.
    const cells = monthCells(2026, 8);
    expect(cells.length % 7).toBe(0);
    expect(cells.slice(0, 2)).toEqual([null, null]);
    expect(cells[2]).toEqual({ day: 1, key: '2026-09-01' });
    expect(cells.filter(Boolean)).toHaveLength(30);
  });

  it('handles a leap February', () => {
    expect(monthCells(2024, 1).filter(Boolean)).toHaveLength(29);
    expect(monthCells(2026, 1).filter(Boolean)).toHaveLength(28);
  });
});
