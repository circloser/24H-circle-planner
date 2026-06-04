import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  ScheduleStoreProvider,
  useStoreSelector,
  useStoreDispatch,
} from '../useScheduleStore';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';
import type { TimeSlice } from '@/types/time-slice';
import type { Schedule } from '@/types/schedule';
import type { DragRef } from '@/types/drag';
import { v4 as uuid } from 'uuid';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: storageMock, writable: true });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSlice(startTime: string, endTime: string, id = uuid()): TimeSlice {
  return { id, label: 'Test', startTime, endTime, color: '#3B82F6', icon: '', textPosition: 'inside' };
}

function makeSchedule(slices: TimeSlice[]): Schedule {
  return { id: uuid(), version: 1, name: 'Test', slices, updatedAt: new Date().toISOString(), presetSource: null };
}

function wrapper({ children }: { children: ReactNode }) {
  return <ScheduleStoreProvider>{children}</ScheduleStoreProvider>;
}

function fireCtrZ(shift = false) {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: shift, bubbles: true }),
  );
}

function fireCtrlY() {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, shiftKey: false, bubbles: true }),
  );
}

function fireEscape() {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  );
}

/**
 * Build a mock SVGGElement whose querySelectorAll('[data-slice-id]')
 * returns path-like objects with setAttribute spies, matching the given originalSlicePaths.
 */
