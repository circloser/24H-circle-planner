/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Schedule } from '@/types/schedule';
import type { TimeSlice } from '@/types/time-slice';

/**
 * Diary: a per-DATE record of a day's timetable (distinct from the clock-tools
 * calendar). "Save today" snapshots the current schedule under today's date; the
 * diary calendar then shows a mini-chart on saved days, so you can see at a glance
 * which days you logged. Persisted to localStorage; analytics reads it too.
 */
export interface DiaryEntry {
  date: string; // local YYYY-MM-DD
  name: string;
  slices: TimeSlice[];
  savedAt: number; // epoch ms
}

type DiaryMap = Record<string, DiaryEntry>;

const STORAGE_KEY = '24h-circle-planner.diary';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local-time YYYY-MM-DD key for a date (defaults to today). */
export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function loadMap(): DiaryMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { version?: number; entries?: DiaryMap };
      if (parsed && parsed.version === 1 && parsed.entries && typeof parsed.entries === 'object') {
        return parsed.entries;
      }
    }
  } catch {
    // ignore corrupt/unavailable storage
  }
  return {};
}

function saveMap(entries: DiaryMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries }));
  } catch {
    // storage unavailable — diary simply won't persist
  }
}

interface DiaryApi {
  entries: DiaryMap;
  /** Snapshot a schedule under a date (defaults to today). Overwrites that date. */
  saveEntry: (schedule: Schedule, date?: string) => void;
  removeEntry: (date: string) => void;
}

const DiaryContext = createContext<DiaryApi | null>(null);

export function DiaryProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<DiaryMap>(loadMap);

  useEffect(() => {
    saveMap(entries);
  }, [entries]);

  const saveEntry = useCallback((schedule: Schedule, date?: string) => {
    const key = date ?? dateKey();
    setEntries((prev) => ({
      ...prev,
      [key]: {
        date: key,
        name: schedule.name ?? '',
        slices: schedule.slices.map((s) => ({ ...s })),
        savedAt: Date.now(),
      },
    }));
  }, []);

  const removeEntry = useCallback((date: string) => {
    setEntries((prev) => {
      if (!(date in prev)) return prev;
      const next = { ...prev };
      delete next[date];
      return next;
    });
  }, []);

  return (
    <DiaryContext.Provider value={{ entries, saveEntry, removeEntry }}>
      {children}
    </DiaryContext.Provider>
  );
}

export function useDiary(): DiaryApi {
  const ctx = useContext(DiaryContext);
  if (!ctx) {
    // Inert fallback (e.g. tests/previews without the provider).
    return { entries: {}, saveEntry: () => {}, removeEntry: () => {} };
  }
  return ctx;
}
