/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo } from 'react';
import { usePersistedState, type PersistedCodec } from './usePersistedState';
import { MAX_STICKERS, cleanDecor, isSticker, isTint, withDay, type DayDecor, type DecorByDate, type Tint } from '@/lib/decor';

/**
 * Diary decorating (다꾸) for calendar days: stickers and a highlighter tint.
 * Its own store, synced like the plans themselves. Editing is a Pro feature
 * (the surfaces check that); what is already stored is always shown.
 */
export const DECOR_KEY = '24h-circle-planner.decor';

export const decorCodec: PersistedCodec<DecorByDate> = {
  decode: (parsed) => cleanDecor(parsed),
  encode: (days) => ({ version: 1, days }),
  fallback: () => ({}),
};

interface DecorApi {
  decor: DecorByDate;
  dayDecor: (day: string) => DayDecor;
  addSticker: (day: string, id: string) => void;
  /** Remove the sticker at this position (the same one may be stamped twice). */
  removeSticker: (day: string, index: number) => void;
  setTint: (day: string, tint: Tint | null) => void;
}

const Ctx = createContext<DecorApi | null>(null);

const EMPTY: DayDecor = {};

export function DecorProvider({ children }: { children: React.ReactNode }) {
  const [decor, setDecor] = usePersistedState<DecorByDate>(DECOR_KEY, decorCodec);

  const dayDecor = useCallback((day: string) => decor[day] ?? EMPTY, [decor]);

  const addSticker = useCallback((day: string, id: string) => {
    if (!isSticker(id)) return;
    setDecor((all) => withDay(all, day, (d) => {
      const s = d.s ?? [];
      return s.length >= MAX_STICKERS ? d : { ...d, s: [...s, id] };
    }));
  }, [setDecor]);

  const removeSticker = useCallback((day: string, index: number) => {
    setDecor((all) => withDay(all, day, (d) => ({ ...d, s: (d.s ?? []).filter((_, i) => i !== index) })));
  }, [setDecor]);

  const setTint = useCallback((day: string, tint: Tint | null) => {
    setDecor((all) => withDay(all, day, (d) => {
      const next = { ...d };
      if (tint && isTint(tint)) next.t = tint;
      else delete next.t;
      return next;
    }));
  }, [setDecor]);

  const api = useMemo(
    () => ({ decor, dayDecor, addSticker, removeSticker, setTint }),
    [decor, dayDecor, addSticker, removeSticker, setTint],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useDecor(): DecorApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDecor must be used within DecorProvider');
  return ctx;
}
