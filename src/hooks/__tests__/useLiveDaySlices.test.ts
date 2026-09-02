import { describe, it, expect } from 'vitest';
import { liveDaySlices } from '@/hooks/useLiveDaySlices';
import type { TimeSlice } from '@/types/time-slice';

const slice = (label: string): TimeSlice => ({
  id: label,
  label,
  color: '#93c5fd',
  icon: '',
  textPosition: 'inside',
  startTime: '09:00',
  endTime: '10:00',
});

const TODAY = '2026-09-02';
const today = [slice('오늘 일정')];

describe('liveDaySlices — which timetable may ring', () => {
  it('the live schedule rings (no diary day loaded)', () => {
    expect(liveDaySlices(today, null, TODAY)).toBe(today);
  });

  it("today's own saved day still counts as live", () => {
    expect(liveDaySlices(today, TODAY, TODAY)).toBe(today);
  });

  it('a PAST day being browsed rings nothing', () => {
    // The regression: `present` holds that day's timetable, so alarms — and the
    // server-side push plan every device follows — announced the old blocks.
    expect(liveDaySlices([slice('어제 일정')], '2026-09-01', TODAY)).toBeNull();
  });

  it('a FUTURE day being previewed rings nothing either', () => {
    expect(liveDaySlices([slice('내일 일정')], '2026-09-03', TODAY)).toBeNull();
  });

  it('goes live again the moment the diary view is left', () => {
    expect(liveDaySlices(today, '2026-09-01', TODAY)).toBeNull();
    expect(liveDaySlices(today, null, TODAY)).toBe(today); // → re-uploads the plan
  });
});
