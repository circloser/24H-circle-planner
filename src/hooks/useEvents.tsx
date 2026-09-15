/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import { usePersistedState, type PersistedCodec } from '@/hooks/usePersistedState';

/** One dated entry in the calendar (a day holds a list of them). */
export interface CalendarEvent {
  id: string;
  text: string;
}

/** Events filed by LOCAL date key, 'YYYY-MM-DD' (see lib/calendar-grid). */
export type EventsByDate = Record<string, CalendarEvent[]>;

const STORAGE_KEY = '24h-circle-planner.events';
export const MAX_EVENT_CHARS = 60;

const isEvent = (e: unknown): e is CalendarEvent => {
  const o = e as Record<string, unknown> | null;
  return !!o && typeof o['id'] === 'string' && typeof o['text'] === 'string';
};
const isDateKey = (k: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(k);

/** Storage envelope `{version: 1, events}` — also what the cloud carries, so
 *  decode is strict: a corrupt or foreign entry is dropped, never thrown on. */
export const eventsCodec: PersistedCodec<EventsByDate> = {
  decode: (parsed) => {
    const p = parsed as { version?: number; events?: unknown } | null;
    if (!p || p.version !== 1 || !p.events || typeof p.events !== 'object') return null;
    const out: EventsByDate = {};
    for (const [key, list] of Object.entries(p.events as Record<string, unknown>)) {
      if (!isDateKey(key) || !Array.isArray(list)) continue;
      const kept = list.filter(isEvent).map((e) => ({ id: e.id, text: e.text }));
      if (kept.length) out[key] = kept;
    }
    return out;
  },
  encode: (events) => ({ version: 1, events }),
  fallback: () => ({}),
};

interface EventsApi {
  /** Every day that holds events, keyed by date. */
  events: EventsByDate;
  addEvent: (dateKey: string, text: string) => void;
  removeEvent: (dateKey: string, id: string) => void;
}

const Ctx = createContext<EventsApi | null>(null);

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = usePersistedState<EventsByDate>(STORAGE_KEY, eventsCodec);

  const addEvent = useCallback((dateKey: string, text: string) => {
    const clean = text.trim().slice(0, MAX_EVENT_CHARS);
    if (!clean || !isDateKey(dateKey)) return;
    setEvents((prev) => ({ ...prev, [dateKey]: [...(prev[dateKey] ?? []), { id: uuid(), text: clean }] }));
  }, [setEvents]);

  const removeEvent = useCallback((dateKey: string, id: string) => {
    setEvents((prev) => {
      const left = (prev[dateKey] ?? []).filter((e) => e.id !== id);
      const next = { ...prev };
      // A day with nothing left drops out entirely, so the synced blob only
      // carries days that actually hold something.
      if (left.length) next[dateKey] = left;
      else delete next[dateKey];
      return next;
    });
  }, [setEvents]);

  const api = useMemo(() => ({ events, addEvent, removeEvent }), [events, addEvent, removeEvent]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useEvents(): EventsApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEvents must be used within EventsProvider');
  return ctx;
}
