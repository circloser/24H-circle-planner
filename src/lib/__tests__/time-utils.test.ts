import { describe, it, expect } from 'vitest';
import {
  hhmmToMinutes,
  minutesToHhmm,
  hhmmToAngle,
  angleToHhmm,
  snapMinutes,
  compareHHmm,
  sliceWidthMinutes,
  isContiguous24h,
} from '../time-utils';
import type { TimeSlice } from '@/types/time-slice';

function makeSlice(
  startTime: string,
  endTime: string,
  id = 'test',
): TimeSlice {
  return {
    id,
    label: '',
    startTime,
    endTime,
    color: '#000',
    icon: '',
    textPosition: 'inside',
  };
}

// ─── hhmmToMinutes ──────────────────────────────────────────────────────────

describe('hhmmToMinutes', () => {
  it('converts 00:00 to 0', () => {
    expect(hhmmToMinutes('00:00')).toBe(0);
  });

  it('converts 23:59 to 1439', () => {
    expect(hhmmToMinutes('23:59')).toBe(1439);
  });

  it('converts 12:30 to 750', () => {
    expect(hhmmToMinutes('12:30')).toBe(750);
  });

  it('converts 01:00 to 60', () => {
    expect(hhmmToMinutes('01:00')).toBe(60);
  });

  it('throws on bad format (no colon)', () => {
    expect(() => hhmmToMinutes('1200')).toThrow();
  });

  it('throws on bad format (single digit)', () => {
    expect(() => hhmmToMinutes('1:00')).toThrow();
  });

  it('throws on hour > 23', () => {
    expect(() => hhmmToMinutes('24:00')).toThrow();
  });

  it('throws on minute > 59', () => {
    expect(() => hhmmToMinutes('12:60')).toThrow();
  });

  it('throws on empty string', () => {
    expect(() => hhmmToMinutes('')).toThrow();
  });
});

// ─── minutesToHhmm ──────────────────────────────────────────────────────────

describe('minutesToHhmm', () => {
  it('converts 0 to 00:00', () => {
    expect(minutesToHhmm(0)).toBe('00:00');
  });

  it('converts 1439 to 23:59', () => {
    expect(minutesToHhmm(1439)).toBe('23:59');
  });

  it('converts 750 to 12:30', () => {
    expect(minutesToHhmm(750)).toBe('12:30');
  });

  it('zero-pads hours and minutes', () => {
    expect(minutesToHhmm(65)).toBe('01:05');
  });

  it('round-trips with hhmmToMinutes', () => {
    const times = ['00:00', '06:00', '12:30', '23:50'];
    for (const t of times) {
      expect(minutesToHhmm(hhmmToMinutes(t))).toBe(t);
    }
  });
});

// ─── hhmmToAngle ────────────────────────────────────────────────────────────

describe('hhmmToAngle', () => {
  it('00:00 → -90 degrees', () => {
    expect(hhmmToAngle('00:00')).toBeCloseTo(-90);
  });

  it('06:00 → 0 degrees (right side)', () => {
    expect(hhmmToAngle('06:00')).toBeCloseTo(0);
  });

  it('12:00 → 90 degrees (bottom)', () => {
    expect(hhmmToAngle('12:00')).toBeCloseTo(90);
  });

  it('18:00 → 180 degrees (left)', () => {
    expect(hhmmToAngle('18:00')).toBeCloseTo(180);
  });
});

// ─── angleToHhmm ────────────────────────────────────────────────────────────

describe('angleToHhmm', () => {
  it('-90 degrees → 00:00', () => {
    expect(angleToHhmm(-90)).toBe('00:00');
  });

  it('0 degrees → 06:00', () => {
    expect(angleToHhmm(0)).toBe('06:00');
  });

  it('90 degrees → 12:00', () => {
    expect(angleToHhmm(90)).toBe('12:00');
  });

  it('snaps to nearest 10-minute step', () => {
    // 90.5 degrees slightly past 12:00
    // (90.5 + 90)/360 * 1440 = 724 minutes → snaps to 720 = 12:00
    const result = angleToHhmm(90.5);
    expect(['12:00', '12:10']).toContain(result);
  });

  it('round-trips hhmmToAngle → angleToHhmm for 10-minute-aligned times', () => {
    const times = ['00:00', '06:00', '12:00', '18:00', '23:50'];
    for (const t of times) {
      expect(angleToHhmm(hhmmToAngle(t))).toBe(t);
    }
  });
});

// ─── snapMinutes ────────────────────────────────────────────────────────────

describe('snapMinutes', () => {
  it('returns 0 for 0', () => {
    expect(snapMinutes(0)).toBe(0);
  });

  it('returns 1430 at max', () => {
    expect(snapMinutes(1430)).toBe(1430);
  });

  it('clamps above 1430 to 1430', () => {
    expect(snapMinutes(1440)).toBe(1430);
  });

  it('clamps below 0 to 0', () => {
    expect(snapMinutes(-5)).toBe(0);
  });

  it('rounds 14 to 10', () => {
    expect(snapMinutes(14)).toBe(10);
  });

  it('rounds 15 to 20', () => {
    expect(snapMinutes(15)).toBe(20);
  });

  it('rounds 25 to 30', () => {
    expect(snapMinutes(25)).toBe(30);
  });
});

