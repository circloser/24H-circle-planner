/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { randomQuote } from '@/data/quotes';
import { useTranslation } from '@/hooks/usePreferences';

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
  visible?: boolean;
}

interface MemoState {
  memos: Memo[];
  visible: boolean;
}

function loadState(): MemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MemoEnvelope;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.memos)) {
        return { memos: parsed.memos, visible: parsed.visible !== false };
      }
    }
  } catch {
    // ignore corrupt/unavailable storage
  }
  return { memos: [], visible: true };
}

function saveState(state: MemoState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, memos: state.memos, visible: state.visible }),
    );
  } catch {
    // storage unavailable — memos simply won't persist
  }
}

/**
 * Pick a spawn position that avoids the circular timetable. The chart is a
 * centered square; we drop the note into whichever side/below/above strip has
 * room (falling back to anywhere on small screens).
 */
function pickSpawn(size: number): { x: number; y: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const m = 12;
  const headerY = 64;
  const rand = (lo: number, hi: number) => lo + Math.random() * Math.max(0, hi - lo);

  const chart =
    typeof document !== 'undefined' ? document.querySelector('svg[role="img"]') : null;
  const cr = chart?.getBoundingClientRect();

  if (cr && cr.width > 0) {
    const regions: Array<[number, number, number, number]> = []; // [xLo,xHi,yLo,yHi]
    if (cr.left - m >= size + m) regions.push([m, cr.left - size - m, headerY, vh - size - m]);
    if (vw - cr.right >= size + m) regions.push([cr.right + m, vw - size - m, headerY, vh - size - m]);
    if (vh - cr.bottom >= size + m) regions.push([m, vw - size - m, cr.bottom + m, vh - size - m]);
    if (cr.top - headerY >= size + m) regions.push([m, vw - size - m, headerY, cr.top - size - m]);
    if (regions.length) {
      const [xLo, xHi, yLo, yHi] = regions[Math.floor(Math.random() * regions.length)];
      return { x: Math.round(rand(xLo, xHi)), y: Math.round(rand(yLo, yHi)) };
    }
  }
  return { x: Math.round(rand(m, vw - size - m)), y: Math.round(rand(headerY + 12, vh - size - m)) };
}

interface MemoContextValue {
  memos: Memo[];
  visible: boolean;
  addMemo: () => void;
  updateMemo: (id: string, patch: Partial<Memo>) => void;
  removeMemo: (id: string) => void;
  toggleVisible: () => void;
}

const MemoContext = createContext<MemoContextValue | null>(null);

export function MemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MemoState>(loadState);
  const { memos, visible } = state;
  const { lang } = useTranslation();

  useEffect(() => {
    saveState(state);
  }, [state]);

  const addMemo = useCallback(() => {
    const { x, y } = pickSpawn(MEMO_SIZE);
    const memo: Memo = {
      id: uuid(),
      // Seed the note with a quote in the current UI language.
      text: randomQuote(lang),
      x,
      y,
      color: DEFAULT_COLOR,
      fontFamily: 'Pretendard',
    };
    // Adding a note implies the layer should be visible.
    setState((prev) => ({ memos: [...prev.memos, memo], visible: true }));
  }, [lang]);

  const updateMemo = useCallback((id: string, patch: Partial<Memo>) => {
    setState((prev) => ({
      ...prev,
      memos: prev.memos.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  }, []);

  const removeMemo = useCallback((id: string) => {
    setState((prev) => ({ ...prev, memos: prev.memos.filter((m) => m.id !== id) }));
  }, []);

  const toggleVisible = useCallback(() => {
    setState((prev) => ({ ...prev, visible: !prev.visible }));
  }, []);

  return (
    <MemoContext.Provider value={{ memos, visible, addMemo, updateMemo, removeMemo, toggleVisible }}>
      {children}
    </MemoContext.Provider>
  );
}

export function useMemos(): MemoContextValue {
  const ctx = useContext(MemoContext);
  if (!ctx) throw new Error('useMemos must be used within MemoProvider');
  return ctx;
}
