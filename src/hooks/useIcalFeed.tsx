import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePersistedState } from './usePersistedState';
import { calendarName, icalColor, icalDays, parseIcs, type IcalDayEvent } from '@/lib/ical';

/**
 * Read-only Google calendars, pulled from their private iCal addresses (Pro).
 * Several can be connected at once — one row per calendar, each with its own
 * tone so they can be told apart on the grid.
 *
 * An address is a bearer secret: anyone holding it can read that calendar. So
 * it stays on THIS device — a plain localStorage key that is deliberately NOT
 * in SYNC_KEYS, so it never reaches our server's storage, and the user pastes
 * it once per device. The feeds are fetched through our Worker (Google sends
 * no CORS headers) and their text is cached here so opening the calendar
 * offline still shows what was last seen.
 */
const KEY = '24h-circle-planner.ical';
/** Refetch when a cached copy is older than this. */
const STALE_MS = 30 * 60 * 1000;
/** Text kept per calendar; a bigger feed still shows, it just isn't cached. */
const MAX_CACHE = 300_000;
/** Enough for a person's own calendars without letting the grid turn to soup. */
export const MAX_FEEDS = 5;

interface StoredFeed {
  id: string;
  url: string;
  ics: string;
  fetchedAt: number;
}

export type IcalStatus = 'idle' | 'loading' | 'ok' | 'error';
/** Reasons worth telling the user apart; anything else is just "failed". */
export type IcalError = 'pro_required' | 'unauthorized' | 'bad_url' | 'feed_not_found' | 'failed';

export interface IcalCalendar {
  id: string;
  url: string;
  /** The feed's own name, falling back to the address's calendar id. */
  name: string;
  color: string;
  fetchedAt: number;
  status: IcalStatus;
  error: IcalError | null;
}

export interface IcalFeeds {
  calendars: IcalCalendar[];
  /** Imported occurrences from every connected calendar, keyed by day. */
  days: (from: string, to: string) => Record<string, IcalDayEvent[]>;
  add: (url: string) => void;
  remove: (id: string) => void;
  refresh: () => void;
  /** The error of the most recent attempt, for the "just pasted this" case. */
  lastError: IcalError | null;
  loading: boolean;
  full: boolean;
}

const newId = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Drop one calendar's error, keeping the map untouched when it has none. */
const without = (id: string) => (errors: Record<string, IcalError>) => {
  if (!(id in errors)) return errors;
  const rest = { ...errors };
  delete rest[id];
  return rest;
};

const one = (parsed: unknown): StoredFeed | null => {
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  if (typeof o.url !== 'string' || !o.url) return null;
  return {
    id: typeof o.id === 'string' && o.id ? o.id : newId(),
    url: o.url,
    ics: typeof o.ics === 'string' ? o.ics : '',
    fetchedAt: typeof o.fetchedAt === 'number' ? o.fetchedAt : 0,
  };
};

const codec = {
  decode: (parsed: unknown): StoredFeed[] | null => {
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    // v1 stored a single {url, ics, fetchedAt}; keep that calendar connected.
    if (Array.isArray(o.feeds)) return o.feeds.map(one).filter((f): f is StoredFeed => !!f).slice(0, MAX_FEEDS);
    const single = one(parsed);
    return single ? [single] : [];
  },
  encode: (feeds: StoredFeed[]) => ({
    version: 2,
    feeds: feeds.map((f) => ({ ...f, ics: f.ics.length > MAX_CACHE ? '' : f.ics })),
  }),
  fallback: (): StoredFeed[] => [],
};

/** 'https://calendar.google.com/calendar/ical/me%40x.com/private-…/basic.ics' → 'me@x.com'. */
function nameFromUrl(url: string): string {
  const part = /\/calendar\/ical\/([^/]+)\//.exec(url)?.[1] ?? '';
  try {
    return decodeURIComponent(part) || url;
  } catch {
    return part || url;
  }
}