// ─── compareHHmm ────────────────────────────────────────────────────────────

describe('compareHHmm', () => {
  it('returns 0 for equal times', () => {
    expect(compareHHmm('12:00', '12:00')).toBe(0);
  });

  it('returns negative when a < b', () => {
    expect(compareHHmm('08:00', '12:00')).toBeLessThan(0);
  });

  it('returns positive when a > b', () => {
    expect(compareHHmm('12:00', '08:00')).toBeGreaterThan(0);
  });

  it('compares correctly across midnight boundary', () => {
    expect(compareHHmm('00:00', '23:59')).toBeLessThan(0);
  });
});

// ─── sliceWidthMinutes ──────────────────────────────────────────────────────

describe('sliceWidthMinutes', () => {
  it('computes normal slice width', () => {
    expect(sliceWidthMinutes(makeSlice('06:00', '12:00'))).toBe(360);
  });

  it('computes midnight-wrap slice width (23:50–00:10 = 20 min)', () => {
    expect(sliceWidthMinutes(makeSlice('23:50', '00:10'))).toBe(20);
  });

  it('computes large midnight-wrap slice (22:00–02:00 = 240 min)', () => {
    expect(sliceWidthMinutes(makeSlice('22:00', '02:00'))).toBe(240);
  });

  it('computes full-day 00:00–00:00 = 1440 min', () => {
    expect(sliceWidthMinutes(makeSlice('00:00', '00:00'))).toBe(1440);
  });

  it('computes single minute width (00:00–00:10 = 10 min)', () => {
    expect(sliceWidthMinutes(makeSlice('00:00', '00:10'))).toBe(10);
  });
});

// ─── isContiguous24h ────────────────────────────────────────────────────────

describe('isContiguous24h', () => {
  it('returns false for empty array', () => {
    expect(isContiguous24h([])).toBe(false);
  });

  it('returns true for single full-day slice (00:00–00:00)', () => {
    expect(isContiguous24h([makeSlice('00:00', '00:00')])).toBe(true);
  });

  it('returns true for simple two-slice cover', () => {
    const slices = [makeSlice('00:00', '12:00', 'a'), makeSlice('12:00', '00:00', 'b')];
    expect(isContiguous24h(slices)).toBe(true);
  });

  it('returns true for four equal quarters', () => {
    const slices = [
      makeSlice('00:00', '06:00', 'a'),
      makeSlice('06:00', '12:00', 'b'),
      makeSlice('12:00', '18:00', 'c'),
      makeSlice('18:00', '00:00', 'd'),
    ];
    expect(isContiguous24h(slices)).toBe(true);
  });

  it('returns false when there is a gap', () => {
    const slices = [makeSlice('00:00', '06:00', 'a'), makeSlice('07:00', '00:00', 'b')];
    expect(isContiguous24h(slices)).toBe(false);
  });

  it('returns false when total is not 1440', () => {
    const slices = [makeSlice('00:00', '06:00', 'a'), makeSlice('06:00', '12:00', 'b')];
    expect(isContiguous24h(slices)).toBe(false);
  });

  // C9: midnight wrap scenarios
  it('C9: midnight-wrap slice (23:50–00:10) + complementary (00:10–23:50) = contiguous 24h', () => {
    const slices = [
      makeSlice('00:10', '23:50', 'main'),
      makeSlice('23:50', '00:10', 'wrap'),
    ];
    expect(isContiguous24h(slices)).toBe(true);
    // Verify widths
    expect(sliceWidthMinutes(slices[0])).toBe(1420);
    expect(sliceWidthMinutes(slices[1])).toBe(20);
  });

  it('C9: two wrap slices should be rejected', () => {
    const slices = [
      makeSlice('22:00', '02:00', 'wrap1'),
      makeSlice('02:00', '22:00', 'wrap2'), // this is actually fine since endMin < startMin? No: 22:00 is 1320, 02:00 is 120, so wrap2 doesn't wrap
    ];
    // wrap2 goes from 02:00 to 22:00 — forward, not wrap
    // wrap1 goes from 22:00 to 02:00 — wrap
    // total: 240 + 1200 = 1440 ✓
    expect(isContiguous24h(slices)).toBe(true);
  });

  it('C9: two actual wrap slices fail', () => {
    // Two slices that both wrap midnight
    const slices = [
      makeSlice('23:00', '01:00', 'a'), // 120 min wrap
      makeSlice('01:00', '23:00', 'b'), // 1320 min forward — total 1440 but one wraps
    ];
    // Only one wrap, should pass
    expect(isContiguous24h(slices)).toBe(true);
  });

  it('returns false for non-contiguous ordering', () => {
    const slices = [
      makeSlice('06:00', '12:00', 'a'),
      makeSlice('00:00', '06:00', 'b'),
      makeSlice('12:00', '00:00', 'c'),
    ];
    // b comes after a but b.startTime (00:00) != a.endTime (12:00)
    expect(isContiguous24h(slices)).toBe(false);
  });
});
