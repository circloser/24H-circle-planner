import type { TimeSlice } from '@/types/time-slice';

/**
 * User-saved presets — the current schedule captured as a reusable template that
 * appears in the preset gallery alongside the built-in lifestyle presets. Stored
 * separately from named slots (those are saved *schedules* you reload; these are
 * starting *templates* you branch from).
 */
export interface UserPreset {
  id: string;
  name: string;
  slices: TimeSlice[];
  createdAt: string; // ISO8601
}

export const STORAGE_KEY_USER_PRESETS = '24h-circle-planner.user-presets';

interface UserPresetEnvelope {
  version: 1;
  presets: UserPreset[];
}

export function loadUserPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER_PRESETS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UserPresetEnvelope;
    if (parsed && parsed.version === 1 && Array.isArray(parsed.presets)) {
      return parsed.presets.filter(
        (p) => p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.slices),
      );
    }
    return [];
  } catch {
    return [];
  }
}

export function saveUserPresets(presets: UserPreset[]): void {
  try {
    const envelope: UserPresetEnvelope = { version: 1, presets };
    localStorage.setItem(STORAGE_KEY_USER_PRESETS, JSON.stringify(envelope));
  } catch {
    // storage unavailable — presets simply won't persist
  }
}
