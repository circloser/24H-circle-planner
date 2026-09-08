import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { DaysProvider, useDays } from '../useDays';
import { ScheduleStoreProvider, useStoreDispatch, useStoreSelector } from '../useScheduleStore';
import { createInitialSchedule } from '@/lib/initial-schedule';
import { STORAGE_KEY_DAYS } from '@/lib/storage';
afterEach(() => { cleanup(); localStorage.clear(); });
function wrapper({ children }: { children: ReactNode }) {
  return <ScheduleStoreProvider><DaysProvider>{children}</DaysProvider></ScheduleStoreProvider>;
}
describe('day persistence', () => {
  it('persists subsequent edits when a child replaces the restored schedule on mount', () => {
    const schedule = { ...createInitialSchedule(), name: 'Weekday override' };
    function Override() {
      const dispatch = useStoreDispatch();
      useEffect(() => { dispatch({ type: 'LOAD_SCHEDULE', schedule }); }, [dispatch]);
      return null;
    }
    function withOverride({ children }: { children: ReactNode }) {
      return <ScheduleStoreProvider><DaysProvider><Override />{children}</DaysProvider></ScheduleStoreProvider>;
    }
    const { result } = renderHook(() => useStoreDispatch(), { wrapper: withOverride });
    act(() => result.current({ type: 'SET_SCHEDULE_NAME', name: 'After override' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_DAYS)!).days[0].schedule.name).toBe('After override');
  });
  it('restores the authoritative day without writing the initial blank editor over it and isolates diary views', () => {
    const schedule = { ...createInitialSchedule(), name: 'Restored plan' };
    localStorage.setItem(STORAGE_KEY_DAYS, JSON.stringify({ version: 1, activeId: 'day1', days: [{ id: 'day1', schedule }] }));
    const { result } = renderHook(() => ({ days: useDays(), dispatch: useStoreDispatch(), present: useStoreSelector(s => s.history.present) }), { wrapper });
    expect(result.current.present.name).toBe('Restored plan');
    expect(result.current.days.days[0].schedule.name).toBe('Restored plan');
    act(() => result.current.dispatch({ type: 'SET_SCHEDULE_NAME', name: 'Edited plan' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_DAYS)!).days[0].schedule.name).toBe('Edited plan');
    act(() => result.current.dispatch({ type: 'LOAD_DIARY', schedule: { ...schedule, name: 'Past diary' }, date: '2026-09-01' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_DAYS)!).days[0].schedule.name).toBe('Edited plan');
  });
});
