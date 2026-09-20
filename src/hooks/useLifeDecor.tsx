import { useCallback, useMemo } from 'react';
import { usePersistedState, type PersistedCodec } from './usePersistedState';
import { cleanItem, MAX_ITEMS, type LayerItem } from '@/lib/decor-layer';
import { deletePhoto } from '@/lib/calendar-photos';
import {
  LIFE_DECOR_KEY, MAX_PER_ROW, cleanLifeDecor, encodeLifeDecor, withRow, type LifeDecor,
} from '@/lib/life-decor';
import type { DecorStore } from './useDecor';

export const lifeDecorCodec: PersistedCodec<LifeDecor> = {
  decode: (parsed) => cleanLifeDecor(parsed),
  encode: (rows) => encodeLifeDecor(rows),
  fallback: () => ({}),
};

/**
 * Decorations on the life line, kept in their own store (the calendar's is
 * keyed by month; this one by row) and shaped like the shared DecorStore, so
 * the calendar's tray and its editing serve the line unchanged.
 */
export interface LifeDecorStore extends DecorStore {
  rows: LifeDecor;
  /** Hand a decoration to another row (dropped over it). */
  moveItem: (from: string, to: string, id: string, patch: Partial<LayerItem>) => void;
  replaceAll: (next: LifeDecor) => void;
}

export function useLifeDecor(): LifeDecorStore {
  const [rows, setRows] = usePersistedState<LifeDecor>(LIFE_DECOR_KEY, lifeDecorCodec);

  const addItem = useCallback((row: string, item: LayerItem) => {
    const clean = cleanItem(item);
    if (!clean || (rows[row]?.length ?? 0) >= MAX_PER_ROW) return false;
    setRows((all) => withRow(all, row, (items) => [...items, clean]));
    return true;
  }, [rows, setRows]);

  const updateItem = useCallback((row: string, id: string, patch: Partial<LayerItem>) => {
    setRows((all) => withRow(all, row, (items) => items.map((i) => (
      i.id === id ? cleanItem({ ...i, ...patch, id: i.id, k: i.k }) ?? i : i
    ))));
  }, [setRows]);

  const removeItem = useCallback((row: string, id: string) => {
    setRows((all) => {
      const gone = all[row]?.find((i) => i.id === id);
      const next = withRow(all, row, (items) => items.filter((i) => i.id !== id));
      // A picture no other decoration shows leaves this device too.
      if (gone?.ph && !Object.values(next).some((items) => items.some((i) => i.ph === gone.ph))) {
        void deletePhoto(gone.ph);
      }
      return next;
    });
  }, [setRows]);

  /** One item may move to another row: it is dropped and re-added in one go. */
  const moveItem = useCallback((from: string, to: string, id: string, patch: Partial<LayerItem>) => {
    setRows((all) => {
      const item = all[from]?.find((i) => i.id === id);
      if (!item || (all[to]?.length ?? 0) >= MAX_PER_ROW) return all;
      const moved = cleanItem({ ...item, ...patch }) ?? item;
      return withRow(withRow(all, from, (items) => items.filter((i) => i.id !== id)), to, (items) => [...items, moved]);
    });
  }, [setRows]);

  /** A restored backup brings its decorations with it. */
  const replaceAll = useCallback((next: LifeDecor) => setRows(next), [setRows]);

  return useMemo(
    () => ({ rows, layer: rows, addItem, updateItem, removeItem, moveItem, replaceAll }),
    [rows, addItem, updateItem, removeItem, moveItem, replaceAll],
  );
}

/** The calendar's per-month cap, for the tray's "full" message. */
export const LIFE_ROW_CAP = Math.min(MAX_PER_ROW, MAX_ITEMS);
