import { describe, expect, it } from 'vitest';
import {
  MAX_ITEMS, SCALE_MAX, TAPE_DEFAULT, cleanItem, cleanLayer, dayCorner, migrateDayStickers, monthKey, paperOf, withMonth,
} from '../decor-layer';
import { monthCells } from '../calendar-grid';
import { SYNC_KEYS } from '../sync/syncData';

describe('the free decoration layer', () => {
  it('reads stored items and drops or clamps anything untrusted', () => {
    expect(cleanLayer({
      version: 1,
      months: {
        '2026-09': [
          { id: 'a', k: 'sticker', g: 'sun', x: 1.4, y: -1, s: 99, r: -30 },
          { id: 'b', k: 'sticker', g: 'nope', x: 0.5, y: 0.5 },
          { id: 'c', k: 'tape', p: 'weird', c: '#123456', x: 0.2, y: 0.3 },
          { id: 'd', k: 'photo', ph: '<script>', x: 0.2, y: 0.3 },
          { id: 'a', k: 'sticker', g: 'star', x: 0.1, y: 0.1 }, // duplicate id
          { k: 'sticker', g: 'sun' }, // no id
        ],
        'bad-key': [{ id: 'z', k: 'sticker', g: 'sun' }],
        '2026-10': [],
      },
    })).toEqual({
      '2026-09': [
        { id: 'a', k: 'sticker', g: 'sun', x: 1, y: 0, s: SCALE_MAX, r: 330 },
        { id: 'c', k: 'tape', p: 'solid', c: '#fef08a', w: TAPE_DEFAULT, x: 0.2, y: 0.3, s: 1, r: 0 },
      ],
    });
    expect(cleanLayer({ version: 2, months: {} })).toBeNull();
  });

  it('keeps a photo sticker by the id of its picture', () => {
    expect(cleanItem({ id: 'p', k: 'photo', ph: 'pabc123', x: 0.5, y: 0.5 }))
      .toEqual({ id: 'p', k: 'photo', ph: 'pabc123', x: 0.5, y: 0.5, s: 1, r: 0 });
  });

  it('caps a month and drops a month once it is empty', () => {
    const many = Array.from({ length: MAX_ITEMS + 5 }, (_, i) => ({ id: `i${i}`, k: 'sticker' as const, g: 'sun', x: 0, y: 0, s: 1, r: 0 }));
    const full = withMonth({}, '2026-09', () => many);
    expect(full['2026-09']).toHaveLength(MAX_ITEMS);
    expect(withMonth(full, '2026-09', () => [])).toEqual({});
  });

  it('puts a day\'s old stickers over the top-right of that day', () => {
    // 2026-09-17 is a Thursday; the six-week grid starts on Sunday 2026-08-30.
    const at = monthCells(2026, 8).findIndex((c) => c.key === '2026-09-17');
    const corner = dayCorner('2026-09-17');
    expect(corner.month).toBe('2026-09');
    expect(Math.floor(corner.x * 7)).toBe(at % 7);
    expect(Math.floor(corner.y * 6)).toBe(Math.floor(at / 7));

    const moved = migrateDayStickers({ '2026-09-17': { s: ['sun', 'heart', 'nope'] }, '2026-10-01': { s: [] } });
    expect(Object.keys(moved)).toEqual(['2026-09']);
    expect(moved['2026-09'].map((i) => [i.id, i.g])).toEqual([['m-2026-09-17-0', 'sun'], ['m-2026-09-17-1', 'heart']]);
    // Every moved sticker still sits inside the same day's cell.
    for (const i of moved['2026-09']) {
      expect(Math.floor(i.x * 7)).toBe(at % 7);
      expect(Math.floor(i.y * 6)).toBe(Math.floor(at / 7));
    }
  });

  it('names months and papers safely', () => {
    expect(monthKey(2026, 0)).toBe('2026-01');
    expect(paperOf('kraft')).toBe('kraft');
    expect(paperOf('bogus')).toBe('none');
  });

  it('travels with the account', () => {
    expect(SYNC_KEYS).toContain('24h-circle-planner.decor-layer');
  });
});
