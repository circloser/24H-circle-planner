/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { usePersistedState, type PersistedCodec } from './usePersistedState';
import { cleanDecor, isTint, withDay, type DayDecor, type DecorByDate, type Tint } from '@/lib/decor';
import { LAYER_VERSION, MAX_ITEMS, cleanItem, cleanLayer, migrateDayStickers, withMonth, type LayerByMonth, type LayerItem } from '@/lib/decor-layer';
import { deletePhoto } from '@/lib/calendar-photos';

/**
 * Diary decorating (다꾸) for the calendar, in two synced stores: a highlighter
 * tint per day, and the free decoration layer (stickers, masking tape and photo
 * stickers placed anywhere on a month). Editing is a Pro feature (the surfaces
 * check that); what is already stored is always shown.
 */
export const DECOR_KEY = '24h-circle-planner.decor';
export const DECOR_LAYER_KEY = '24h-circle-planner.decor-layer';

export const decorCodec: PersistedCodec<DecorByDate> = {
  decode: (parsed) => cleanDecor(parsed),
  encode: (days) => ({ version: 1, days }),
  fallback: () => ({}),
};

export const layerCodec: PersistedCodec<LayerByMonth> = {
  decode: (parsed) => cleanLayer(parsed),
  encode: (months) => ({ version: LAYER_VERSION, months }),
  fallback: () => ({}),
};

interface DecorApi {
  decor: DecorByDate;
  dayDecor: (day: string) => DayDecor;
  setTint: (day: string, tint: Tint | null) => void;
  layer: LayerByMonth;
  /** Add an item to a month (ignored once the month is full). */
  addItem: (month: string, item: LayerItem) => boolean;
  updateItem: (month: string, id: string, patch: Partial<LayerItem>) => void;
  removeItem: (month: string, id: string) => void;
}

const Ctx = createContext<DecorApi | null>(null);

const EMPTY: DayDecor = {};

export function DecorProvider({ children }: { children: React.ReactNode }) {
  const [decor, setDecor] = usePersistedState<DecorByDate>(DECOR_KEY, decorCodec);
  const [layer, setLayer] = usePersistedState<LayerByMonth>(DECOR_LAYER_KEY, layerCodec);

  // Stickers from the first version were stamped onto days. They move onto the
  // layer, over the same corner of the same day, and leave the day store. The
  // ids are derived from the day, so a second device doing the same move (or
  // this one, after a sync brings old stickers back) never duplicates them.
  const legacy = useMemo(() => Object.entries(decor).filter(([, d]) => d.s?.length), [decor]);
  useEffect(() => {
    if (!legacy.length) return;
    const moved = migrateDayStickers(Object.fromEntries(legacy));
    setLayer((all) => {
      let next = all;
      for (const [month, items] of Object.entries(moved)) {
        next = withMonth(next, month, (have) => [
          ...have,
          ...items.filter((i) => !have.some((h) => h.id === i.id)),
        ]);
      }
      return next;
    });
    setDecor((all) => {
      let next = all;
      for (const [day] of legacy) next = withDay(next, day, (d) => ({ ...d, s: undefined }));
      return next;
    });
  }, [legacy, setDecor, setLayer]);

  const dayDecor = useCallback((day: string) => decor[day] ?? EMPTY, [decor]);

  const setTint = useCallback((day: string, tint: Tint | null) => {
    setDecor((all) => withDay(all, day, (d) => {
      const next = { ...d };
      if (tint && isTint(tint)) next.t = tint;
      else delete next.t;
      return next;
    }));
  }, [setDecor]);

  const addItem = useCallback((month: string, item: LayerItem) => {
    const clean = cleanItem(item);
    if (!clean || (layer[month]?.length ?? 0) >= MAX_ITEMS) return false;
    setLayer((all) => withMonth(all, month, (items) => [...items, clean]));
    return true;
  }, [layer, setLayer]);

  const updateItem = useCallback((month: string, id: string, patch: Partial<LayerItem>) => {
    setLayer((all) => withMonth(all, month, (items) => items.map((i) => {
      if (i.id !== id) return i;
      return cleanItem({ ...i, ...patch, id: i.id, k: i.k }) ?? i;
    })));
  }, [setLayer]);

  const removeItem = useCallback((month: string, id: string) => {
    setLayer((all) => {
      const gone = all[month]?.find((i) => i.id === id);
      const next = withMonth(all, month, (items) => items.filter((i) => i.id !== id));
      // A picture no other sticker shows is removed from this device too.
      if (gone?.ph && !Object.values(next).some((items) => items.some((i) => i.ph === gone.ph))) {
        void deletePhoto(gone.ph);
      }
      return next;
    });
  }, [setLayer]);

  const api = useMemo(
    () => ({ decor, dayDecor, setTint, layer, addItem, updateItem, removeItem }),
    [decor, dayDecor, setTint, layer, addItem, updateItem, removeItem],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useDecor(): DecorApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDecor must be used within DecorProvider');
  return ctx;
}
