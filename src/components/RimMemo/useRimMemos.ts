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

function load(): RimMemo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        version?: number;
        memos?: Array<Partial<RimMemo> & { angleDeg?: number }>;
      };
      if (parsed && parsed.version === 1 && Array.isArray(parsed.memos)) {
        // Migrate v1 memos that anchored to a geometric angle (24h view) → minute.
        return parsed.memos.map((m) => ({
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
    }
  } catch {
    // ignore corrupt/unavailable storage
  }
  return [];
}

function save(memos: RimMemo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, memos }));
  } catch {
    // storage unavailable — memos simply won't persist
  }
}

/** Self-contained store for rim annotation memos (no provider needed). */
export function useRimMemos() {
  const [memos, setMemos] = useState<RimMemo[]>(load);

  useEffect(() => {
    save(memos);
  }, [memos]);

  const add = useCallback((minute: number): string => {
    const id = uuid();
    setMemos((m) => [...m, { id, minute, text: '', createdAt: Date.now() }]);
    return id;
  }, []);

  const update = useCallback((id: string, text: string) => {
    setMemos((m) => m.map((x) => (x.id === id ? { ...x, text } : x)));
  }, []);

  const setMinute = useCallback((id: string, minute: number) => {
    setMemos((m) => m.map((x) => (x.id === id ? { ...x, minute } : x)));
  }, []);

  const remove = useCallback((id: string) => {
    setMemos((m) => m.filter((x) => x.id !== id));
  }, []);

  return { memos, add, update, setMinute, remove };
}
