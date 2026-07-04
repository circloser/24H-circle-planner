import { describe, it, expect, beforeEach } from 'vitest';
import { loadWeekdayMap, saveWeekdayMap, weekdayName, STORAGE_KEY_WEEKDAY } from '../weekday-schedules';

beforeEach(() => localStorage.clear());

describe('weekday-schedules storage', () => {
  it('returns {} when nothing is saved', () => {
    expect(loadWeekdayMap()).toEqual({});
  });

  it('round-trips a weekday→slotId map as a versioned envelope', () => {
    saveWeekdayMap({ 0: 'slotA', 3: 'slotB' });
    expect(localStorage.getItem(STORAGE_KEY_WEEKDAY)).toBe('{"version":1,"byWeekday":{"0":"slotA","3":"slotB"}}');
    expect(loadWeekdayMap()).toEqual({ 0: 'slotA', 3: 'slotB' });
  });

  it('drops out-of-range weekdays and non-string / empty slot ids on load', () => {
    localStorage.setItem(STORAGE_KEY_WEEKDAY, JSON.stringify({
      version: 1,
      byWeekday: { 1: 'ok', 7: 'bad-index', '-1': 'bad', 2: '', 4: 42 },
    }));
    expect(loadWeekdayMap()).toEqual({ 1: 'ok' });
  });

  it('ignores an unknown version / corrupt json', () => {
    localStorage.setItem(STORAGE_KEY_WEEKDAY, JSON.stringify({ version: 2, byWeekday: { 0: 'x' } }));
    expect(loadWeekdayMap()).toEqual({});
    localStorage.setItem(STORAGE_KEY_WEEKDAY, '{not json');
    expect(loadWeekdayMap()).toEqual({});
  });

  it('weekdayName maps 0..6 to Sunday..Saturday', () => {
    expect(weekdayName(0, 'en')).toBe('Sunday');
    expect(weekdayName(1, 'en')).toBe('Monday');
    expect(weekdayName(6, 'en')).toBe('Saturday');
    expect(weekdayName(0, 'ko')).toBe('일요일');
  });
});
