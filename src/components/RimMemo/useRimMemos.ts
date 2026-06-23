import { useCallback, useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { minForAngle, FULL_SPEC } from '@/lib/chart-view';

export interface RimMemo {
  id: string;
  /** Anchor time, minute-of-day (0..1439). The on-screen angle is derived from
   *  the active view (24h / 12h), so the memo follows the time when views switch. */
  minute: number;
  text: string;
  createdAt: number;
}

const STORAGE_KEY = '24h-circle-planner.rimmemos';
const LEGACY_KEY = '__default';

/** A bucket of rim memos per day id. */
type ByDay = Record<string, RimMemo[]>;

function migrateList(list: Array<Partial<RimMemo> & { angleDeg?: number }>): RimMemo[] {
  return list.map((m) => ({
    id: m.id ?? uuid(),
    text: m.text ?? '',
    createdAt: typeof m.createdAt === 'number' ? m.createdAt : 0,
    minute:
      typeof m.minute === 'number'
        ? m.minute
        : typeof m.angleDeg === 'number'
          ? minForAngle(m.angleDeg, FULL_SPEC)
          : 0,
  }));
}

function loadByDay(): ByDay {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        version?: number;
        byDay?: Record<string, Array<Partial<RimMemo> & { angleDeg?: number }>>;
        memos?: Array<Partial<RimMemo> & { angleDeg?: number }>;
      };
      if (parsed && parsed.version === 1 && parsed.byDay && typeof parsed.byDay === 'object') {
        const out: ByDay = {};
        for (const [k, v] of Object.entries(parsed.byDay)) out[k] = migrateList(Array.isArray(v) ? v : []);
        return out;
      }
      // Legacy flat list (pre per-day) → park under LEGACY_KEY; reassigned to the
      // first active day on load so existing rim memos aren't lost.
      if (parsed && parsed.version === 1 && Array.isArray(parsed.memos)) {
        return { [LEGACY_KEY]: migrateList(parsed.memos) };
      }
    }
  } catch {
    // ignore corrupt/unavailable storage
  }
  return {};
}

function saveByDay(byDay: ByDay): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, byDay }));
  } catch {
    // storage unavailable — memos simply won't persist
  }
}

/**
 * One-time: hand legacy (pre per-day) memos parked under LEGACY_KEY to the active
 * day so existing rim memos aren't orphaned. Done in the load path (not an effect)
 * so it runs once at mount — `activeId` is already known synchronously by then.
 */
function foldLegacyInto(byDay: ByDay, dayId: string | null): ByDay {
  if (!dayId) return byDay;
  const legacy = byDay[LEGACY_KEY];
  if (!legacy?.length || byDay[dayId] !== undefined) return byDay;
  const next = { ...byDay, [dayId]: legacy };
  delete next[LEGACY_KEY];
  return next;
}

/**
 * Rim memos scoped to a day. Each day has its own list, so switching/adding days
 * shows that day's rim memos (they belong to the day). `dayId` null falls back to
 * a default bucket (e.g. when the multi-day provider isn't mounted).
 */
export function useRimMemos(dayId: string | null) {
  // Fold any legacy (pre per-day) memos into the active day at mount — `dayId`
  // is already resolved synchronously from useDays by the first render.
  const [byDay, setByDay] = useState<ByDay>(() => foldLegacyInto(loadByDay(), dayId));
  const key = dayId ?? LEGACY_KEY;

  useEffect(() => {
    saveByDay(byDay);
  }, [byDay]);

  const memos = byDay[key] ?? [];
  const setList = useCallback(
    (updater: (list: RimMemo[]) => RimMemo[]) => {
      setByDay((prev) => ({ ...prev, [key]: updater(prev[key] ?? []) }));
    },
    [key],
  );

  const add = useCallback(
    (minute: number): string => {
      const id = uuid();
      setList((m) => [...m, { id, minute, text: '', createdAt: Date.now() }]);
      return id;
    },
    [setList],
  );
  const update = useCallback((id: string, text: string) => {
    setList((m) => m.map((x) => (x.id === id ? { ...x, text } : x)));
  }, [setList]);
  const setMinute = useCallback((id: string, minute: number) => {
    setList((m) => m.map((x) => (x.id === id ? { ...x, minute } : x)));
  }, [setList]);
  const remove = useCallback((id: string) => {
    setList((m) => m.filter((x) => x.id !== id));
  }, [setList]);

  return { memos, add, update, setMinute, remove };
}
