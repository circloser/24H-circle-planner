/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { v4 as uuid } from 'uuid';
import type { Schedule } from '@/types/schedule';
import type { TimeSlice } from '@/types/time-slice';
import { loadSchedule, STORAGE_KEY_DAYS } from '@/lib/storage';
import { createInitialSchedule } from '@/lib/initial-schedule';
import { createDemoSchedule } from '@/data/demo-schedule';
import { useStoreDispatch, useStoreSelector } from '@/hooks/useScheduleStore';

/**
 * Multi-day layer: a thin collection of day-schedules layered over the single
 * schedule store, so a trip/week can hold several 24h plans you switch between.
 *
 * A day has its OWN stable id (independent of its schedule's id, which changes
 * whenever a preset is loaded). The active day is mirrored into the schedule
 * store (the existing editor), and the store's live `present` is written back
 * into the active day so thumbnails stay current. The store defers its own
 * restore to this layer when a days envelope exists (see useScheduleStore mount
 * guard).
 */

/** Maximum number of days (trip/week length cap). */
export const MAX_DAYS = 20;

interface DayDoc {
  id: string; // stable day id (NOT the schedule id)
  schedule: Schedule;
}

interface DaysState {
  days: DayDoc[];
  activeId: string | null;
}

interface DaysEnvelope {
  version: 1;
  days: DayDoc[];
  activeId: string | null;
}

