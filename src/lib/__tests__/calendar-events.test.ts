import { describe, expect, it } from 'vitest';
import {
  dayEvents, dragRange, laneRows, occursOn, sortDayEvents, spanIndexOn, startsOn,
  type CalendarEvent, type DayEvent,
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

describe('a week laid out in lanes', () => {
  const week = ['2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'];
  const bar = (id: string, start: string, length: number, index: number, over: Partial<DayEvent> = {}): DayEvent =>
    ({ id, text: id, from: start, start, index, length, ...over });
  /** A span, spread over the days it covers, the way dayEvents hands them out. */
  const spread = (id: string, startIndex: number, length: number, over: Partial<DayEvent> = {}) => {
    const out: Record<string, DayEvent[]> = {};
    for (let i = 0; i < length; i++) {
      const key = week[startIndex + i];
      if (key) (out[key] ??= []).push(bar(id, week[startIndex], length, i, over));
    }
    return out;
  };
  const merge = (...maps: Array<Record<string, DayEvent[]>>) => {
    const out: Record<string, DayEvent[]> = {};
    for (const m of maps) for (const [k, v] of Object.entries(m)) (out[k] ??= []).push(...v);
    return out;
  };

  it('keeps one bar in the same lane for every day it covers', () => {
    const lanes = laneRows(week, spread('trip', 1, 4));
    expect(lanes).toHaveLength(1);
    expect(lanes[0].map((e) => e?.id ?? null)).toEqual([null, 'trip', 'trip', 'trip', 'trip', null, null]);
  });

  it('gives an overlapping bar its own lane, and never bumps a running one down', () => {
    // 'a' runs Mon–Thu; 'b' starts Wed, so it must take the lane below…
    const lanes = laneRows(week, merge(spread('a', 1, 4), spread('b', 3, 3)));
    expect(lanes[0].map((e) => e?.id ?? null)).toEqual([null, 'a', 'a', 'a', 'a', null, null]);
    expect(lanes[1].map((e) => e?.id ?? null)).toEqual([null, null, null, 'b', 'b', 'b', null]);
  });

  it('lets a later day reuse a lane that has been freed', () => {
    const lanes = laneRows(week, merge(spread('early', 0, 2), spread('late', 4, 2)));
    expect(lanes).toHaveLength(1);
    expect(lanes[0].map((e) => e?.id ?? null)).toEqual(['early', 'early', null, null, 'late', 'late', null]);
  });

  it('puts all-day bars above timed entries', () => {
    const lanes = laneRows(week, merge(
      spread('meeting', 2, 1, { time: '09:00' }),
      spread('holiday', 0, 5),
    ));
    expect(lanes[0][2]?.id).toBe('holiday');
    expect(lanes[1][2]?.id).toBe('meeting');
  });
});
