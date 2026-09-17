import { describe, expect, it } from 'vitest';
import { MAX_STICKERS, STICKER_GROUPS, TINTS, cleanDecor, stickerGlyph, withDay } from '../decor';
import { SYNC_KEYS } from '../sync/syncData';

describe('diary decorating data', () => {
  it('has a unique, resolvable id for every sticker', () => {
    const ids = STICKER_GROUPS.flatMap((g) => g.items.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(stickerGlyph(id)).toBeTruthy();
    expect(stickerGlyph('nope')).toBeNull();
  });

  it('reads a stored day and drops anything it does not know', () => {
    expect(cleanDecor({
      version: 1,
      days: {
        '2026-09-17': { s: ['sun', 'nope', 'heart'], t: TINTS[0] },
        '2026-09-18': { s: [], t: '#000000' }, // nothing valid left → the day goes
        'not-a-day': { s: ['sun'] },
      },
    })).toEqual({ '2026-09-17': { s: ['sun', 'heart'], t: TINTS[0] } });
    expect(cleanDecor({ version: 2, days: {} })).toBeNull();
  });

  it('caps the stickers on one day', () => {
    const many = Array.from({ length: MAX_STICKERS + 3 }, () => 'star');
    expect(cleanDecor({ version: 1, days: { '2026-09-17': { s: many } } })?.['2026-09-17'].s).toHaveLength(MAX_STICKERS);
  });

  it('drops a day once nothing is left on it', () => {
    const one = withDay({}, '2026-09-17', () => ({ s: ['sun'] }));
    expect(one).toEqual({ '2026-09-17': { s: ['sun'] } });
    expect(withDay(one, '2026-09-17', () => ({ s: [] }))).toEqual({});
  });

  it('travels with the account', () => {
    expect(SYNC_KEYS).toContain('24h-circle-planner.decor');
  });
});