export function useIcalFeeds(): IcalFeeds {
  const [feeds, setFeeds] = usePersistedState<StoredFeed[]>(KEY, codec);
  /** Set only from the fetches themselves; statuses below are derived. */
  const [busy, setBusy] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, IcalError>>({});
  const [lastError, setLastError] = useState<IcalError | null>(null);
  const [nonce, setNonce] = useState(0);
  const running = useRef(new Set<string>());

  /** Changes when a calendar is added, removed or its text replaced — the only
   *  moments worth re-checking. (Staleness is judged inside the effect: a clock
   *  reading during render would be impure.) */
  const signature = feeds.map((f) => `${f.id}:${f.ics ? 1 : 0}`).join(',');

  useEffect(() => {
    const inFlight = running.current;
    const todo = feeds
      .filter((f) => nonce > 0 || !f.ics || f.fetchedAt < Date.now() - STALE_MS)
      .map((f) => f.id)
      .filter((id) => !inFlight.has(id));
    if (!todo.length) return;
    todo.forEach((id) => inFlight.add(id));
    let live = true;

    const run = async () => {
      setBusy((b) => [...new Set([...b, ...todo])]);
      for (const id of todo) {
        const feed = feeds.find((f) => f.id === id);
        if (!feed) continue;
        try {
          const res = await fetch(`/api/ical?url=${encodeURIComponent(feed.url)}`, { credentials: 'include' });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            const known: IcalError[] = ['pro_required', 'unauthorized', 'bad_url', 'feed_not_found'];
            const why = known.find((k) => k === body.error) ?? 'failed';
            if (live) {
              setLastError(why);
              // An address the server will never accept is not a calendar, so
              // it is not kept in the list — only the reason is shown. Every
              // other failure keeps its row, to retry or remove deliberately.
              if (why === 'bad_url') setFeeds((list) => list.filter((f) => f.id !== id));
              else setErrors((e) => ({ ...e, [id]: why }));
            }
            continue;
          }
          const ics = await res.text();
          if (!live) return;
          setErrors(without(id));
          setLastError(null);
          setFeeds((list) => list.map((f) => (f.id === id ? { ...f, ics, fetchedAt: Date.now() } : f)));
        } catch {
          if (live) { setErrors((e) => ({ ...e, [id]: 'failed' })); setLastError('failed'); }
        } finally {
          inFlight.delete(id);
        }
      }
      if (live) setBusy((b) => b.filter((x) => !todo.includes(x)));
    };
    void run();
    return () => { live = false; todo.forEach((id) => inFlight.delete(id)); };
    // `feeds` is read for each due id's url; listing it would refetch on every
    // write of the text just fetched — `signature` stands in for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, nonce, setFeeds]);

  const parsed = useMemo(
    () => feeds.map((f, i) => ({
      id: f.id,
      color: icalColor(i),
      name: (f.ics && calendarName(f.ics)) || nameFromUrl(f.url),
      events: f.ics ? parseIcs(f.ics) : [],
    })),
    [feeds],
  );

  const days = useCallback((from: string, to: string) => {
    const merged: Record<string, IcalDayEvent[]> = {};
    for (const feed of parsed) {
      if (!feed.events.length) continue;
      for (const [key, list] of Object.entries(icalDays(feed.events, from, to, feed))) {
        (merged[key] ??= []).push(...list);
      }
    }
    return merged;
  }, [parsed]);

  const calendars: IcalCalendar[] = feeds.map((f, i) => ({
    id: f.id,
    url: f.url,
    name: parsed[i]?.name ?? nameFromUrl(f.url),
    color: icalColor(i),
    fetchedAt: f.fetchedAt,
    status: busy.includes(f.id) ? 'loading' : errors[f.id] ? 'error' : f.ics ? 'ok' : 'loading',
    error: errors[f.id] ?? null,
  }));

  const add = useCallback((url: string) => {
    const clean = url.trim();
    if (!clean) return;
    setLastError(null);
    setFeeds((list) => (
      list.length >= MAX_FEEDS || list.some((f) => f.url === clean)
        ? list
        : [...list, { id: newId(), url: clean, ics: '', fetchedAt: 0 }]
    ));
  }, [setFeeds]);

  const remove = useCallback((id: string) => {
    setErrors(without(id));
    setLastError(null);
    setFeeds((list) => list.filter((f) => f.id !== id));
  }, [setFeeds]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return {
    calendars,
    days,
    add,
    remove,
    refresh,
    lastError,
    loading: busy.length > 0,
    full: feeds.length >= MAX_FEEDS,
  };
}
