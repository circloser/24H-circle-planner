/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import { usePersistedState, type PersistedCodec } from '@/hooks/usePersistedState';
import { DEFAULT_EVENT_COLOR, isRepeat, isTime, spanOf, type CalendarEvent } from '@/lib/calendar-events';
import { addDays } from '@/lib/calendar-grid';

export type { CalendarEvent } from '@/lib/calendar-events';

/** Events filed by LOCAL date key, 'YYYY-MM-DD' (see lib/calendar-grid). */
export type EventsByDate = Record<string, CalendarEvent[]>;

const STORAGE_KEY = '24h-circle-planner.events';
export const MAX_EVENT_CHARS = 60;
/** A span longer than this is almost certainly a mis-drag. */
export const MAX_EVENT_DAYS = 366;

const isDateKey = (k: unknown): k is string => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);

/** Keep only the fields we know, in a fixed order, so load → save is stable. */
function cleanEvent(e: unknown): CalendarEvent | null {
  const o = e as Record<string, unknown> | null;
  if (!o || typeof o['id'] !== 'string' || typeof o['text'] !== 'string') return null;
  const ev: CalendarEvent = { id: o['id'], text: o['text'] };
  if (isTime(o['time'])) ev.time = o['time'];
  if (typeof o['color'] === 'string') ev.color = o['color'];
  if (isRepeat(o['repeat']) && o['repeat'] !== 'none') ev.repeat = o['repeat'];
  const days = Number(o['days']);
  if (Number.isFinite(days) && days > 1) ev.days = Math.min(MAX_EVENT_DAYS, Math.floor(days));
  const skip = Array.isArray(o['skip']) ? o['skip'].filter(isDateKey) : [];
  if (skip.length) ev.skip = skip;
  if (isDateKey(o['until'])) ev.until = o['until'];
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
  /** How many days the entry covers (a drag across the grid sets this). */
  days?: number;
}

interface EventsApi {
  /** Every day that holds events, keyed by the date they are filed under. */
  events: EventsByDate;
  addEvent: (dateKey: string, draft: EventDraft) => void;
  /** Change an entry in place (the whole series, when it repeats). */
  updateEvent: (dateKey: string, id: string, patch: EventDraft) => void;
  /** Re-file an entry under another date — a drag across the grid. */
  moveEvent: (dateKey: string, id: string, toKey: string) => void;
  /** Drop ONE occurrence of a repeat, leaving the rest alone. */
  skipOccurrence: (dateKey: string, id: string, day: string) => void;
  /** Stop a repeat before `day`, keeping everything earlier. */
  endSeriesBefore: (dateKey: string, id: string, day: string) => void;
  /** Remove the entry outright (a repeat loses every occurrence). */
  removeEvent: (dateKey: string, id: string) => void;
}

const Ctx = createContext<EventsApi | null>(null);

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = usePersistedState<EventsByDate>(STORAGE_KEY, eventsCodec);

  /** Apply `fn` to one entry; returning null removes it (and empties the day). */
  const patchOne = useCallback((dateKey: string, id: string, fn: (ev: CalendarEvent) => CalendarEvent | null) => {
    setEvents((prev) => {
      const list = prev[dateKey];
      if (!list) return prev;
      const kept: CalendarEvent[] = [];
      for (const ev of list) {
        if (ev.id !== id) { kept.push(ev); continue; }
        const next = fn(ev);
        if (next) kept.push(next);
      }
      const out = { ...prev };
      // A day with nothing left drops out entirely, so the synced blob only
      // carries days that actually hold something.
      if (kept.length) out[dateKey] = kept;
      else delete out[dateKey];
      return out;
    });
  }, [setEvents]);

  const fromDraft = useCallback((draft: EventDraft, base: CalendarEvent): CalendarEvent => {
    const ev: CalendarEvent = { id: base.id, text: draft.text.trim().slice(0, MAX_EVENT_CHARS) || base.text };
    if (isTime(draft.time)) ev.time = draft.time;
    ev.color = draft.color ?? base.color ?? DEFAULT_EVENT_COLOR;
    if (isRepeat(draft.repeat) && draft.repeat !== 'none') ev.repeat = draft.repeat;
    const days = Math.floor(draft.days ?? spanOf(base));
    if (days > 1) ev.days = Math.min(MAX_EVENT_DAYS, days);
    return ev;
  }, []);

  const addEvent = useCallback((dateKey: string, draft: EventDraft) => {
    if (!draft.text.trim() || !isDateKey(dateKey)) return;
    const ev = fromDraft(draft, { id: uuid(), text: draft.text });
    setEvents((prev) => ({ ...prev, [dateKey]: [...(prev[dateKey] ?? []), ev] }));
  }, [fromDraft, setEvents]);

  const updateEvent = useCallback((dateKey: string, id: string, patch: EventDraft) => {
    patchOne(dateKey, id, (ev) => ({ ...fromDraft(patch, ev), skip: ev.skip, until: ev.until }));
  }, [fromDraft, patchOne]);

  const moveEvent = useCallback((dateKey: string, id: string, toKey: string) => {
    if (!isDateKey(toKey) || toKey === dateKey) return;
    setEvents((prev) => {
      const moving = (prev[dateKey] ?? []).find((e) => e.id === id);
      if (!moving) return prev;
      const left = (prev[dateKey] ?? []).filter((e) => e.id !== id);
      const out = { ...prev, [toKey]: [...(prev[toKey] ?? []), moving] };
      if (left.length) out[dateKey] = left;
      else delete out[dateKey];
      return out;
    });
  }, [setEvents]);

  const skipOccurrence = useCallback((dateKey: string, id: string, day: string) => {
    if (!isDateKey(day)) return;
    patchOne(dateKey, id, (ev) => {
      // Dropping the very first day of a one-off is just a delete.
      if (!ev.repeat || ev.repeat === 'none') return null;
      const skip = [...(ev.skip ?? [])];
      if (!skip.includes(day)) skip.push(day);
      return { ...ev, skip };
    });
  }, [patchOne]);

  const endSeriesBefore = useCallback((dateKey: string, id: string, day: string) => {
    if (!isDateKey(day)) return;
    patchOne(dateKey, id, (ev) => {
      // Nothing would be left before it → remove the entry outright.
      if (day <= dateKey) return null;
      return { ...ev, until: addDays(day, -1) };
    });
  }, [patchOne]);

  const removeEvent = useCallback((dateKey: string, id: string) => {
    patchOne(dateKey, id, () => null);
  }, [patchOne]);

  const api = useMemo(
    () => ({ events, addEvent, updateEvent, moveEvent, skipOccurrence, endSeriesBefore, removeEvent }),
    [events, addEvent, updateEvent, moveEvent, skipOccurrence, endSeriesBefore, removeEvent],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useEvents(): EventsApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEvents must be used within EventsProvider');
  return ctx;
}
