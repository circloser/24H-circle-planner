import { describe, it, expect } from 'vitest';
import { timeGap } from '../time-gap';
import type { TimeSlice } from '@/types/time-slice';
import type { RecordItem } from '@/hooks/useRecords';

const P = (label: string, startTime: string, endTime: string): TimeSlice => ({
  id: label, label, startTime, endTime, color: '#abcdef', icon: '', textPosition: 'inside',
});
const R = (label: string, start: string, end: string): RecordItem => ({
  id: label + start, label, start, end, color: '#123456',
});

describe('timeGap', () => {
  it('joins plan and actual by label with diff and pct', () => {
    const plan = [P('연구', '20:00', '23:00'), P('수면', '23:00', '07:00')]; // 연구 180m
    const actual = [R('연구', '21:18', '23:00')]; // 102m
    const g = timeGap(plan, actual);
    const research = g.planned.find((r) => r.key === '연구')!;
    expect(research.planned).toBe(180);
    expect(research.actual).toBe(102);
    expect(research.diff).toBe(-78);
    expect(research.pct).toBe(57); // 102/180
    // 수면 planned but no actual → 0%
    const sleep = g.planned.find((r) => r.key === '수면')!;
    expect(sleep.pct).toBe(0);
  });

  it('is label-insensitive (trim + case) when joining', () => {
    const g = timeGap([P('Work', '09:00', '12:00')], [R(' work ', '09:00', '10:30')]);
    expect(g.planned).toHaveLength(1);
    expect(g.planned[0].actual).toBe(90);
  });

  it('lists logged-but-unplanned activities separately', () => {
    const g = timeGap([P('work', '09:00', '10:00')], [R('유튜브', '13:00', '13:40')]);
    expect(g.planned.find((r) => r.key === 'work')!.actual).toBe(0);
    expect(g.unplanned.map((r) => r.key)).toEqual(['유튜브']);
    expect(g.unplanned[0].actual).toBe(40);
    expect(g.unplanned[0].pct).toBeNull();
  });

  it('handles a midnight-wrapping record', () => {
    const g = timeGap([P('sleep', '23:00', '07:00')], [R('sleep', '23:00', '00:30')]);
    expect(g.planned[0].actual).toBe(90);
  });

  it('ignores unlabeled slices', () => {
    const g = timeGap([P('', '00:00', '08:00'), P('a', '08:00', '09:00')], []);
    expect(g.planned.map((r) => r.key)).toEqual(['a']);
  });
});
