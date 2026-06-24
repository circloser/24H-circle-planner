import { describe, it, expect } from 'vitest';
import { categorize, analyzeDays } from '../analytics';
import type { TimeSlice } from '@/types/time-slice';
import { v4 as uuid } from 'uuid';

const sl = (startTime: string, endTime: string, label: string): TimeSlice => ({
  id: uuid(), label, startTime, endTime, color: '#ccc', icon: '', textPosition: 'inside',
});

describe('categorize', () => {
  it('maps common labels to buckets (order-sensitive)', () => {
    expect(categorize('수면')).toBe('sleep');
    expect(categorize('수면준비')).toBe('sleep');
    expect(categorize('오전 업무')).toBe('work');
    expect(categorize('점심')).toBe('meal');
    expect(categorize('저녁·여가')).toBe('leisure'); // leisure beats meal
    expect(categorize('출근')).toBe('commute');
    expect(categorize('운동')).toBe('leisure');
    expect(categorize('Study session')).toBe('work');
    expect(categorize('')).toBe('other');
    expect(categorize('영화 감상')).toBe('other'); // not in any list
  });
});

describe('analyzeDays', () => {
  it('aggregates categorised minutes across days', () => {
    const day = {
      schedule: {
        slices: [
          sl('00:00', '07:00', '수면'), // 420 sleep
          sl('07:00', '08:00', '출근'), // 60 commute
          sl('08:00', '12:00', '오전 업무'), // 240 work
          sl('12:00', '13:00', '점심'), // 60 meal
          sl('13:00', '18:00', '오후 업무'), // 300 work
          sl('18:00', '22:00', '저녁·여가'), // 240 leisure
          sl('22:00', '24:00', '수면준비'), // 120 sleep
        ],
      },
    };
    const a = analyzeDays([day, day]); // two identical days
    expect(a.dayCount).toBe(2);
    expect(a.totalByCat.sleep).toBe((420 + 120) * 2);
    expect(a.totalByCat.work).toBe((240 + 300) * 2);
    expect(a.totalByCat.meal).toBe(60 * 2);
    expect(a.totalByCat.leisure).toBe(240 * 2);
    expect(a.totalByCat.commute).toBe(60 * 2);
    // Every day sums to 1440.
    for (const d of a.perDay) {
      const sum = Object.values(d.minutes).reduce((x, y) => x + y, 0);
      expect(sum).toBe(1440);
    }
  });
});
