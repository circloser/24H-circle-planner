import { useCallback, useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';

export interface RimMemo {
  id: string;
  /** Geometric angle on the rim (deg, 0 = 3 o'clock, +y downward like SVG). */
  angleDeg: number;
  text: string;
  createdAt: number;
}

const STORAGE_KEY = '24h-circle-planner.rimmemos';

function load(): RimMemo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { version?: number; memos?: RimMemo[] };
      if (parsed && parsed.version === 1 && Array.isArray(parsed.memos)) return parsed.memos;
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

  const add = useCallback((angleDeg: number): string => {
    const id = uuid();
    setMemos((m) => [...m, { id, angleDeg, text: '', createdAt: Date.now() }]);
    return id;
  }, []);

  const update = useCallback((id: string, text: string) => {
    setMemos((m) => m.map((x) => (x.id === id ? { ...x, text } : x)));
  }, []);

  const remove = useCallback((id: string) => {
    setMemos((m) => m.filter((x) => x.id !== id));
  }, []);

  return { memos, add, update, remove };
}
