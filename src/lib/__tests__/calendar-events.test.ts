import { describe, expect, it } from 'vitest';
import { dayEvents, isTime, occursOn, sortDayEvents, type CalendarEvent } from '../calendar-events';

const ev = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({ id: 'e', text: 'plan', ...over });

describe('when a repeating plan falls', () => {
  it('a one-off shows only on its own day', () => {
    expect(occursOn('2026-09-16', ev(), '2026-09-16')).toBe(true);
    expect(occursOn('2026-09-16', ev(), '2026-09-17')).toBe(false);
  });

  it('never shows before the day it was filed on', () => {
    for (const repeat of ['daily', 'weekly', 'monthly', 'yearly'] as const) {
      expect(occursOn('2026-09-16', ev({ repeat }), '2026-09-15')).toBe(false);
    }
  });

  it('repeats daily, weekly, monthly and yearly', () => {
    expect(occursOn('2026-09-16', ev({ repeat: 'daily' }), '2026-12-25')).toBe(true);
    // 2026-09-16 is a Wednesday.
    expect(occursOn('2026-09-16', ev({ repeat: 'weekly' }), '2026-09-23')).toBe(true);
    expect(occursOn('2026-09-16', ev({ repeat: 'weekly' }), '2026-09-24')).toBe(false);
    expect(occursOn('2026-09-16', ev({ repeat: 'monthly' }), '2026-10-16')).toBe(true);
    expect(occursOn('2026-09-16', ev({ repeat: 'monthly' }), '2026-10-17')).toBe(false);
    expect(occursOn('2026-09-16', ev({ repeat: 'yearly' }), '2027-09-16')).toBe(true);
    expect(occursOn('2026-09-16', ev({ repeat: 'yearly' }), '2027-10-16')).toBe(false);
  });

  it('a monthly plan on the 31st skips the months without one', () => {
    const monthly = ev({ repeat: 'monthly' });
    expect(occursOn('2026-01-31', monthly, '2026-02-28')).toBe(false);
    expect(occursOn('2026-01-31', monthly, '2026-03-31')).toBe(true);
  });
});

describe('a day’s plans', () => {
  it('puts all-day entries first, then the timed ones in clock order', () => {
    const sorted = sortDayEvents([
      ev({ id: 'c', time: '14:00' }),
      ev({ id: 'a' }),
      ev({ id: 'b', time: '09:30' }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('gathers entries filed elsewhere that repeat onto the day, with their origin', () => {
    const events = {
      '2026-09-02': [ev({ id: 'weekly', text: '팀 회의', repeat: 'weekly', time: '10:00' })],
      '2026-09-16': [ev({ id: 'once', text: '치과' })],
      '2026-09-20': [ev({ id: 'later', text: '나중' })],
    };
    const day = dayEvents(events, '2026-09-16');
    expect(day.map((e) => e.id)).toEqual(['once', 'weekly']); // all-day first
    expect(day.find((e) => e.id === 'weekly')?.from).toBe('2026-09-02');
    expect(dayEvents(events, '2026-09-17')).toEqual([]);
  });
});

describe('time values', () => {
  it('accepts 24h HH:MM only', () => {
    expect(isTime('09:30')).toBe(true);
    expect(isTime('23:59')).toBe(true);
    expect(isTime('24:00')).toBe(false);
    expect(isTime('9:30')).toBe(false);
    expect(isTime(null)).toBe(false);
  });
});
