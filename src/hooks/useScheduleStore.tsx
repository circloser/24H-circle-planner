/* eslint-disable react-refresh/only-export-components */
import { useReducer, useEffect, type Dispatch } from 'react';
import { createContext, useContextSelector } from 'use-context-selector';
import { toast } from 'sonner';
import { v4 as uuid } from 'uuid';
import type { Schedule } from '@/types/schedule';
import type { TimeSlice } from '@/types/time-slice';
import type { Preset } from '@/types/preset';
import type { HistoryState } from '@/types/history';
import type { DragRef } from '@/types/drag';
import { HISTORY_DEPTH } from '@/types/history';
import {
  splitSliceAt,
  mergeSlices,
  resizeBoundary,
  replaceSlice,
  applyPalette,
  ContiguityError,
} from '@/lib/schedule';
import { loadSchedule, saveScheduleDebounced, STORAGE_KEY_DAYS } from '@/lib/storage';
import { createInitialSchedule } from '@/lib/initial-schedule';

// ─── State ───────────────────────────────────────────────────────────────────

export interface StoreState {
  history: HistoryState;
  isDraggingBoundary: boolean;
  dragRef: DragRef | null;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export type StoreAction =
  | { type: 'LOAD_SCHEDULE'; schedule: Schedule }
  | { type: 'SPLIT'; hhmm: string; newSlotSide?: 'before' | 'after' }
  | { type: 'MERGE'; idCw: string; idCcw: string }
  | { type: 'APPLY_PALETTE'; colors: string[] }
  | {
      type: 'RESIZE_BOUNDARY';
      boundaryIndex: number;
      newHHmm: string;
      baseSnapshot?: Schedule;
    }
  | { type: 'REPLACE_SLICE'; id: string; patch: Partial<TimeSlice> }
  | { type: 'SET_SCHEDULE_NAME'; name: string }
  | { type: 'LOAD_PRESET'; preset: Preset; presetName: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_IS_DRAGGING_BOUNDARY'; value: boolean }
  | { type: 'SET_DRAG_REF'; value: DragRef | null };

// ─── Context ─────────────────────────────────────────────────────────────────

interface StoreContextValue {
  state: StoreState;
  dispatch: Dispatch<StoreAction>;
}

const StoreCtx = createContext<StoreContextValue | null>(null);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pushHistory(history: HistoryState, next: Schedule): HistoryState {
  const past = [...history.past, history.present];
  // Cap at HISTORY_DEPTH
  const cappedPast = past.length > HISTORY_DEPTH ? past.slice(past.length - HISTORY_DEPTH) : past;
  return { past: cappedPast, present: next, future: [] };
}

/**
 * Deep-equal comparison of schedules ignoring `updatedAt` and `presetSource`.
 * Returns true if slices are structurally identical.
 */
function scheduleEffectivelyChanged(prev: Schedule, next: Schedule): boolean {
  if (prev.slices.length !== next.slices.length) return true;
  for (let i = 0; i < prev.slices.length; i++) {
    const a = prev.slices[i];
    const b = next.slices[i];
    if (
      a.id !== b.id ||
      a.label !== b.label ||
      a.startTime !== b.startTime ||
      a.endTime !== b.endTime ||
      a.color !== b.color ||
      a.icon !== b.icon ||
      a.textPosition !== b.textPosition
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Deep-clone slices with fresh UUIDs (for LOAD_PRESET).
 */
function deepCloneSlicesWithNewIds(slices: TimeSlice[]): TimeSlice[] {
  return slices.map((s) => ({ ...s, id: uuid() }));
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

function applyMutation(
  state: StoreState,
  compute: (present: Schedule) => Schedule,
): StoreState {
  try {
    const base = state.history.present;
    const next = compute(base);
    // F4: clear presetSource on effectful mutation
    const finalNext =
      next.presetSource !== null && scheduleEffectivelyChanged(base, next)
        ? { ...next, presetSource: null }
        : next;

    return {
      ...state,
      history: pushHistory(state.history, finalNext),
    };
  } catch (err) {
    if (err instanceof ContiguityError) {
      // Async toast — do not block reducer
      setTimeout(() => {
        toast.error(err.message);
      }, 0);
    }
    return state;
  }
}

function reducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case 'LOAD_SCHEDULE':
      return {
        ...state,
        history: { past: [], present: action.schedule, future: [] },
      };

    case 'SPLIT':
      return applyMutation(state, (present) =>
        splitSliceAt(present, action.hhmm, action.newSlotSide),
      );

    case 'APPLY_PALETTE':
      return applyMutation(state, (present) => applyPalette(present, action.colors));

    case 'MERGE':
      return applyMutation(state, (present) =>
        mergeSlices(present, action.idCw, action.idCcw),
      );

    case 'RESIZE_BOUNDARY': {
      const base = action.baseSnapshot ?? state.history.present;
      return applyMutation(
        { ...state, history: { ...state.history, present: base } },
        (present) => resizeBoundary(present, action.boundaryIndex, action.newHHmm),
      );
    }

    case 'REPLACE_SLICE':
      return applyMutation(state, (present) =>
        replaceSlice(present, action.id, action.patch),
      );

    case 'SET_SCHEDULE_NAME': {
      const present = state.history.present;
      const name = action.name.trim();
      if (name === '' || name === present.name) return state; // no-op
      return applyMutation(state, (p) => ({
        ...p,
        name,
        updatedAt: new Date().toISOString(),
      }));
    }

    case 'LOAD_PRESET': {
      const { preset, presetName } = action;
      const clonedSlices = deepCloneSlicesWithNewIds(preset.slices);
      const next: Schedule = {
        id: uuid(),
        version: 1,
        name: preset.name,
        slices: clonedSlices,
        updatedAt: new Date().toISOString(),
        presetSource: presetName,
      };
      return {
        ...state,
        history: pushHistory(state.history, next),
      };
    }

    case 'UNDO': {
      const { past, present, future } = state.history;
      if (past.length === 0) return state;
      const prev = past[past.length - 1];
      return {
        ...state,
        history: {
          past: past.slice(0, -1),
          present: prev,
          future: [present, ...future],
        },
      };
    }

    case 'REDO': {
      const { past, present, future } = state.history;
      if (future.length === 0) return state;
      const next = future[0];
      return {
        ...state,
        history: {
          past: [...past, present],
          present: next,
          future: future.slice(1),
        },
      };
    }

    case 'SET_IS_DRAGGING_BOUNDARY':
      return { ...state, isDraggingBoundary: action.value };

    case 'SET_DRAG_REF':
      return { ...state, dragRef: action.value };

    default:
      return state;
  }
}

// ─── Initial state ────────────────────────────────────────────────────────────

function makeInitialState(): StoreState {
  return {
    history: {
      past: [],
      present: createInitialSchedule(),
      future: [],
    },
    isDraggingBoundary: false,
    dragRef: null,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ScheduleStoreProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);

  // On mount: restore from localStorage
  useEffect(() => {
    // When the multi-day layer is present it owns loading the active day (from a
    // more current store), so skip the single-schedule restore to avoid
    // clobbering it with a possibly-staler cache.
    if (localStorage.getItem(STORAGE_KEY_DAYS) !== null) return;
    const raw = localStorage.getItem('24h-circle-planner.schedule');
    const loaded = loadSchedule();
    if (loaded !== null) {
      dispatch({ type: 'LOAD_SCHEDULE', schedule: loaded });
    } else if (raw !== null) {
      // Something was stored but failed to parse → corrupt
      toast.warning('저장된 시간표가 손상되어 새로 시작합니다');
    }
    // If raw === null: no prior data, silently use initial schedule
  }, []);

  // Save on every present change
  useEffect(() => {
    saveScheduleDebounced(state.history.present);
  }, [state.history.present]);

  const value: StoreContextValue = { state, dispatch };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useStoreSelector<T>(selector: (s: StoreState) => T): T {
  const value = useContextSelector(StoreCtx, (ctx) => {
    if (ctx === null) throw new Error('useStoreSelector must be used inside ScheduleStoreProvider');
    return selector(ctx.state);
  });
  return value;
}

export function useStoreDispatch(): Dispatch<StoreAction> {
  return useContextSelector(StoreCtx, (ctx) => {
    if (ctx === null) throw new Error('useStoreDispatch must be used inside ScheduleStoreProvider');
    return ctx.dispatch;
  });
}

/**
 * Returns the current TimeSlice for the given id.
 * During boundary drag, returns from the drag snapshot if this slice is affected.
 * Used by T4 renderer for optimistic updates without triggering full re-renders.
 */
export function useSliceSelector(sliceId: string): TimeSlice | undefined {
  return useStoreSelector((s) =>
    s.isDraggingBoundary && s.dragRef?.affectedSliceIds.has(sliceId)
      ? s.dragRef.snapshot.slices.find((x) => x.id === sliceId)
      : s.history.present.slices.find((x) => x.id === sliceId),
  );
}


