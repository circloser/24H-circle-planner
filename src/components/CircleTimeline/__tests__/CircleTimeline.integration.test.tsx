/**
 * C10 Integration Test — Drag Isolation Contract
 *
 * C10 success criterion: during a boundary drag, an unrelated re-render of the App tree
 * MUST NOT reconcile the dragging slice's `d` attribute back to the React-managed value.
 * The imperative setAttribute write must survive a React re-render.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { render, act } from '@testing-library/react';
import { useEffect } from 'react';
import {
  ScheduleStoreProvider,
  useStoreDispatch,
  useStoreSelector,
} from '@/hooks/useScheduleStore';
import { CircleTimeline } from '../CircleTimeline';
import { useSliceInteraction } from '@/hooks/useSliceInteraction';
import type { TimeSlice } from '@/types/time-slice';
import type { Schedule } from '@/types/schedule';
import { v4 as uuid } from 'uuid';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), warning: vi.fn() },
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

// ─── State bridge ─────────────────────────────────────────────────────────────
// Mutable container updated via useEffect (never during render) to give tests
// fresh, non-stale access to hook values.

interface StateBridge {
  isDraggingBoundary: boolean;
  triggerPointerDown: ((boundaryIndex: number, x: number, y: number) => void) | null;
  dispatch: ReturnType<typeof useStoreDispatch> | null;
  onPointerDownHandle: Mock | null;
}

const bridge: StateBridge = {
  isDraggingBoundary: false,
  triggerPointerDown: null,
  dispatch: null,
  onPointerDownHandle: null,
};

// ─── Harness components ───────────────────────────────────────────────────────

function HarnessInner({ slices }: { slices: TimeSlice[] }) {
  const { liveDragGroupRef, svgRef, handlers, isDragging } = useSliceInteraction({
    onRequestEdit: vi.fn(),
  });
  const dispatch = useStoreDispatch();

  // Update bridge in useEffect (not during render) to satisfy react-hooks rules
  useEffect(() => {
    bridge.isDraggingBoundary = isDragging;
    bridge.dispatch = dispatch;
    bridge.triggerPointerDown = (boundaryIndex: number, x: number, y: number) => {
      handlers.onPointerDownHandle(
        {
          clientX: x,
          clientY: y,
          pointerId: 99,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          target: { setPointerCapture: vi.fn() },
        } as unknown as React.PointerEvent<SVGElement>,
        boundaryIndex,
      );
    };
  });

  return (
    <CircleTimeline
      slices={slices}
      mode="interactive"
      interactionMode="interactive"
      dragGroupRef={liveDragGroupRef}
      svgRef={svgRef}
      onPointerDownHandle={handlers.onPointerDownHandle}
      onSliceDoubleClick={handlers.onSliceDoubleClick}
      onBackgroundClick={handlers.onBackgroundClick}
    />
  );
}

function LoadSchedule({ slices }: { slices: TimeSlice[] }) {
  const dispatch = useStoreDispatch();
  const currentSlices = useStoreSelector((s) => s.history.present.slices);

  useEffect(() => {
    if (currentSlices.length !== slices.length) {
      dispatch({ type: 'LOAD_SCHEDULE', schedule: makeSchedule(slices) });
    }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function TestApp({ slices }: { slices: TimeSlice[] }) {
  return (
    <ScheduleStoreProvider>
      <LoadSchedule slices={slices} />
      <HarnessInner slices={slices} />
    </ScheduleStoreProvider>
  );
}

// ─── C10 Integration Tests ────────────────────────────────────────────────────

describe('CircleTimeline C10 — drag isolation contract', () => {
  const sliceA = makeSlice('00:00', '12:00');
  const sliceB = makeSlice('12:00', '00:00');
  const twoSlices = [sliceA, sliceB];

  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
    bridge.isDraggingBoundary = false;
    bridge.dispatch = null;
    bridge.triggerPointerDown = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up any lingering pointer listeners
    act(() => {
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 99 }));
    });
  });

  it('C10: isDraggingBoundary becomes true after crossing pointer threshold', async () => {
    const { unmount } = render(<TestApp slices={twoSlices} />);

    // Wait for effects to populate bridge
    await act(async () => {});

    act(() => {
      bridge.triggerPointerDown!(0, 500, 200);
    });

    // Move pointer past 4px threshold
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 520, clientY: 220, pointerId: 99 }),
      );
    });

    // Wait for effects to sync bridge
    await act(async () => {});

    expect(bridge.isDraggingBoundary).toBe(true);

    unmount();
  });

  it('C10: imperative setAttribute writes survive an unrelated re-render', async () => {
    const { container, rerender } = render(<TestApp slices={twoSlices} />);

    await act(async () => {});

    act(() => {
      bridge.triggerPointerDown!(0, 500, 200);
    });

    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 510, clientY: 210, pointerId: 99 }),
      );
    });

    await act(async () => {});

    expect(bridge.isDraggingBoundary).toBe(true);

    // Find sliceA's path element
    const draggingPath =
      container.querySelector<SVGPathElement>(`[data-slice-id="${sliceA.id}"]`);
    expect(draggingPath).not.toBeNull();

    // Imperatively write a sentinel d — React does NOT know about this
    const sentinelD = 'M 999 999 Z SENTINEL';
    draggingPath!.setAttribute('d', sentinelD);

    const dBeforeUnrelated = draggingPath!.getAttribute('d');
    expect(dBeforeUnrelated).toBe(sentinelD);

    // Trigger an unrelated state update to force React reconciliation
    act(() => {
      if (bridge.dispatch) {
        bridge.dispatch({ type: 'LOAD_SCHEDULE', schedule: makeSchedule(twoSlices) });
      }
    });
    rerender(<TestApp slices={twoSlices} />);
    await act(async () => {});

    // C10 SUCCESS CRITERION: d must still be the sentinel after reconciliation
    const dAfterUnrelated = draggingPath!.getAttribute('d');
    expect(dAfterUnrelated).toBe(dBeforeUnrelated);

    act(() => {
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 99 }));
    });
  });

  it('C10: pointerup clears isDraggingBoundary and dragRef', async () => {
    const { unmount } = render(<TestApp slices={twoSlices} />);

    await act(async () => {});

    act(() => { bridge.triggerPointerDown!(0, 500, 200); });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 510, clientY: 210, pointerId: 99 }));
    });

    await act(async () => {});
    expect(bridge.isDraggingBoundary).toBe(true);

    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 520, clientY: 220, pointerId: 99 }));
    });

    await act(async () => {});
    expect(bridge.isDraggingBoundary).toBe(false);

    unmount();
  });

  it('C10: pointercancel restores d attributes and does not commit RESIZE_BOUNDARY', async () => {
    const { container, unmount } = render(<TestApp slices={twoSlices} />);

    await act(async () => {});

    act(() => { bridge.triggerPointerDown!(0, 500, 200); });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 510, clientY: 210, pointerId: 99 }));
    });

    await act(async () => {});
    expect(bridge.isDraggingBoundary).toBe(true);

    // Imperatively write a mid-drag sentinel
    container
      .querySelector<SVGPathElement>(`[data-slice-id="${sliceA.id}"]`)
      ?.setAttribute('d', 'M 999 999 Z MODIFIED');

    act(() => {
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 99 }));
    });

    await act(async () => {});
    expect(bridge.isDraggingBoundary).toBe(false);

    // After cancel, d must be restored (not the mid-drag modified value)
    const pathAfter = container
      .querySelector<SVGPathElement>(`[data-slice-id="${sliceA.id}"]`)
      ?.getAttribute('d') ?? '';
    expect(pathAfter).not.toBe('M 999 999 Z MODIFIED');

    unmount();
  });
});
