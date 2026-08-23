import { describe, it, expect } from 'vitest';
import { dayCompletion } from '../completion';
import type { TimeSlice } from '@/types/time-slice';

const S = (label: string, done?: boolean): TimeSlice => ({
  id: label || 'x' + Math.random(), label, startTime: '00:00', endTime: '01:00',
  color: '#abcdef', icon: '', textPosition: 'inside', ...(done ? { done } : {}),
});

describe('dayCompletion', () => {
  it('counts only labeled blocks as tasks', () => {
    const r = dayCompletion([S('work', true), S(''), S('study'), S('  ')]);
    expect(r).toEqual({ done: 1, total: 2, pct: 50 }); // empty/whitespace excluded
  });

  it('is 0% with no labeled tasks', () => {
    expect(dayCompletion([S(''), S('   ')])).toEqual({ done: 0, total: 0, pct: 0 });
  });

  it('rounds the percentage', () => {
    expect(dayCompletion([S('a', true), S('b'), S('c')]).pct).toBe(33);
  });

  it('100% when every task is done', () => {
    expect(dayCompletion([S('a', true), S('b', true)])).toEqual({ done: 2, total: 2, pct: 100 });
  });
});
