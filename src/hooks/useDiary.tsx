/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useCallback } from 'react';
import type { Schedule } from '@/types/schedule';
import type { TimeSlice } from '@/types/time-slice';
import { useDays } from '@/hooks/useDays';
import { usePersistedState, type PersistedCodec } from '@/hooks/usePersistedState';
import { readRimMemos, type RimMemo } from '@/components/RimMemo/useRimMemos';

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
  /** Rim memos belonging to this date (optional — entries saved before this
   *  feature have none). Restored when the record is loaded. */
  rimMemos?: RimMemo[];
  /** Free-form long-text note for the day (optional). Shown under the chart. */
  note?: string;
  savedAt: number; // epoch ms
}

type DiaryMap = Record<string, DiaryEntry>;

const STORAGE_KEY = '24h-circle-planner.diary';

/** Fired when the diary goes from empty to its first saved entry — App answers
 *  it with the "where is this kept" notice (see SyncPrivacyDialog). */
export const DIARY_FIRST_SAVE_EVENT = '24h:diary-first-save';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local-time YYYY-MM-DD key for a date (defaults to today). */
export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Storage envelope `{version: 1, entries}` — byte-compat pinned by tests. */
export const diaryCodec: PersistedCodec<DiaryMap> = {
  decode: (parsed) => {
    const p = parsed as { version?: number; entries?: DiaryMap } | null;
    if (p && p.version === 1 && p.entries && typeof p.entries === 'object') return p.entries;
    return null;
  },
  encode: (entries) => ({ version: 1, entries }),
  fallback: () => ({}),
};

interface DiaryApi {
  entries: DiaryMap;
  /** Snapshot a schedule under a date (defaults to today). Overwrites that date,
   *  but preserves any existing note for the date. */
  saveEntry: (schedule: Schedule, date?: string) => void;
  /** Set/replace the free-form note for an existing dated entry. */
  setEntryNote: (date: string, note: string) => void;
  removeEntry: (date: string) => void;
}

const DiaryContext = createContext<DiaryApi | null>(null);

export function DiaryProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = usePersistedState(STORAGE_KEY, diaryCodec);
  const { activeId } = useDays();

  const saveEntry = useCallback((schedule: Schedule, date?: string) => {
    const key = date ?? dateKey();
    setEntries((prev) => {
      // The very first entry is the moment to explain where a diary is kept
      // (this device, and the server too once Pro sync is on) — App listens.
      if (Object.keys(prev).length === 0) {
        try {
          window.dispatchEvent(new Event(DIARY_FIRST_SAVE_EVENT));
        } catch {
          /* non-browser */
        }
      }
      return {
      ...prev,
      [key]: {
        date: key,
        name: schedule.name ?? '',
        slices: schedule.slices.map((s) => ({ ...s })),
        // Snapshot the current day's rim memos so they belong to this date.
        rimMemos: readRimMemos(activeId).map((m) => ({ ...m })),
        // Keep any note already written for this date (the timetable save and
        // the note step are separate actions).
        note: prev[key]?.note,
        savedAt: Date.now(),
      },
      };
    });
  }, [activeId, setEntries]);

  const setEntryNote = useCallback((date: string, note: string) => {
    setEntries((prev) => {
      const entry = prev[date];
      if (!entry) return prev;
      return { ...prev, [date]: { ...entry, note, savedAt: Date.now() } };
    });
  }, [setEntries]);

  const removeEntry = useCallback((date: string) => {
    setEntries((prev) => {
      if (!(date in prev)) return prev;
      const next = { ...prev };
      delete next[date];
      return next;
    });
  }, [setEntries]);

  return (
    <DiaryContext.Provider value={{ entries, saveEntry, setEntryNote, removeEntry }}>
      {children}
    </DiaryContext.Provider>
  );
}

export function useDiary(): DiaryApi {
  const ctx = useContext(DiaryContext);
  if (!ctx) {
    // Inert fallback (e.g. tests/previews without the provider).
    return { entries: {}, saveEntry: () => {}, setEntryNote: () => {}, removeEntry: () => {} };
  }
  return ctx;
}
