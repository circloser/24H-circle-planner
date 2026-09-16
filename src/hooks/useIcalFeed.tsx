import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePersistedState } from './usePersistedState';
import { icalDays, parseIcs, type IcalDayEvent } from '@/lib/ical';

/**
 * A read-only Google Calendar, pulled from its private iCal address (Pro).
 *
 * The address is a bearer secret: anyone holding it can read that calendar. So
 * it stays on THIS device — a plain localStorage key that is deliberately NOT
 * in SYNC_KEYS, so it never reaches our server's storage, and the user pastes
 * it once per device. The feed itself is fetched through our Worker (Google
 * sends no CORS headers) and the text is cached here so opening the calendar
 * offline still shows what was last seen.
 */
const KEY = '24h-circle-planner.ical';
/** Refetch when the cached copy is older than this. */
const STALE_MS = 30 * 60 * 1000;
/** Feeds bigger than this are shown but not cached (localStorage is small). */
const MAX_CACHE = 300_000;

export interface IcalState {
  url: string;
  ics: string;
  fetchedAt: number;
}

export type IcalStatus = 'idle' | 'loading' | 'ok' | 'error';

const EMPTY: IcalState = { url: '', ics: '', fetchedAt: 0 };

const codec = {
  decode: (parsed: unknown): IcalState | null => {
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    return {
      url: typeof o.url === 'string' ? o.url : '',
      ics: typeof o.ics === 'string' ? o.ics : '',
      fetchedAt: typeof o.fetchedAt === 'number' ? o.fetchedAt : 0,
    };
  },
  encode: (v: IcalState) => ({ url: v.url, ics: v.ics.length > MAX_CACHE ? '' : v.ics, fetchedAt: v.fetchedAt }),
  fallback: () => EMPTY,
};

/** Reasons worth telling the user apart; anything else is just "failed". */
export type IcalError = 'pro_required' | 'unauthorized' | 'bad_url' | 'feed_not_found' | 'failed';

export interface IcalFeed {
  url: string;
  fetchedAt: number;
  status: IcalStatus;
  error: IcalError | null;
  /** Imported occurrences for a window, keyed by day. */
  days: (from: string, to: string) => Record<string, IcalDayEvent[]>;
  connect: (url: string) => void;
  disconnect: () => void;
  refresh: () => void;
}

export function useIcalFeed(): IcalFeed {
  const [state, setState] = usePersistedState<IcalState>(KEY, codec);
  /** Set only from the fetch itself; the status below is derived from it. */
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<IcalError | null>(null);
  const [nonce, setNonce] = useState(0);
  const busy = useRef(false);

  const url = state.url;

  useEffect(() => {
    if (!url) return;
    const fresh = state.fetchedAt > Date.now() - STALE_MS && !!state.ics;
    if (fresh && nonce === 0) return;
    if (busy.current) return;

    busy.current = true;
    let live = true;
    const run = async () => {
      setPending(true);
      setError(null);
      try {
        const res = await fetch(`/api/ical?url=${encodeURIComponent(url)}`, { credentials: 'include' });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          const known: IcalError[] = ['pro_required', 'unauthorized', 'bad_url', 'feed_not_found'];
          if (live) setError(known.find((k) => k === body.error) ?? 'failed');
          return;
        }
        const ics = await res.text();
        if (live) setState((s) => ({ ...s, ics, fetchedAt: Date.now() }));
      } catch {
        if (live) setError('failed');
      } finally {
        busy.current = false;
        if (live) setPending(false);
      }
    };
    void run();
    return () => { live = false; };
    // `state.ics`/`state.fetchedAt` are read as a freshness hint only; listing
    // them would refetch on every write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, nonce, setState]);

  const status: IcalStatus = !url ? 'idle' : pending ? 'loading' : error ? 'error' : state.ics ? 'ok' : 'loading';

  const events = useMemo(() => (state.ics ? parseIcs(state.ics) : []), [state.ics]);
  const days = useCallback(
    (from: string, to: string) => (events.length ? icalDays(events, from, to) : {}),
    [events],
  );

  const connect = useCallback((next: string) => {
    setError(null);
    setState({ url: next.trim(), ics: '', fetchedAt: 0 });
    setNonce((n) => n + 1);
  }, [setState]);
  const disconnect = useCallback(() => {
    setError(null);
    setState(EMPTY);
    setNonce(0);
  }, [setState]);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { url, fetchedAt: state.fetchedAt, status, error, days, connect, disconnect, refresh };
}
