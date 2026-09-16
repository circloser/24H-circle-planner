import { describe, expect, it } from 'vitest';
import {
  dayEvents, dragRange, occursOn, sortDayEvents, spanIndexOn, startsOn, type CalendarEvent,
} from '../calendar-events';

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
    expect(occursOn('2026-09-16', ev({ repeat: 'yearly' }), '2027-09-16')).toBe(true);
  });

  it('a monthly plan on the 31st skips the months without one', () => {
    const monthly = ev({ repeat: 'monthly' });
    expect(occursOn('2026-01-31', monthly, '2026-02-28')).toBe(false);
    expect(occursOn('2026-01-31', monthly, '2026-03-31')).toBe(true);
  });

  it('drops the one occurrence the user deleted, keeping the rest', () => {
    const weekly = ev({ repeat: 'weekly', skip: ['2026-09-23'] });
    expect(occursOn('2026-09-16', weekly, '2026-09-23')).toBe(false);
    expect(occursOn('2026-09-16', weekly, '2026-09-30')).toBe(true);
  });

  it('stops at the end date set by "delete this and later"', () => {
    const weekly = ev({ repeat: 'weekly', until: '2026-09-29' });
    expect(startsOn('2026-09-16', weekly, '2026-09-23')).toBe(true);
    expect(startsOn('2026-09-16', weekly, '2026-09-30')).toBe(false);
  });
});

describe('plans that cover several days', () => {
  it('reports where a day sits inside the span', () => {
    const trip = ev({ days: 3 });
    expect(spanIndexOn('2026-09-16', trip, '2026-09-16')).toEqual({ index: 0, start: '2026-09-16', length: 3 });
    expect(spanIndexOn('2026-09-16', trip, '2026-09-18')).toEqual({ index: 2, start: '2026-09-16', length: 3 });
    expect(spanIndexOn('2026-09-16', trip, '2026-09-19')).toBeNull();
  });

  it('carries the span through every repeat', () => {
    const shift = ev({ days: 2, repeat: 'weekly' });
    expect(spanIndexOn('2026-09-16', shift, '2026-09-24')).toEqual({ index: 1, start: '2026-09-23', length: 2 });
  });

  it('reads a drag in either direction as the same span', () => {
    expect(dragRange('2026-09-16', '2026-09-18')).toEqual({ start: '2026-09-16', days: 3 });
    expect(dragRange('2026-09-18', '2026-09-16')).toEqual({ start: '2026-09-16', days: 3 });
    expect(dragRange('2026-09-16', '2026-09-16')).toEqual({ start: '2026-09-16', days: 1 });
  });
});

describe('a day’s plans', () => {
  it('puts all-day entries first (longest first), then the timed ones in clock order', () => {
    const sorted = sortDayEvents([
      ev({ id: 'c', time: '14:00' }),
      ev({ id: 'a' }),
      ev({ id: 'trip', days: 3 }),
      ev({ id: 'b', time: '09:30' }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['trip', 'a', 'b', 'c']);
  });

  it('gathers entries filed elsewhere that reach the day, with their origin and start', () => {
    const events = {
      '2026-09-02': [ev({ id: 'weekly', text: '팀 회의', repeat: 'weekly', time: '10:00' })],
      '2026-09-15': [ev({ id: 'trip', text: '출장', days: 3 })],
      '2026-09-16': [ev({ id: 'once', text: '치과' })],
    };
    const day = dayEvents(events, '2026-09-16');
    expect(day.map((e) => e.id)).toEqual(['trip', 'once', 'weekly']);
    expect(day.find((e) => e.id === 'trip')).toMatchObject({ from: '2026-09-15', start: '2026-09-15', index: 1, length: 3 });
    expect(day.find((e) => e.id === 'weekly')).toMatchObject({ from: '2026-09-02', start: '2026-09-16', index: 0 });
    expect(dayEvents(events, '2026-09-19')).toEqual([]);
  });
});