function makeMockGroup(originalSlicePaths: Record<string, string>) {
  const setAttributeSpies: Record<string, ReturnType<typeof vi.fn>> = {};

  const elements = Object.entries(originalSlicePaths).map(([id, d]) => {
    const spy = vi.fn();
    setAttributeSpies[id] = spy;
    return {
      getAttribute: vi.fn((attr: string) => attr === 'data-slice-id' ? id : d),
      setAttribute: spy,
    };
  });

  const mockGroup = {
    querySelectorAll: vi.fn((selector: string) => {
      if (selector === '[data-slice-id]') return elements;
      return [];
    }),
    querySelector: vi.fn((selector: string) => {
      const match = selector.match(/\[data-slice-id="([^"]+)"\]/);
      if (match) return elements.find((el) => el.getAttribute('data-slice-id') === match[1]) ?? null;
      return null;
    }),
  } as unknown as SVGGElement;

  return { mockGroup, setAttributeSpies };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Ctrl+Z while NOT dragging dispatches UNDO', async () => {
    const slices = [makeSlice('00:00', '06:00'), makeSlice('06:00', '12:00'), makeSlice('12:00', '00:00')];
    const schedule = makeSchedule(slices);

    const { result } = renderHook(
      () => {
        const liveDragGroupRef = { current: null } as React.RefObject<SVGGElement | null>;
        useKeyboardShortcuts({ liveDragGroupRef });
        const dispatch = useStoreDispatch();
        const past = useStoreSelector((s) => s.history.past);
        const present = useStoreSelector((s) => s.history.present);
        return { dispatch, past, present };
      },
      { wrapper },
    );

    // Load schedule and make a change to create undo history
    act(() => {
      result.current.dispatch({ type: 'LOAD_SCHEDULE', schedule });
    });
    act(() => {
      result.current.dispatch({ type: 'SPLIT', hhmm: '03:00' });
    });

    expect(result.current.past.length).toBeGreaterThan(0);
    const presentBeforeUndo = result.current.present;

    // Fire Ctrl+Z
    act(() => {
      fireCtrZ(false);
    });

    // Should have undone the split
    expect(result.current.present).not.toEqual(presentBeforeUndo);
    expect(result.current.present.slices.length).toBe(slices.length);
  });

  it('Ctrl+Shift+Z while NOT dragging dispatches REDO', async () => {
    const slices = [makeSlice('00:00', '12:00'), makeSlice('12:00', '00:00')];
    const schedule = makeSchedule(slices);

    const { result } = renderHook(
      () => {
        const liveDragGroupRef = { current: null } as React.RefObject<SVGGElement | null>;
        useKeyboardShortcuts({ liveDragGroupRef });
        const dispatch = useStoreDispatch();
        const future = useStoreSelector((s) => s.history.future);
        const present = useStoreSelector((s) => s.history.present);
        return { dispatch, future, present };
      },
      { wrapper },
    );

    act(() => {
      result.current.dispatch({ type: 'LOAD_SCHEDULE', schedule });
    });
    act(() => {
      result.current.dispatch({ type: 'SPLIT', hhmm: '06:00' });
    });
    // Undo to get something in future
    act(() => {
      result.current.dispatch({ type: 'UNDO' });
    });

    expect(result.current.future.length).toBeGreaterThan(0);
    const presentBeforeRedo = result.current.present;

    // Fire Ctrl+Shift+Z
    act(() => {
      fireCtrZ(true);
    });

    expect(result.current.present).not.toEqual(presentBeforeRedo);
  });

  it('Ctrl+Y while NOT dragging dispatches REDO', async () => {
    const slices = [makeSlice('00:00', '12:00'), makeSlice('12:00', '00:00')];
    const schedule = makeSchedule(slices);

    const { result } = renderHook(
      () => {
        const liveDragGroupRef = { current: null } as React.RefObject<SVGGElement | null>;
        useKeyboardShortcuts({ liveDragGroupRef });
        const dispatch = useStoreDispatch();
        const future = useStoreSelector((s) => s.history.future);
        const present = useStoreSelector((s) => s.history.present);
        return { dispatch, future, present };
      },
      { wrapper },
    );

    act(() => {
      result.current.dispatch({ type: 'LOAD_SCHEDULE', schedule });
    });
    act(() => {
      result.current.dispatch({ type: 'SPLIT', hhmm: '06:00' });
    });
    act(() => {
      result.current.dispatch({ type: 'UNDO' });
    });

    expect(result.current.future.length).toBeGreaterThan(0);
    const presentBeforeRedo = result.current.present;

    act(() => {
      fireCtrlY();
    });

    expect(result.current.present).not.toEqual(presentBeforeRedo);
  });

  it('Ctrl+Z while isDraggingBoundary=true does NOT dispatch UNDO — cancels drag instead', async () => {
    const sliceA = makeSlice('00:00', '12:00');
    const sliceB = makeSlice('12:00', '00:00');
    const slices = [sliceA, sliceB];
    const schedule = makeSchedule(slices);

    const originalSlicePaths = {
      [sliceA.id]: 'M 100 100 Z',
      [sliceB.id]: 'M 200 200 Z',
    };
    const { mockGroup, setAttributeSpies } = makeMockGroup(originalSlicePaths);
    const liveDragGroupRef = { current: mockGroup } as React.RefObject<SVGGElement | null>;

    const dragRef: DragRef = {
      snapshot: schedule,
      boundaryIndex: 0,
      affectedSliceIds: new Set([sliceA.id, sliceB.id]),
      originalSlicePaths,
    };

    const { result } = renderHook(
      () => {
        useKeyboardShortcuts({ liveDragGroupRef });
        const dispatch = useStoreDispatch();
        const isDragging = useStoreSelector((s) => s.isDraggingBoundary);
        const past = useStoreSelector((s) => s.history.past);
        const present = useStoreSelector((s) => s.history.present);
        return { dispatch, isDragging, past, present };
      },
      { wrapper },
    );

    act(() => {
      result.current.dispatch({ type: 'LOAD_SCHEDULE', schedule });
    });

    // Make a change and undo to set up undo history
    act(() => {
      result.current.dispatch({ type: 'SPLIT', hhmm: '06:00' });
    });

    // Enter drag state
    act(() => {
      result.current.dispatch({ type: 'SET_DRAG_REF', value: dragRef });
      result.current.dispatch({ type: 'SET_IS_DRAGGING_BOUNDARY', value: true });
    });

    expect(result.current.isDragging).toBe(true);
    const presentBeforeCancel = result.current.present;

    // Fire Ctrl+Z — must cancel drag, NOT undo
    act(() => {
      fireCtrZ(false);
    });

    // isDraggingBoundary cleared
    expect(result.current.isDragging).toBe(false);

    // present must NOT have changed (no UNDO dispatched)
    expect(result.current.present).toEqual(presentBeforeCancel);

    // setAttribute was called to restore original paths
    const totalRestoreCalls = Object.values(setAttributeSpies).reduce(
      (sum, spy) => sum + spy.mock.calls.length, 0,
    );
    expect(totalRestoreCalls).toBeGreaterThan(0);

    // Verify the restore called setAttribute with the original d values
    expect(setAttributeSpies[sliceA.id]).toHaveBeenCalledWith('d', originalSlicePaths[sliceA.id]);
    expect(setAttributeSpies[sliceB.id]).toHaveBeenCalledWith('d', originalSlicePaths[sliceB.id]);
  });

  it('Escape while isDraggingBoundary=true cancels drag', async () => {
    const sliceA = makeSlice('00:00', '12:00');
    const sliceB = makeSlice('12:00', '00:00');
    const slices = [sliceA, sliceB];
    const schedule = makeSchedule(slices);

    const originalSlicePaths = {
      [sliceA.id]: 'M 100 100 Z',
      [sliceB.id]: 'M 200 200 Z',
    };
    const { mockGroup, setAttributeSpies } = makeMockGroup(originalSlicePaths);
    const liveDragGroupRef = { current: mockGroup } as React.RefObject<SVGGElement | null>;

    const dragRef: DragRef = {
      snapshot: schedule,
      boundaryIndex: 0,
      affectedSliceIds: new Set([sliceA.id, sliceB.id]),
      originalSlicePaths,
    };

    const { result } = renderHook(
      () => {
        useKeyboardShortcuts({ liveDragGroupRef });
        const dispatch = useStoreDispatch();
        const isDragging = useStoreSelector((s) => s.isDraggingBoundary);
        return { dispatch, isDragging };
      },
      { wrapper },
    );

    act(() => {
      result.current.dispatch({ type: 'LOAD_SCHEDULE', schedule });
      result.current.dispatch({ type: 'SET_DRAG_REF', value: dragRef });
      result.current.dispatch({ type: 'SET_IS_DRAGGING_BOUNDARY', value: true });
    });

    expect(result.current.isDragging).toBe(true);

    act(() => {
      fireEscape();
    });

    expect(result.current.isDragging).toBe(false);

    // Paths restored
    expect(setAttributeSpies[sliceA.id]).toHaveBeenCalledWith('d', originalSlicePaths[sliceA.id]);
    expect(setAttributeSpies[sliceB.id]).toHaveBeenCalledWith('d', originalSlicePaths[sliceB.id]);
  });

  it('Ctrl+Shift+Z while isDraggingBoundary=true cancels drag instead of REDO', async () => {
    const sliceA = makeSlice('00:00', '12:00');
    const sliceB = makeSlice('12:00', '00:00');
    const slices = [sliceA, sliceB];
    const schedule = makeSchedule(slices);

    const originalSlicePaths = { [sliceA.id]: 'M 1 1 Z', [sliceB.id]: 'M 2 2 Z' };
    const { mockGroup } = makeMockGroup(originalSlicePaths);
    const liveDragGroupRef = { current: mockGroup } as React.RefObject<SVGGElement | null>;

    const dragRef: DragRef = {
      snapshot: schedule,
      boundaryIndex: 0,
      affectedSliceIds: new Set([sliceA.id, sliceB.id]),
      originalSlicePaths,
    };

    const { result } = renderHook(
      () => {
        useKeyboardShortcuts({ liveDragGroupRef });
        const dispatch = useStoreDispatch();
        const isDragging = useStoreSelector((s) => s.isDraggingBoundary);
        const future = useStoreSelector((s) => s.history.future);
        return { dispatch, isDragging, future };
      },
      { wrapper },
    );

    act(() => {
      result.current.dispatch({ type: 'LOAD_SCHEDULE', schedule });
      result.current.dispatch({ type: 'SPLIT', hhmm: '06:00' });
      result.current.dispatch({ type: 'UNDO' });
      result.current.dispatch({ type: 'SET_DRAG_REF', value: dragRef });
      result.current.dispatch({ type: 'SET_IS_DRAGGING_BOUNDARY', value: true });
    });

    expect(result.current.isDragging).toBe(true);
    expect(result.current.future.length).toBeGreaterThan(0);
    const futureBefore = result.current.future;

    act(() => {
      fireCtrZ(true);
    });

    // Drag cancelled
    expect(result.current.isDragging).toBe(false);
    // REDO was NOT applied (future unchanged)
    expect(result.current.future).toEqual(futureBefore);
  });
});
