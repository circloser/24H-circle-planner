/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { randomQuote } from '@/data/quotes';

const MEMO_SIZE = 200;

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
    // Drop the note at a random spot in the viewport (kept fully on-screen,
    // below the header) seeded with a random famous quote.
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const memo: Memo = {
      id: uuid(),
      text: randomQuote(),
      x: Math.round(16 + Math.random() * Math.max(0, vw - MEMO_SIZE - 32)),
      y: Math.round(76 + Math.random() * Math.max(0, vh - MEMO_SIZE - 96)),
      color: DEFAULT_COLOR,
      fontFamily: 'Pretendard',
    };
    setMemos((prev) => [...prev, memo]);
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
