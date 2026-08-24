import { describe, it, expect } from 'vitest';
import { chimeBoundaries } from '@/lib/push';
import type { TimeSlice } from '@/types/time-slice';

const slice = (startTime: string, endTime: string, label = ''): TimeSlice => ({
  id: `${startTime}-${endTime}`,
  label,
  startTime,
  endTime,
  color: '#000',
  icon: '',
  textPosition: 'inside',
});

describe('chimeBoundaries', () => {
  it('off (every=0) produces nothing', () => {
    expect(chimeBoundaries([slice('00:00', '24:00', 'x')], 0, 'untitled')).toEqual([]);
  });

  it('hourly (60) yields 24 aligned times with the covering block as body', () => {
    const slices = [slice('00:00', '09:00', '수면'), slice('09:00', '18:00', '업무'), slice('18:00', '24:00', '여가')];
    const b = chimeBoundaries(slices, 60, 'untitled');
    // 24 hours minus the 3 that coincide with slice starts (00:00, 09:00, 18:00) = 21
    expect(b).toHaveLength(21);
    expect(b.every((x) => x.t.endsWith(':00'))).toBe(true);
    expect(b.find((x) => x.t === '10:00')).toMatchObject({ title: '🔔 10:00', body: '업무' });
    expect(b.find((x) => x.t === '02:00')?.body).toBe('수면');
    // slice-start minutes are skipped (already notified)
    expect(b.find((x) => x.t === '09:00')).toBeUndefined();
  });

  it('every 30 min yields :00 and :30 slots', () => {
    const b = chimeBoundaries([slice('00:00', '24:00', 'all')], 30, 'untitled');
    // 48 half-hours minus the 00:00 slice start = 47
    expect(b).toHaveLength(47);
    expect(b.some((x) => x.t === '13:30')).toBe(true);
  });

  it('uses untitled when the covering block has no label', () => {
    const b = chimeBoundaries([slice('00:00', '24:00', '')], 60, 'untitled');
    expect(b[0].body).toBe('untitled');
  });

  it('resolves the covering block across a midnight-wrapping slice', () => {
    const slices = [slice('22:00', '06:00', '야간'), slice('06:00', '22:00', '주간')];
    const b = chimeBoundaries(slices, 60, 'untitled');
    expect(b.find((x) => x.t === '23:00')?.body).toBe('야간');
    expect(b.find((x) => x.t === '03:00')?.body).toBe('야간');
    expect(b.find((x) => x.t === '12:00')?.body).toBe('주간');
  });
});
