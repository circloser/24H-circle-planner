/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext } from 'react';
import { v4 as uuid } from 'uuid';
import { dateKey } from '@/hooks/useDiary';
import { usePersistedState, type PersistedCodec } from '@/hooks/usePersistedState';

/**
 * Real-time activity recording ("기록 모드"). Unlike the planner ring, records are
 * NON-contiguous: only the time you actually log is filled, gaps stay empty. A
 * live recording (start pressed, no stop yet) is kept separately so it survives
 * reloads. Records are kept per local date.
 */
export interface RecordItem {
  id: string;
  label: string;
  start: string; // HH:MM
  end: string; // HH:MM
  color: string;
}

export interface ActiveRecord {
  label: string;
  start: string; // HH:MM
  startedAt: number; // epoch ms — for the live elapsed readout
  color: string;
}

const STORAGE_KEY = '24h-circle-planner.records';
const PALETTE = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb923c', '#22d3ee', '#f87171'];
const pad2 = (n: number) => String(n).padStart(2, '0');

export function nowHhmm(d: Date = new Date()): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

interface Stored {
  version: 1;
  byDate: Record<string, RecordItem[]>;
  active: ActiveRecord | null;
}

/** The state IS the stored envelope `{version: 1, byDate, active}` — encode is
 *  identity. Byte-compat pinned by tests. */
export const recordsCodec: PersistedCodec<Stored> = {
  decode: (parsed) => {
    const p = parsed as Partial<Stored> | null;
    if (p && p.version === 1 && p.byDate && typeof p.byDate === 'object') {
      return { version: 1, byDate: p.byDate as Record<string, RecordItem[]>, active: p.active ?? null };
    }
    return null;
  },
  encode: (s) => s,
  fallback: () => ({ version: 1, byDate: {}, active: null }),
};

/** Append a record to a date's list, kept sorted by start time. */
function appendItem(s: Stored, date: string, item: RecordItem): Stored {
  const list = [...(s.byDate[date] ?? []), item].sort((a, b) => a.start.localeCompare(b.start));
  return { ...s, byDate: { ...s.byDate, [date]: list } };
}

interface RecordsApi {
  records: RecordItem[]; // today's, chronological
  active: ActiveRecord | null;
  startLive: (label: string) => void;
  stopLive: () => void;
  cancelLive: () => void;
  addManual: (label: string, start: string, end: string) => void;
  removeRecord: (id: string) => void;
  clearToday: () => void;
}

const RecordsContext = createContext<RecordsApi | null>(null);

export function RecordsProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = usePersistedState(STORAGE_KEY, recordsCodec);
  const today = dateKey();

  const todays = stored.byDate[today] ?? [];

  const startLive = useCallback((label: string) => {
    setStored((s) => {
      if (s.active) return s; // already recording
      const count = (s.byDate[today] ?? []).length;
      return { ...s, active: { label: label.trim(), start: nowHhmm(), startedAt: Date.now(), color: PALETTE[count % PALETTE.length] } };
    });
  }, [today, setStored]);

  const stopLive = useCallback(() => {
    setStored((s) => {
      if (!s.active) return s;
      const end = nowHhmm();
      const item: RecordItem = { id: uuid(), label: s.active.label, start: s.active.start, end, color: s.active.color };
      // Drop zero-length records (stopped within the same minute).
      const next = item.start === item.end ? { ...s, active: null } : { ...appendItem(s, today, item), active: null };
      return next;
    });
  }, [today, setStored]);

  const cancelLive = useCallback(() => {
    setStored((s) => (s.active ? { ...s, active: null } : s));
  }, [setStored]);

  const addManual = useCallback((label: string, start: string, end: string) => {
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start === end) return;
    setStored((s) => {
      const count = (s.byDate[today] ?? []).length;
      const item: RecordItem = { id: uuid(), label: label.trim(), start, end, color: PALETTE[count % PALETTE.length] };
      return appendItem(s, today, item);
    });
  }, [today, setStored]);

  const removeRecord = useCallback((id: string) => {
    setStored((s) => ({ ...s, byDate: { ...s.byDate, [today]: (s.byDate[today] ?? []).filter((r) => r.id !== id) } }));
  }, [today, setStored]);

  const clearToday = useCallback(() => {
    setStored((s) => ({ ...s, byDate: { ...s.byDate, [today]: [] } }));
  }, [today, setStored]);

  return (
    <RecordsContext.Provider value={{ records: todays, active: stored.active, startLive, stopLive, cancelLive, addManual, removeRecord, clearToday }}>
      {children}
    </RecordsContext.Provider>
  );
}

export function useRecords(): RecordsApi {
  const ctx = useContext(RecordsContext);
  if (!ctx) {
    return { records: [], active: null, startLive: () => {}, stopLive: () => {}, cancelLive: () => {}, addManual: () => {}, removeRecord: () => {}, clearToday: () => {} };
  }
  return ctx;
}
