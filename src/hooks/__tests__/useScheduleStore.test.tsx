import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ScheduleStoreProvider, useStoreSelector, useStoreDispatch, useSliceSelector } from '../useScheduleStore';
import type { Schedule } from '@/types/schedule';
import type { TimeSlice } from '@/types/time-slice';
import type { Preset } from '@/types/preset';
import { v4 as uuid } from 'uuid';
import { PRESETS } from '@/data/presets';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// localStorage mock
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSlice(startTime: string, endTime: string, overrides: Partial<TimeSlice> = {}): TimeSlice {
  return {
    id: uuid(),
    label: 'Test',
    startTime,
    endTime,
    color: '#3B82F6',
    icon: '',
    textPosition: 'inside',
    ...overrides,
  };
}

function makeSchedule(slices: TimeSlice[], overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: uuid(),
    version: 1,
    name: '테스트',
    slices,
    updatedAt: new Date().toISOString(),
    presetSource: null,
    ...overrides,
  };
}

function makePreset(slices: TimeSlice[], overrides: Partial<Preset> = {}): Preset {
  return {
    name: '테스트 프리셋',
    description: '설명',
    slices,
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <ScheduleStoreProvider>{children}</ScheduleStoreProvider>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ScheduleStoreProvider', () => {
  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── LOAD_PRESET ────────────────────────────────────────────────────────────

  describe('LOAD_PRESET', () => {
    it('stamps presetSource on loaded preset', () => {
      const slices = [
        makeSlice('00:00', '12:00'),
        makeSlice('12:00', '00:00'),
      ];
      const preset = makePreset(slices, { name: 'Morning Routine' });

      const { result } = renderHook(
        () => ({
          present: useStoreSelector((s) => s.history.present),
          dispatch: useStoreDispatch(),
        }),
        { wrapper },
      );

      act(() => {
        result.current.dispatch({
          type: 'LOAD_PRESET',
          preset,
          presetName: 'morning-routine',
        });
      });

      expect(result.current.present.presetSource).toBe('morning-routine');
      expect(result.current.present.slices).toHaveLength(2);
    });

    it('regenerates UUIDs for preset slices', () => {
      const originalId = uuid();
      const slices = [
        makeSlice('00:00', '12:00', { id: originalId }),
        makeSlice('12:00', '00:00'),
      ];
      const preset = makePreset(slices);

      const { result } = renderHook(
        () => ({
          present: useStoreSelector((s) => s.history.present),
          dispatch: useStoreDispatch(),
        }),
        { wrapper },
      );

      act(() => {
        result.current.dispatch({ type: 'LOAD_PRESET', preset, presetName: 'test' });
      });

      const newIds = result.current.present.slices.map((s) => s.id);
      expect(newIds).not.toContain(originalId);
    });
  });

  // ─── presetSource clearing (F4) ─────────────────────────────────────────────

  describe('F4: presetSource clearing', () => {
    it('clears presetSource on first effectful mutation', () => {
      const slices = [
        makeSlice('00:00', '12:00'),
        makeSlice('12:00', '00:00'),
      ];
      const preset = makePreset(slices);

      const { result } = renderHook(
        () => ({
          present: useStoreSelector((s) => s.history.present),
          dispatch: useStoreDispatch(),
        }),
        { wrapper },
      );

      // Load preset
      act(() => {
        result.current.dispatch({ type: 'LOAD_PRESET', preset, presetName: 'morning' });
      });
      expect(result.current.present.presetSource).toBe('morning');

      // Mutate a slice label
      const sliceId = result.current.present.slices[0].id;
      act(() => {
        result.current.dispatch({
          type: 'REPLACE_SLICE',
          id: sliceId,
          patch: { label: '아침' },
        });
      });

      expect(result.current.present.presetSource).toBeNull();
    });

    it('does not clear presetSource on no-op REPLACE_SLICE (same values)', () => {
      const slices = [
        makeSlice('00:00', '12:00', { label: 'same', color: '#FF0000' }),
        makeSlice('12:00', '00:00'),
      ];
      const preset = makePreset(slices);

      const { result } = renderHook(
        () => ({
          present: useStoreSelector((s) => s.history.present),
          dispatch: useStoreDispatch(),
        }),
        { wrapper },
      );

      act(() => {
        result.current.dispatch({ type: 'LOAD_PRESET', preset, presetName: 'morning' });
      });

      const sliceId = result.current.present.slices[0].id;
      const currentLabel = result.current.present.slices[0].label;
      const currentColor = result.current.present.slices[0].color;

      // Patch with same values
      act(() => {
        result.current.dispatch({
          type: 'REPLACE_SLICE',
          id: sliceId,
          patch: { label: currentLabel, color: currentColor },
        });
      });

      // presetSource should still be set (no effective change)
      expect(result.current.present.presetSource).toBe('morning');
    });
  });

  // ─── UNDO/REDO ───────────────────────────────────────────────────────────────

  describe('UNDO/REDO', () => {
    it('undo traverses history correctly', () => {
      const { result } = renderHook(
        () => ({
          present: useStoreSelector((s) => s.history.present),
          dispatch: useStoreDispatch(),
        }),
        { wrapper },
      );

      // Load a known schedule
      const initial = makeSchedule([
        makeSlice('00:00', '12:00', { label: 'A' }),
        makeSlice('12:00', '00:00', { label: 'B' }),
      ]);
      act(() => {
        result.current.dispatch({ type: 'LOAD_SCHEDULE', schedule: initial });
      });

      const firstSliceId = result.current.present.slices[0].id;

      // Mutate
      act(() => {
        result.current.dispatch({
          type: 'REPLACE_SLICE',
          id: firstSliceId,
          patch: { label: 'Morning' },
        });
      });
      expect(result.current.present.slices[0].label).toBe('Morning');

      // Undo
      act(() => {
        result.current.dispatch({ type: 'UNDO' });
      });
      expect(result.current.present.slices[0].label).toBe('A');
    });

    it('redo restores the undone state', () => {
      const { result } = renderHook(
        () => ({
          present: useStoreSelector((s) => s.history.present),
          dispatch: useStoreDispatch(),
        }),
        { wrapper },
      );

      const initial = makeSchedule([
        makeSlice('00:00', '12:00', { label: 'A' }),
        makeSlice('12:00', '00:00', { label: 'B' }),
      ]);
      act(() => {
        result.current.dispatch({ type: 'LOAD_SCHEDULE', schedule: initial });
      });

      const firstSliceId = result.current.present.slices[0].id;

      act(() => {
        result.current.dispatch({ type: 'REPLACE_SLICE', id: firstSliceId, patch: { label: 'Morning' } });
      });
      act(() => {
        result.current.dispatch({ type: 'UNDO' });
      });
      act(() => {
        result.current.dispatch({ type: 'REDO' });
      });
      expect(result.current.present.slices[0].label).toBe('Morning');
    });

    it('UNDO is a no-op when history is empty', () => {
      const { result } = renderHook(
        () => ({
          past: useStoreSelector((s) => s.history.past),
          dispatch: useStoreDispatch(),
        }),
        { wrapper },
      );

      // Wait for initial load effect to settle
      act(() => { vi.runAllTimers(); });

      act(() => {
        result.current.dispatch({ type: 'UNDO' });
      });
      // Should not throw; past remains empty (may have 0 or 1 entry from LOAD_SCHEDULE effect)
      expect(result.current.past.length).toBeLessThanOrEqual(1);
    });

    it('caps past entries at HISTORY_DEPTH (20)', () => {
      const { result } = renderHook(
        () => ({
          past: useStoreSelector((s) => s.history.past),
          present: useStoreSelector((s) => s.history.present),
          dispatch: useStoreDispatch(),
        }),
        { wrapper },
      );

      const initial = makeSchedule([
        makeSlice('00:00', '12:00', { label: 'A' }),
        makeSlice('12:00', '00:00', { label: 'B' }),
      ]);
      act(() => {
        result.current.dispatch({ type: 'LOAD_SCHEDULE', schedule: initial });
      });

      const sliceId = result.current.present.slices[0].id;

      // Perform 25 mutations
      for (let i = 0; i < 25; i++) {
        act(() => {
          result.current.dispatch({
            type: 'REPLACE_SLICE',
            id: sliceId,
            patch: { label: `Label ${i}` },
          });
        });
      }

      expect(result.current.past.length).toBeLessThanOrEqual(20);
    });
  });

  // ─── ContiguityError handling ────────────────────────────────────────────────

  describe('ContiguityError handling', () => {
    it('reverts state when ContiguityError is thrown', async () => {
      const { toast } = await import('sonner');

      const { result } = renderHook(
        () => ({
          present: useStoreSelector((s) => s.history.present),
          dispatch: useStoreDispatch(),
        }),
        { wrapper },
      );

      const initial = makeSchedule([
        makeSlice('00:00', '12:00', { label: 'A' }),
        makeSlice('12:00', '00:00', { label: 'B' }),
      ]);
      act(() => {
        result.current.dispatch({ type: 'LOAD_SCHEDULE', schedule: initial });
      });

      const presentBefore = result.current.present;

      // Trigger a SPLIT that creates <10-min slices: split at boundary of a 10-min slice
      // The initial schedule has 00:00–12:00. Split at 00:00 → left width=0 → throws
      act(() => {
        result.current.dispatch({ type: 'SPLIT', hhmm: '00:00' });
      });

      // State should revert
      expect(result.current.present.id).toBe(presentBefore.id);

      // Toast should eventually be called
      act(() => { vi.runAllTimers(); });
      expect(toast.error).toHaveBeenCalled();
    });
  });

  // ─── LOAD_PRESET with real PRESETS data (T6 integration) ───────────────────

  describe('LOAD_PRESET integration with PRESETS[0] (학생)', () => {
    it('loads 학생 preset: correct presetSource, slice count, and fresh UUIDs', () => {
      const preset = PRESETS[0]; // 학생

      const { result } = renderHook(
        () => ({
          present: useStoreSelector((s) => s.history.present),
          dispatch: useStoreDispatch(),
        }),
        { wrapper },
      );

      act(() => {
        result.current.dispatch({ type: 'LOAD_PRESET', preset, presetName: '학생' });
      });

      const { present } = result.current;
      expect(present.presetSource).toBe('학생');
      expect(present.slices).toHaveLength(10);

      // All ids must be valid UUIDs (not preset-prefixed strings)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const slice of present.slices) {
        expect(uuidRe.test(slice.id), `slice.id "${slice.id}" is not a uuid`).toBe(true);
      }
    });

    it('F4: dispatching REPLACE_SLICE after loading 학생 preset clears presetSource', () => {
      const preset = PRESETS[0]; // 학생

      const { result } = renderHook(
        () => ({
          present: useStoreSelector((s) => s.history.present),
          dispatch: useStoreDispatch(),
        }),
        { wrapper },
      );

      act(() => {
        result.current.dispatch({ type: 'LOAD_PRESET', preset, presetName: '학생' });
      });
      expect(result.current.present.presetSource).toBe('학생');

      const sliceId = result.current.present.slices[0].id;
      act(() => {
        result.current.dispatch({
          type: 'REPLACE_SLICE',
          id: sliceId,
          patch: { label: '다른 라벨' },
        });
      });

      expect(result.current.present.presetSource).toBeNull();
    });
  });

  // ─── useSliceSelector ────────────────────────────────────────────────────────

  describe('useSliceSelector', () => {
    it('returns present slice when not dragging', () => {
      const sliceId = uuid();
      const initial = makeSchedule([
        makeSlice('00:00', '12:00', { id: sliceId, label: 'Present' }),
        makeSlice('12:00', '00:00'),
      ]);

      const { result } = renderHook(
        () => ({
          slice: useSliceSelector(sliceId),
          dispatch: useStoreDispatch(),
        }),
        { wrapper },
      );

      act(() => {
        result.current.dispatch({ type: 'LOAD_SCHEDULE', schedule: initial });
      });

      expect(result.current.slice?.label).toBe('Present');
    });

    it('returns snapshot slice when dragging and slice is affected', () => {
      const sliceId = uuid();
      const presentSlice = makeSlice('00:00', '12:00', { id: sliceId, label: 'Present' });
      const snapshotSlice = makeSlice('00:00', '10:00', { id: sliceId, label: 'Snapshot' });
      const initial = makeSchedule([
        presentSlice,
        makeSlice('12:00', '00:00'),
      ]);

      const snapshotSchedule = makeSchedule([
        snapshotSlice,
        makeSlice('10:00', '00:00'),
      ]);

      const { result } = renderHook(
        () => ({
          slice: useSliceSelector(sliceId),
          dispatch: useStoreDispatch(),
        }),
        { wrapper },
      );

      act(() => {
        result.current.dispatch({ type: 'LOAD_SCHEDULE', schedule: initial });
      });

      act(() => {
        result.current.dispatch({ type: 'SET_IS_DRAGGING_BOUNDARY', value: true });
        result.current.dispatch({
          type: 'SET_DRAG_REF',
          value: {
            snapshot: snapshotSchedule,
            boundaryIndex: 0,
            affectedSliceIds: new Set([sliceId]),
            originalSlicePaths: {},
          },
        });
      });

      expect(result.current.slice?.label).toBe('Snapshot');
    });

    it('returns present slice when dragging but slice is NOT affected', () => {
      const affectedId = uuid();
      const unaffectedId = uuid();
      const initial = makeSchedule([
        makeSlice('00:00', '12:00', { id: affectedId, label: 'Affected' }),
        makeSlice('12:00', '00:00', { id: unaffectedId, label: 'Unaffected' }),
      ]);

      const snapshotSchedule = makeSchedule([
        makeSlice('00:00', '10:00', { id: affectedId, label: 'Snapshot' }),
        makeSlice('10:00', '00:00', { id: unaffectedId, label: 'Unaffected Snapshot' }),
      ]);

      const { result } = renderHook(
        () => ({
          slice: useSliceSelector(unaffectedId),
          dispatch: useStoreDispatch(),
        }),
        { wrapper },
      );

      act(() => {
        result.current.dispatch({ type: 'LOAD_SCHEDULE', schedule: initial });
      });

      act(() => {
        result.current.dispatch({ type: 'SET_IS_DRAGGING_BOUNDARY', value: true });
        result.current.dispatch({
          type: 'SET_DRAG_REF',
          value: {
            snapshot: snapshotSchedule,
            boundaryIndex: 0,
            affectedSliceIds: new Set([affectedId]), // unaffectedId NOT in set
            originalSlicePaths: {},
          },
        });
      });

      // Should return present value, not snapshot
      expect(result.current.slice?.label).toBe('Unaffected');
    });
  });
});
