import { describe, it, expect } from 'vitest';
import { clearDone } from '../schedule';
import type { Schedule } from '@/types/schedule';
import type { TimeSlice } from '@/types/time-slice';

const S = (id: string, done?: boolean): TimeSlice => ({
  id, label: id, startTime: '00:00', endTime: '12:00', color: '#abcdef', icon: '',
  textPosition: 'inside', ...(done ? { done } : {}),
});
const sched = (slices: TimeSlice[]): Schedule =>
  ({ id: 'x', version: 1, name: 't', slices, updatedAt: '', presetSource: null } as Schedule);

describe('clearDone', () => {
  it('clears every done flag', () => {
    const out = clearDone(sched([S('a', true), S('b'), S('c', true)]));
    expect(out.slices.every((s) => !s.done)).toBe(true);
  });

  it('returns the SAME object when nothing was done (no needless mutation)', () => {
    const s = sched([S('a'), S('b')]);
    expect(clearDone(s)).toBe(s);
  });

  it('leaves times/labels intact', () => {
    const out = clearDone(sched([S('a', true)]));
    expect(out.slices[0]).toMatchObject({ id: 'a', label: 'a', startTime: '00:00', endTime: '12:00' });
  });
});
