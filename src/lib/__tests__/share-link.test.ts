import { describe, it, expect } from 'vitest';
import { encodeSchedule, decodeSchedule, buildShareUrl } from '../share-link';
import { isContiguous24h } from '../time-utils';
import type { Schedule } from '@/types/schedule';
import type { TimeSlice } from '@/types/time-slice';
import { v4 as uuid } from 'uuid';

function slice(startTime: string, endTime: string, o: Partial<TimeSlice> = {}): TimeSlice {
  return { id: uuid(), label: '', startTime, endTime, color: '#93c5fd', icon: '', textPosition: 'inside', ...o };
}
function sched(slices: TimeSlice[], name = '내 하루'): Schedule {
  return { id: uuid(), version: 1, name, presetSource: null, updatedAt: new Date().toISOString(), slices };
}

describe('share-link encode/decode', () => {
  it('round-trips a multi-slice schedule (times, labels, colors, icons, name)', () => {
    const s = sched([
      slice('00:00', '07:00', { label: '수면', color: '#c7d2fe', icon: '😴' }),
      slice('07:00', '12:00', { label: '오전 업무', color: '#bfdbfe', icon: '💻' }),
      slice('12:00', '13:00', { label: '점심', color: '#fde68a', icon: '🍚' }),
      slice('13:00', '24:00', { label: '오후', color: '#a7f3d0', icon: '📊' }),
    ], '직장인');
    const out = decodeSchedule(encodeSchedule(s))!;
    expect(out).not.toBeNull();
    expect(out.name).toBe('직장인');
    expect(isContiguous24h(out.slices)).toBe(true);
    expect(out.slices.map((x) => [x.startTime, x.endTime, x.label, x.color, x.icon])).toEqual([
      ['00:00', '07:00', '수면', '#c7d2fe', '😴'],
      ['07:00', '12:00', '오전 업무', '#bfdbfe', '💻'],
      ['12:00', '13:00', '점심', '#fde68a', '🍚'],
      ['13:00', '00:00', '오후', '#a7f3d0', '📊'],
    ]);
    // Fresh ids on import.
    expect(out.slices[0].id).not.toBe(s.slices[0].id);
  });

  it('preserves a cross-midnight (wrap) schedule', () => {
    const s = sched([
      slice('22:00', '02:00', { label: '야간' }),
      slice('02:00', '10:00', { label: '아침' }),
      slice('10:00', '22:00', { label: '낮' }),
    ]);
    const out = decodeSchedule(encodeSchedule(s))!;
    expect(isContiguous24h(out.slices)).toBe(true);
    expect(out.slices.some((x) => x.startTime === '22:00' && x.endTime === '02:00')).toBe(true);
  });

  it('round-trips a single full-day slice', () => {
    const out = decodeSchedule(encodeSchedule(sched([slice('00:00', '24:00', { label: '' })])))!;
    expect(isContiguous24h(out.slices)).toBe(true);
    expect(out.slices.length).toBe(1);
  });

  it('returns null for garbage input', () => {
    expect(decodeSchedule('not-valid-base64!!')).toBeNull();
    expect(decodeSchedule('')).toBeNull();
  });

  it('buildShareUrl points at the production origin', () => {
    expect(buildShareUrl(sched([slice('00:00', '24:00')]))).toMatch(/^https:\/\/24houring\.com\/#p=[A-Za-z0-9_-]+$/);
  });
});