function loadDaysEnvelope(): { state: DaysState; existed: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DAYS);
    if (raw) {
      const env = JSON.parse(raw) as DaysEnvelope;
      if (env && env.version === 1 && Array.isArray(env.days)) {
        const days = env.days.filter((d) => d && typeof d.id === 'string' && d.schedule);
        return { state: { days, activeId: env.activeId ?? null }, existed: true };
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return { state: { days: [], activeId: null }, existed: false };
}

/** Synchronous initial state: restore the envelope, or seed day 1 from the
 *  existing single schedule (returning users keep their plan), else a friendly
 *  demo example on a genuine first visit (so the circle is never empty). */
function initDaysState(): DaysState {
  const env = loadDaysEnvelope();
  if (env.existed) return env.state;
  const seed = loadSchedule() ?? createDemoSchedule();
  const day: DayDoc = { id: uuid(), schedule: seed };
  return { days: [day], activeId: day.id };
}

interface DaysContextValue {
  days: DayDoc[];
  activeId: string | null;
  activeIndex: number; // 0-based; -1 when none
  switchTo: (dayId: string) => void;
  addDay: (mode?: 'empty' | 'duplicate') => void;
  addDayFromSlices: (slices: TimeSlice[], name: string) => void;
  deleteDay: (dayId: string) => void;
  /** Internal: write the live schedule back into the active day. */
  syncActive: (present: Schedule) => void;
}

const DaysContext = createContext<DaysContextValue | null>(null);

export function DaysProvider({ children }: { children: React.ReactNode }) {
  const init = useMemo(() => initDaysState(), []);
  const [days, setDays] = useState<DayDoc[]>(init.days);
  const [activeId, setActiveId] = useState<string | null>(init.activeId);
  const dispatch = useStoreDispatch();

  // Persist on change.
  useEffect(() => {
    try {
      const env: DaysEnvelope = { version: 1, days, activeId };
      localStorage.setItem(STORAGE_KEY_DAYS, JSON.stringify(env));
    } catch {
      // storage unavailable — won't persist
    }
  }, [days, activeId]);

  const switchTo = useCallback(
    (dayId: string) => {
      const target = days.find((d) => d.id === dayId);
      if (!target || dayId === activeId) return;
      setActiveId(dayId);
      dispatch({ type: 'LOAD_SCHEDULE', schedule: target.schedule });
    },
    [days, activeId, dispatch],
  );

  const addDay = useCallback(
    (mode: 'empty' | 'duplicate' = 'empty') => {
      if (days.length >= MAX_DAYS) return; // capped — see DayBar for the UI guard
      let schedule: Schedule;
      if (mode === 'duplicate') {
        const base = (activeId ? days.find((d) => d.id === activeId)?.schedule : undefined) ??
          createInitialSchedule();
        // Deep-clone with fresh ids so the copy is independent of the source.
        schedule = {
          ...base,
          id: uuid(),
          updatedAt: new Date().toISOString(),
          presetSource: null,
          slices: base.slices.map((s) => ({ ...s, id: uuid() })),
        };
      } else {
        schedule = createInitialSchedule();
      }
      const day: DayDoc = { id: uuid(), schedule };
      setDays((prev) => [...prev, day]);
      setActiveId(day.id);
      dispatch({ type: 'LOAD_SCHEDULE', schedule });
    },
    [activeId, days, dispatch],
  );

  // Add a new day seeded from a preset's slices (deep-cloned with fresh ids).
  const addDayFromSlices = useCallback(
    (slices: TimeSlice[], name: string) => {
      if (days.length >= MAX_DAYS) return;
      const schedule: Schedule = {
        id: uuid(),
        version: 1,
        name,
        presetSource: null,
        updatedAt: new Date().toISOString(),
        slices: slices.map((s) => ({ ...s, id: uuid() })),
      };
      const day: DayDoc = { id: uuid(), schedule };
      setDays((prev) => [...prev, day]);
      setActiveId(day.id);
      dispatch({ type: 'LOAD_SCHEDULE', schedule });
    },
    [days, dispatch],
  );

  const deleteDay = useCallback(
    (dayId: string) => {
      // Always keep at least one day — the last schedule can't be deleted.
      if (days.length <= 1) return;
      const idx = days.findIndex((d) => d.id === dayId);
      if (idx === -1) return;
      const next = days.filter((d) => d.id !== dayId);
      setDays(next);
      if (dayId === activeId) {
        const neighbor = next[Math.min(idx, next.length - 1)];
        setActiveId(neighbor.id);
        dispatch({ type: 'LOAD_SCHEDULE', schedule: neighbor.schedule });
      }
    },
    [days, activeId, dispatch],
  );

  // Writeback: keep the active day's schedule in sync with the live editor.
  const syncActive = useCallback(
    (present: Schedule) => {
      setDays((prev) => {
        if (!activeId) return prev;
        const idx = prev.findIndex((d) => d.id === activeId);
        if (idx === -1 || prev[idx].schedule === present) return prev;
        const copy = prev.slice();
        copy[idx] = { ...copy[idx], schedule: present };
        return copy;
      });
    },
    [activeId],
  );

  const activeIndex = activeId ? days.findIndex((d) => d.id === activeId) : -1;

  const value: DaysContextValue = {
    days,
    activeId,
    activeIndex,
    switchTo,
    addDay,
    addDayFromSlices,
    deleteDay,
    syncActive,
  };

  return (
    <DaysContext.Provider value={value}>
      <DayStoreBridge />
      {children}
    </DaysContext.Provider>
  );
}

/**
 * Isolates the store `present` subscription so only this leaf re-renders on each
 * commit (not the whole provider subtree). Loads the active day on mount and
 * writes live edits back into it.
 */
function DayStoreBridge() {
  const present = useStoreSelector((s) => s.history.present);
  const diaryDate = useStoreSelector((s) => s.diaryDate);
  const dispatch = useStoreDispatch();
  const ctx = useContext(DaysContext);

  // Mount: make the active day authoritative for what the chart shows.
  useEffect(() => {
    if (!ctx) return;
    if (ctx.activeId) {
      const active = ctx.days.find((d) => d.id === ctx.activeId);
      if (active) dispatch({ type: 'LOAD_SCHEDULE', schedule: active.schedule });
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Writeback live edits into the active day — but NOT while a diary record is
  // loaded: that would overwrite the working day the diary temporarily replaced.
  useEffect(() => {
    if (diaryDate) return;
    ctx?.syncActive(present);
  }, [present, diaryDate, ctx]);

  return null;
}

export function useDays(): DaysContextValue {
  const ctx = useContext(DaysContext);
  if (!ctx) {
    // Inert fallback (tests / previews without the provider).
    return {
      days: [],
      activeId: null,
      activeIndex: -1,
      switchTo: () => {},
      addDay: () => {},
      addDayFromSlices: () => {},
      deleteDay: () => {},
      syncActive: () => {},
    };
  }
  return ctx;
}
