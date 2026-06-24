import { describe, it, expect } from 'vitest';
import { analyzeDays } from '../analytics';
import type { TimeSlice } from '@/types/time-slice';
import { v4 as uuid } from 'uuid';

const sl = (startTime: string, endTime: string, label: string, color = '#ccc', icon = ''): TimeSlice => ({
  id: uuid(), label, startTime, endTime, color, icon, textPosition: 'inside',
});

describe('analyzeDays (raw labels)', () => {
  it('aggregates minutes by exact label across days, sorted desc', () => {
    const day = {
      schedule: {
        slices: [
          sl('00:00', '07:00', '수면', '#a1'), // 420 sleep
          sl('07:00', '08:00', '아침', '#b2'), // 60
          sl('08:00', '12:00', '업무', '#c3', '💼'), // 240 work
          sl('12:00', '13:00', '점심', '#d4'), // 60
          sl('13:00', '18:00', '업무', '#c3'), // 300 — same label merges
          sl('18:00', '24:00', '수면', '#a1'), // 360 — same label merges
        ],
      },
    };
    const a = analyzeDays([day, day]); // two identical days
    expect(a.dayCount).toBe(2);

    const byLabel = Object.fromEntries(a.byLabel.map((x) => [x.label, x.minutes]));
    expect(byLabel['수면']).toBe((420 + 360) * 2); // 1560
    expect(byLabel['업무']).toBe((240 + 300) * 2); // 1080
    expect(byLabel['점심']).toBe(60 * 2);
    expect(byLabel['아침']).toBe(60 * 2);

    // Sorted by minutes desc; representative colour/icon come from the slice.
    expect(a.byLabel[0].label).toBe('수면');
    const work = a.byLabel.find((x) => x.label === '업무')!;
    expect(work.color).toBe('#c3');
    expect(work.icon).toBe('💼');

    // Per-day segments preserve order and each day sums to 1440.
    expect(a.perDay).toHaveLength(2);
    expect(a.perDay[0].segments[0].label).toBe('수면');
    for (const d of a.perDay) {
      expect(d.segments.reduce((s, x) => s + x.minutes, 0)).toBe(1440);
    }
  });

  it('keeps a blank label as its own empty-key entry', () => {
    const day = { schedule: { slices: [sl('00:00', '12:00', '', '#x'), sl('12:00', '24:00', '일', '#y')] } };
    const a = analyzeDays([day]);
    expect(a.byLabel.find((x) => x.label === '')?.minutes).toBe(720);
    expect(a.byLabel.find((x) => x.label === '일')?.minutes).toBe(720);
  });

  it('handles an empty source set', () => {
    const a = analyzeDays([]);
    expect(a.dayCount).toBe(0);
    expect(a.byLabel).toHaveLength(0);
    expect(a.perDay).toHaveLength(0);
  });
});
