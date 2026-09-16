/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import { usePersistedState, type PersistedCodec } from '@/hooks/usePersistedState';
import { DEFAULT_EVENT_COLOR, isRepeat, isTime, type CalendarEvent } from '@/lib/calendar-events';

export type { CalendarEvent } from '@/lib/calendar-events';

/** Events filed by LOCAL date key, 'YYYY-MM-DD' (see lib/calendar-grid). */
export type EventsByDate = Record<string, CalendarEvent[]>;

const STORAGE_KEY = '24h-circle-planner.events';
export const MAX_EVENT_CHARS = 60;

const isDateKey = (k: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(k);

/** Keep only the fields we know, in a fixed order, so load → save is stable. */
function cleanEvent(e: unknown): CalendarEvent | null {
  const o = e as Record<string, unknown> | null;
  if (!o || typeof o['id'] !== 'string' || typeof o['text'] !== 'string') return null;
  const ev: CalendarEvent = { id: o['id'], text: o['text'] };
  if (isTime(o['time'])) ev.time = o['time'];
  if (typeof o['color'] === 'string') ev.color = o['color'];
  if (isRepeat(o['repeat']) && o['repeat'] !== 'none') ev.repeat = o['repeat'];
  return ev;
}

/** Storage envelope `{version: 1, events}` — also what the cloud carries, so
 *  decode is strict: a corrupt or foreign entry is dropped, never thrown on.
 *  Entries from the first version (id + text only) read as all-day one-offs. */
export const eventsCodec: PersistedCodec<EventsByDate> = {
  decode: (parsed) => {
    const p = parsed as { version?: number; events?: unknown } | null;
    if (!p || p.version !== 1 || !p.events || typeof p.events !== 'object') return null;
    const out: EventsByDate = {};
    for (const [key, list] of Object.entries(p.events as Record<string, unknown>)) {
      if (!isDateKey(key) || !Array.isArray(list)) continue;
      const kept = list.map(cleanEvent).filter((e): e is CalendarEvent => e !== null);
      if (kept.length) out[key] = kept;
    }
    return out;
  },
  encode: (events) => ({ version: 1, events }),
  fallback: () => ({}),
};

/** What the day editor hands over; everything but the text has a default. */
export interface EventDraft {
  text: string;
  time?: string | null;
  color?: string;
  repeat?: CalendarEvent['repeat'];
}

interface EventsApi {
  /** Every day that holds events, keyed by the date they are filed under. */
  events: EventsByDate;
  addEvent: (dateKey: string, draft: EventDraft) => void;
  /** Removes the entry (a repeating one disappears from every day at once). */
  removeEvent: (dateKey: string, id: string) => void;
}

const Ctx = createContext<EventsApi | null>(null);

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = usePersistedState<EventsByDate>(STORAGE_KEY, eventsCodec);

  const addEvent = useCallback((dateKey: string, draft: EventDraft) => {
    const clean = draft.text.trim().slice(0, MAX_EVENT_CHARS);
    if (!clean || !isDateKey(dateKey)) return;
    const ev: CalendarEvent = { id: uuid(), text: clean };
    if (isTime(draft.time)) ev.time = draft.time;
    ev.color = draft.color ?? DEFAULT_EVENT_COLOR;
    if (isRepeat(draft.repeat) && draft.repeat !== 'none') ev.repeat = draft.repeat;
    setEvents((prev) => ({ ...prev, [dateKey]: [...(prev[dateKey] ?? []), ev] }));
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
