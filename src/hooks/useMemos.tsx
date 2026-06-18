/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { v4 as uuid } from 'uuid';

export interface Memo {
  id: string;
  text: string;
  x: number; // viewport px (position: fixed)
  y: number;
  color: string; // post-it background
  fontFamily: string; // css family value
}

/** Post-it colours. Default is the classic yellow. */
export const MEMO_COLORS = ['#fef08a', '#fbcfe8', '#bfdbfe', '#bbf7d0', '#fed7aa', '#ddd6fe'];
const DEFAULT_COLOR = MEMO_COLORS[0];

const STORAGE_KEY = '24h-circle-planner.memos';

interface MemoEnvelope {
  version: 1;
  memos: Memo[];
}

function loadMemos(): Memo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MemoEnvelope;
    if (parsed && parsed.version === 1 && Array.isArray(parsed.memos)) return parsed.memos;
  } catch {
    // ignore corrupt/unavailable storage
  }
  return [];
}

function saveMemos(memos: Memo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, memos }));
  } catch {
    // storage unavailable — memos simply won't persist
  }
}

interface MemoContextValue {
  memos: Memo[];
  addMemo: () => void;
  updateMemo: (id: string, patch: Partial<Memo>) => void;
  removeMemo: (id: string) => void;
}

const MemoContext = createContext<MemoContextValue | null>(null);

export function MemoProvider({ children }: { children: React.ReactNode }) {
  const [memos, setMemos] = useState<Memo[]>(loadMemos);

  useEffect(() => {
    saveMemos(memos);
  }, [memos]);

  const addMemo = useCallback(() => {
    setMemos((prev) => {
      // Cascade new notes so they don't stack exactly on top of each other.
      const step = prev.length % 8;
      const memo: Memo = {
        id: uuid(),
        text: '',
        x: 28 + step * 18,
        y: 96 + step * 18,
        color: DEFAULT_COLOR,
        fontFamily: 'Pretendard',
      };
      return [...prev, memo];
    });
  }, []);

  const updateMemo = useCallback((id: string, patch: Partial<Memo>) => {
    setMemos((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const removeMemo = useCallback((id: string) => {
    setMemos((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <MemoContext.Provider value={{ memos, addMemo, updateMemo, removeMemo }}>
      {children}
    </MemoContext.Provider>
  );
}

export function useMemos(): MemoContextValue {
  const ctx = useContext(MemoContext);
  if (!ctx) throw new Error('useMemos must be used within MemoProvider');
  return ctx;
}
