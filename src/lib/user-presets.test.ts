import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadUserPresets,
  saveUserPresets,
  STORAGE_KEY_USER_PRESETS,
  type UserPreset,
} from './user-presets';
import type { TimeSlice } from '@/types/time-slice';

const slice: TimeSlice = {
  id: 's1',
  label: 'Work',
  startTime: '09:00',
  endTime: '18:00',
  color: '#bfdbfe',
  icon: '',
  textPosition: 'inside',
};

const preset: UserPreset = {
  id: 'p1',
  name: 'My routine',
  slices: [slice],
  createdAt: '2026-06-21T00:00:00.000Z',
};

describe('user-presets storage', () => {
  beforeEach(() => localStorage.clear());

  it('returns [] when nothing is stored', () => {
    expect(loadUserPresets()).toEqual([]);
  });

  it('round-trips a preset through save/load', () => {
    saveUserPresets([preset]);
    const loaded = loadUserPresets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(preset);
  });

  it('ignores corrupt / wrong-version envelopes', () => {
    localStorage.setItem(STORAGE_KEY_USER_PRESETS, '{ not json');
    expect(loadUserPresets()).toEqual([]);
    localStorage.setItem(STORAGE_KEY_USER_PRESETS, JSON.stringify({ version: 2, presets: [preset] }));
    expect(loadUserPresets()).toEqual([]);
  });

  it('filters out malformed preset entries', () => {
    localStorage.setItem(
      STORAGE_KEY_USER_PRESETS,
      JSON.stringify({ version: 1, presets: [preset, { id: 5 }, null] }),
    );
    expect(loadUserPresets()).toEqual([preset]);
  });
});
