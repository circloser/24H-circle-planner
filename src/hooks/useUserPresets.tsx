/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import type { TimeSlice } from '@/types/time-slice';
import {
  type UserPreset,
  loadUserPresets,
  saveUserPresets,
} from '@/lib/user-presets';

interface UserPresetsContextValue {
  presets: UserPreset[];
  addPreset: (name: string, slices: TimeSlice[]) => void;
  removePreset: (id: string) => void;
}

const UserPresetsContext = createContext<UserPresetsContextValue | null>(null);

export function UserPresetsProvider({ children }: { children: React.ReactNode }) {
  const [presets, setPresets] = useState<UserPreset[]>(loadUserPresets);

  useEffect(() => {
    saveUserPresets(presets);
  }, [presets]);

  const addPreset = useCallback((name: string, slices: TimeSlice[]) => {
    const preset: UserPreset = {
      id: uuid(),
      name: name.trim() || 'Untitled',
      // Detach from the live schedule's slice identities.
      slices: slices.map((s) => ({ ...s })),
      createdAt: new Date().toISOString(),
    };
    setPresets((prev) => [preset, ...prev]);
  }, []);

  const removePreset = useCallback((id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <UserPresetsContext.Provider value={{ presets, addPreset, removePreset }}>
      {children}
    </UserPresetsContext.Provider>
  );
}

/** Null-safe: returns an empty, inert store outside the provider (tests/previews). */
export function useUserPresets(): UserPresetsContextValue {
  const ctx = useContext(UserPresetsContext);
  if (!ctx) {
    return { presets: [], addPreset: () => {}, removePreset: () => {} };
  }
  return ctx;
}
