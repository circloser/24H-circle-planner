import { describe, it, expect } from 'vitest';
import { computeNowNext } from '../now-next';
import type { TimeSlice } from '@/types/time-slice';

const S = (id: string, startTime: string, endTime: string): TimeSlice => ({
  id, label: id, icon: '', color: '#abcdef', textPosition: 'inside', startTime, endTime,
});

describe('computeNowNext', () => {
  const day = [S('sleep', '00:00', '08:00'), S('work', '08:00', '12:00'), S('rest', '12:00', '24:00')];

  it('returns nulls for an empty schedule', () => {
    expect(computeNowNext([], 600)).toEqual({ current: null, next: null, elapsedMin: 0, remainingMin: 0, progress: 0 });
  });

  it('finds the current slice, its remaining time and the next slice', () => {
    const r = computeNowNext(day, 60); // 01:00, inside sleep (480 min wide)
    expect(r.current?.id).toBe('sleep');
    expect(r.next?.id).toBe('work');
    expect(r.elapsedMin).toBe(60);
    expect(r.remainingMin).toBe(420);
    expect(r.progress).toBeCloseTo(60 / 480, 5);
  });

  it('wraps: the last slice is followed by the first', () => {
    const r = computeNowNext(day, 13 * 60); // 13:00, inside rest (last)
    expect(r.current?.id).toBe('rest');
    expect(r.next?.id).toBe('sleep');
  });

  it('handles a midnight-wrapping current slice', () => {
    const wrap = [S('night', '22:00', '06:00'), S('day', '06:00', '22:00')];
    const r = computeNowNext(wrap, 23 * 60); // 23:00, inside night (480 wide, started 22:00)
    expect(r.current?.id).toBe('night');
    expect(r.elapsedMin).toBe(60);
    expect(r.remainingMin).toBe(420);
    expect(r.next?.id).toBe('day');
  });

  it('single full-day slice has no next', () => {
    const r = computeNowNext([S('all', '00:00', '24:00')], 600);
    expect(r.current?.id).toBe('all');
    expect(r.next).toBeNull();
  });
});
