import { describe, expect, it } from 'vitest';
import { MAX_PER_ROW, cleanLifeDecor, decorPhotoIds, encodeLifeDecor, pruneLifeDecor, withRow } from '../life-decor';
import type { LayerItem } from '../decor-layer';

const item = (id: string, over: Partial<LayerItem> = {}): LayerItem =>
  ({ id, k: 'sticker', x: 0.5, y: 0.5, s: 1, r: 0, g: 'smile', ...over });

describe('decorations on the life line', () => {
  it('round-trips, keyed by the row they sit on', () => {
    const rows = { birth: [item('a')], m1: [item('b', { k: 'photo', ph: 'p1abc234' })] };
    const back = cleanLifeDecor(encodeLifeDecor(rows))!;
    expect(Object.keys(back)).toEqual(['birth', 'm1']);
    expect(back.birth[0].g).toBe('smile');
    expect(decorPhotoIds(back)).toEqual(['p1abc234']);
  });

  it('drops rubbish instead of failing, and caps one row', () => {
    expect(cleanLifeDecor(null)).toBeNull();
    expect(cleanLifeDecor({ version: 9, rows: {} })).toBeNull();
    const many = { 'bad row!': [item('x')], ok: Array.from({ length: MAX_PER_ROW + 4 }, (_, i) => item(`i${i}`)) };
    const back = cleanLifeDecor(encodeLifeDecor(many))!;
    expect(Object.keys(back)).toEqual(['ok']);
    expect(back.ok).toHaveLength(MAX_PER_ROW);
  });

  it('empties a row out of the record entirely', () => {
    const rows = withRow({ birth: [item('a')] }, 'birth', (items) => items.filter((i) => i.id !== 'a'));
    expect(rows).toEqual({});
  });

  it('forgets decorations whose row is gone', () => {
    expect(pruneLifeDecor({ birth: [item('a')], gone: [item('b')] }, new Set(['birth']))).toEqual({ birth: [item('a')] });
  });
});
