import { describe, it, expect } from 'vitest';
import { currentSliceAt } from '../sliceAlarm';
import type { TimeSlice } from '@/types/time-slice';

const s = (id: string, startTime: string, endTime: string): TimeSlice =>
  ({ id, label: id, startTime, endTime, color: '#ccc', icon: '', textPosition: 'inside' }) as TimeSlice;

const RING = [s('sleep', '23:00', '07:00'), s('work', '07:00', '18:00'), s('rest', '18:00', '23:00')];

describe('currentSliceAt', () => {
  it('finds the slice containing a normal daytime moment', () => {
    expect(currentSliceAt(RING, 9 * 60)?.id).toBe('work');
    expect(currentSliceAt(RING, 20 * 60)?.id).toBe('rest');
  });

  it('handles the midnight-wrapping slice on both sides of 00:00', () => {
    expect(currentSliceAt(RING, 23 * 60 + 30)?.id).toBe('sleep'); // 23:30
    expect(currentSliceAt(RING, 3 * 60)?.id).toBe('sleep'); // 03:00
    expect(currentSliceAt(RING, 6 * 60 + 59)?.id).toBe('sleep'); // 06:59
  });

  it('boundaries belong to the STARTING slice (start inclusive, end exclusive)', () => {
    expect(currentSliceAt(RING, 7 * 60)?.id).toBe('work'); // 07:00 → work begins
    expect(currentSliceAt(RING, 18 * 60)?.id).toBe('rest');
    expect(currentSliceAt(RING, 23 * 60)?.id).toBe('sleep');
  });

  it('returns null for an empty ring', () => {
    expect(currentSliceAt([], 600)).toBeNull();
  });
});
