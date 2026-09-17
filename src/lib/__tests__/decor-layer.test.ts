import { describe, expect, it } from 'vitest';
import {
  LAYER_VERSION, MAX_ITEMS, SCALE_MAX, TAPE_DEFAULT, cleanItem, cleanLayer, dayCorner, migrateDayStickers, monthKey, paperOf, withMonth,
} from '../decor-layer';
import { MONTH_ROWS, homeOf, monthCells } from '../calendar-grid';
import { SYNC_KEYS } from '../sync/syncData';

describe('the free decoration layer', () => {
  it('reads stored items and drops or clamps anything untrusted', () => {
    expect(cleanLayer({
      version: LAYER_VERSION,
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
    expect(cleanLayer({ version: 3, months: {} })).toBeNull();
  });

  it('moves items measured on the six-week grid onto the five-week one', () => {
    const at = (y: number) => ({ id: `i${y}`, k: 'sticker', g: 'sun', x: 0.4, y, s: 1, r: 0 });
    const moved = cleanLayer({
      version: 1,
      months: {
        // Week 2 of six, a quarter down → week 2 of five, a quarter down.
        '2026-09': [at(1.25 / 6), at(5.5 / 6)],
        // August 2026 needs six weeks; its sixth (Aug 30 – Sep 5) is the first
        // row of September's grid now.
        '2026-08': [at(5.5 / 6)],
      },
    });
    expect(moved?.['2026-09']?.map((i) => [i.id, +i.y.toFixed(4)])).toEqual([[`i${1.25 / 6}`, +(1.25 / 5).toFixed(4)], [`i${5.5 / 6}`, 0.1]]);
    // September's sixth week (Oct 4 – 10) is the second row of October's grid.
    expect(moved?.['2026-10']?.map((i) => +i.y.toFixed(4))).toEqual([0.3]);
    expect(moved?.['2026-08']).toBeUndefined();
    expect(moved?.['2026-09']?.[0].x).toBe(0.4);
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
    // 2026-09-17 is a Thursday; the grid starts on Sunday 2026-08-30.
    const at = monthCells(2026, 8).findIndex((c) => c.key === '2026-09-17');
    const corner = dayCorner('2026-09-17');
    expect(corner.month).toBe('2026-09');
    expect(Math.floor(corner.x * 7)).toBe(at % 7);
    expect(Math.floor(corner.y * MONTH_ROWS)).toBe(Math.floor(at / 7));

    const moved = migrateDayStickers({ '2026-09-17': { s: ['sun', 'heart', 'nope'] }, '2026-10-01': { s: [] } });
    expect(Object.keys(moved)).toEqual(['2026-09']);
    expect(moved['2026-09'].map((i) => [i.id, i.g])).toEqual([['m-2026-09-17-0', 'sun'], ['m-2026-09-17-1', 'heart']]);
    // Every moved sticker still sits inside the same day's cell.
    for (const i of moved['2026-09']) {
      expect(Math.floor(i.x * 7)).toBe(at % 7);
      expect(Math.floor(i.y * MONTH_ROWS)).toBe(Math.floor(at / 7));
    }
  });

  it("puts a carried-over day's stickers in the next month, over that day", () => {
    // 2026-08-31 does not fit in August's five weeks: September's grid shows it.
    const corner = dayCorner('2026-08-31');
    expect(corner.month).toBe('2026-09');
    const home = homeOf('2026-08-31');
    expect(Math.floor(corner.x * 7)).toBe(home.index % 7);
    expect(Math.floor(corner.y * MONTH_ROWS)).toBe(Math.floor(home.index / 7));
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
