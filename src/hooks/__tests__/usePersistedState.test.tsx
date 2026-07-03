import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { loadPersisted, usePersistedState, type PersistedCodec } from '../usePersistedState';
import { diaryCodec } from '../useDiary';
import { goalsCodec } from '../useGoals';
import { memosCodec } from '../useMemos';
import { recordsCodec } from '../useRecords';

const KEY = 'test.persisted';

const numCodec: PersistedCodec<number> = {
  decode: (p) => {
    const o = p as { version?: number; n?: unknown } | null;
    return o && o.version === 1 && typeof o.n === 'number' ? o.n : null;
  },
  encode: (n) => ({ version: 1, n }),
  fallback: () => 0,
};

beforeEach(() => localStorage.clear());

describe('loadPersisted', () => {
  it('returns the fallback when storage is empty', () => {
    expect(loadPersisted(KEY, numCodec)).toBe(0);
  });
  it('returns the fallback on corrupt JSON', () => {
    localStorage.setItem(KEY, '{not json');
    expect(loadPersisted(KEY, numCodec)).toBe(0);
  });
  it('returns the fallback when decode rejects (wrong version/shape)', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 2, n: 5 }));
    expect(loadPersisted(KEY, numCodec)).toBe(0);
  });
  it('returns the decoded value for a valid envelope', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, n: 42 }));
    expect(loadPersisted(KEY, numCodec)).toBe(42);
  });
});

describe('usePersistedState', () => {
  it('initialises from storage and persists updates as the encoded envelope', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, n: 7 }));
    const { result } = renderHook(() => usePersistedState(KEY, numCodec));
    expect(result.current[0]).toBe(7);

    act(() => result.current[1](8));
    expect(result.current[0]).toBe(8);
    expect(localStorage.getItem(KEY)).toBe('{"version":1,"n":8}');
  });
  it('writes the initial envelope on mount (fresh storage)', () => {
    renderHook(() => usePersistedState(KEY, numCodec));
    expect(localStorage.getItem(KEY)).toBe('{"version":1,"n":0}');
  });
});

// ── Envelope byte-compatibility ──────────────────────────────────────────────
// These strings are the EXACT formats the hooks have always written. Cross-device
// sync ships them verbatim (SYNC_KEYS in lib/sync/syncData.ts), so changing any
// of them would desync older clients. Do not "fix" these expectations.

describe('storage envelope byte-compatibility', () => {
  it('diary: {"version":1,"entries":{…}}', () => {
    expect(JSON.stringify(diaryCodec.encode({}))).toBe('{"version":1,"entries":{}}');
    const entry = { date: '2026-07-03', name: '내 하루', slices: [], savedAt: 1 };
    const s = JSON.stringify(diaryCodec.encode({ '2026-07-03': entry }));
    expect(s).toBe('{"version":1,"entries":{"2026-07-03":{"date":"2026-07-03","name":"내 하루","slices":[],"savedAt":1}}}');
    expect(diaryCodec.decode(JSON.parse(s))).toEqual({ '2026-07-03': entry });
  });

  it('goals: {"version":1,"goals":[…]} (+ item validation on decode)', () => {
    expect(JSON.stringify(goalsCodec.encode([]))).toBe('{"version":1,"goals":[]}');
    const goal = { id: 'g1', label: '운동', targetMinutes: 60, period: 'day' as const };
    const s = JSON.stringify(goalsCodec.encode([goal]));
    expect(s).toBe('{"version":1,"goals":[{"id":"g1","label":"운동","targetMinutes":60,"period":"day"}]}');
    expect(goalsCodec.decode(JSON.parse(s))).toEqual([goal]);
    // Invalid items are filtered, not fatal.
    expect(goalsCodec.decode({ version: 1, goals: [goal, { bogus: true }] })).toEqual([goal]);
  });

  it('memos: {"version":1,"memos":[…],"visible":…} (+ legacy migration on decode)', () => {
    expect(JSON.stringify(memosCodec.encode({ memos: [], visible: true }))).toBe('{"version":1,"memos":[],"visible":true}');
    // A legacy memo lacking createdAt/onScreen/align migrates with defaults.
    const legacy = { version: 1, memos: [{ id: 'm1', text: 'hi', x: 1, y: 2, color: '#fef08a', fontFamily: 'Pretendard' }] };
    const decoded = memosCodec.decode(legacy)!;
    expect(decoded.memos[0]).toMatchObject({ id: 'm1', align: 'center', createdAt: 0, onScreen: true });
    expect(decoded.visible).toBe(true);
  });

  it('records: the state is the envelope {"version":1,"byDate":…,"active":…}', () => {
    const empty = recordsCodec.fallback();
    expect(JSON.stringify(recordsCodec.encode(empty))).toBe('{"version":1,"byDate":{},"active":null}');
    const stored = { version: 1 as const, byDate: { '2026-07-03': [{ id: 'r1', label: '일', start: '09:00', end: '10:00', color: '#60a5fa' }] }, active: null };
    expect(recordsCodec.decode(JSON.parse(JSON.stringify(recordsCodec.encode(stored))))).toEqual(stored);
  });
});
