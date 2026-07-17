/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { usePersistedState, type PersistedCodec } from '@/hooks/usePersistedState';

/**
 * Time palette — user-defined recurring items (label + colour + icon) managed
 * from the Design menu and applied with one tap in the slice editor, so the
 * things you enter every day ("수면", "오전 업무", …) keep a consistent colour
 * and take one click to fill in.
 *
 * Synced across devices (key is in SYNC_KEYS, protected by keep-if-absent so an
 * old cloud blob can never wipe a palette).
 */

export interface PaletteItem {
  id: string;
  label: string;
  color: string; // hex fill, same space as TimeSlice.color
  icon: string; // emoji ('' = none)
}

export const PALETTE_KEY = '24h-circle-planner.palette';
/** More than this and the picker chips become soup; add() no-ops at the cap. */
export const MAX_PALETTE_ITEMS = 20;

interface PaletteEnvelope {
  version: 1;
  items: PaletteItem[];
}

/** Storage envelope `{version: 1, items}` — decode→encode is byte-stable so a
 *  load/save round-trip never registers as a sync change. */
const paletteCodec: PersistedCodec<PaletteItem[]> = {
  decode: (parsed) => {
    const p = parsed as PaletteEnvelope | null;
    if (p && p.version === 1 && Array.isArray(p.items)) {
      return p.items
        .filter((i) => i && typeof i === 'object' && typeof i.label === 'string' && typeof i.color === 'string')
        .map((i) => ({
          id: typeof i.id === 'string' ? i.id : uuid(),
          label: i.label,
          color: i.color,
          icon: typeof i.icon === 'string' ? i.icon : '',
        }));
    }
    return null;
  },
  encode: (items) => ({ version: 1, items }),
  fallback: () => [],
};

interface TimePaletteContextValue {
  items: PaletteItem[];
  /** Add an item (no-op at the cap or on an empty label). Returns success. */
  addItem: (item: Omit<PaletteItem, 'id'>) => boolean;
  updateItem: (id: string, patch: Partial<Omit<PaletteItem, 'id'>>) => void;
  removeItem: (id: string) => void;
}

const TimePaletteContext = createContext<TimePaletteContextValue | null>(null);

export function TimePaletteProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = usePersistedState<PaletteItem[]>(PALETTE_KEY, paletteCodec);

  const addItem = useCallback(
    (item: Omit<PaletteItem, 'id'>): boolean => {
      const label = item.label.trim();
      if (!label) return false;
      let ok = false;
      setItems((prev) => {
        if (prev.length >= MAX_PALETTE_ITEMS) return prev;
        ok = true;
        return [...prev, { id: uuid(), label, color: item.color, icon: item.icon }];
      });
      return ok;
    },
    [setItems],
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<Omit<PaletteItem, 'id'>>) => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    },
    [setItems],
  );

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    },
    [setItems],
  );

  return (
    <TimePaletteContext.Provider value={{ items, addItem, updateItem, removeItem }}>
      {children}
    </TimePaletteContext.Provider>
  );
}

/** Consume the palette. Safe without a provider (empty, no-op — e.g. tests). */
export function useTimePalette(): TimePaletteContextValue {
  const ctx = useContext(TimePaletteContext);
  if (ctx) return ctx;
  return { items: [], addItem: () => false, updateItem: () => {}, removeItem: () => {} };
}
