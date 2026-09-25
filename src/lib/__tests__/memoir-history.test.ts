import { describe, expect, it } from 'vitest';
import { MAX_MEMOIRS, addMemoir, decodeMemoirs, emptyMemoirs, memoirList } from '../memoir-history';

describe('every memoir, kept by date', () => {
  it('keeps what it understands, byte-stably, and drops the broken', () => {
    const d = decodeMemoirs({ version: 1, items: [{ text: ' 첫 번째 ', createdAt: '2026-09-01' }, { text: '', createdAt: 'x' }, { text: '둘', createdAt: '2026-09-01' }, 'junk'] });
    expect(d).toEqual({ version: 1, items: [{ text: '첫 번째', createdAt: '2026-09-01' }] });
    expect(JSON.stringify(decodeMemoirs(JSON.parse(JSON.stringify(d))))).toBe(JSON.stringify(d));
    expect(decodeMemoirs({ version: 2 })).toBeNull();
  });

  it('never loses a memoir written before the history existed', () => {
    const legacy = { text: '예전 자서전', createdAt: '2026-09-20T00:00:00Z' };
    // Shown even though the store is empty…
    expect(memoirList(emptyMemoirs(), legacy)).toEqual([legacy]);
    // …and kept when the next one is written.
    const next = addMemoir(emptyMemoirs(), { text: '새 자서전', createdAt: '2026-09-25T00:00:00Z' }, legacy);
    expect(next.items.map((m) => m.text)).toEqual(['예전 자서전', '새 자서전']);
    // Newest first, the legacy one not listed twice.
    expect(memoirList(next, { text: '새 자서전', createdAt: '2026-09-25T00:00:00Z' }).map((m) => m.text)).toEqual(['새 자서전', '예전 자서전']);
  });

  it('keeps the latest ones when there are too many', () => {
    let h = emptyMemoirs();
    for (let i = 0; i < MAX_MEMOIRS + 5; i++) h = addMemoir(h, { text: `m${i}`, createdAt: `2026-01-${String(i + 1).padStart(2, '0')}` }, null);
    expect(h.items).toHaveLength(MAX_MEMOIRS);
    expect(h.items.at(-1)?.text).toBe(`m${MAX_MEMOIRS + 4}`);
  });
});
