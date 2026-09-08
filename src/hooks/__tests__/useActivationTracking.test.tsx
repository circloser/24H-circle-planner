import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useActivationTracking } from '../useActivationTracking';
import { ScheduleStoreProvider, useStoreDispatch, useStoreSelector } from '../useScheduleStore';
import { track } from '@/lib/track';
import { PRESETS } from '@/data/presets';
vi.mock('@/lib/track', () => ({ track: vi.fn() }));
function wrapper({ children }: { children: ReactNode }) { return <ScheduleStoreProvider>{children}</ScheduleStoreProvider>; }
function setup() { return renderHook(() => {
  useActivationTracking();
  return { dispatch: useStoreDispatch(), present: useStoreSelector((state) => state.history.present) };
}, { wrapper }); }
const meaningfulCalls = () => vi.mocked(track).mock.calls.filter(([event]) => event === 'meaningful_schedule_edit');
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('meaningful activation', () => {
  it('ignores preset, appearance, loading and undo/redo, then records a real title edit once without content', () => {
    const { result } = setup();
    act(() => result.current.dispatch({ type: 'LOAD_PRESET', preset: PRESETS[0], presetName: PRESETS[0].name }));
    act(() => result.current.dispatch({ type: 'APPLY_PALETTE', colors: ['#ffffff'] }));
    act(() => result.current.dispatch({ type: 'UNDO' }));
    act(() => result.current.dispatch({ type: 'REDO' }));
    act(() => result.current.dispatch({ type: 'LOAD_SCHEDULE', schedule: { ...result.current.present, name: 'Imported private title' } }));
    expect(meaningfulCalls()).toHaveLength(0);
    act(() => result.current.dispatch({ type: 'SET_SCHEDULE_NAME', name: 'Private user title' }));
    act(() => result.current.dispatch({ type: 'UNDO' }));
    act(() => result.current.dispatch({ type: 'REDO' }));
    act(() => result.current.dispatch({ type: 'SET_SCHEDULE_NAME', name: 'Another title' }));
    expect(meaningfulCalls()).toEqual([['meaningful_schedule_edit']]);
  });
  it('records time creation once per session across remounts', () => {
    const first = setup();
    act(() => first.result.current.dispatch({ type: 'SET_BLOCK', start: '08:00', end: '09:00', newId: 'new-block' }));
    expect(meaningfulCalls()).toHaveLength(1);
    first.unmount();
    const second = setup();
    act(() => second.result.current.dispatch({ type: 'SET_SCHEDULE_NAME', name: 'Next edit' }));
    expect(meaningfulCalls()).toHaveLength(1);
  });
  it('retains once-per-mount behavior when session storage is unavailable', () => {
    const get = Storage.prototype.getItem;
    const denied = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (this === sessionStorage) throw new Error('denied');
      return get.call(this, key);
    });
    const { result } = setup();
    act(() => result.current.dispatch({ type: 'SET_SCHEDULE_NAME', name: 'First' }));
    act(() => result.current.dispatch({ type: 'UNDO' }));
    act(() => result.current.dispatch({ type: 'SET_SCHEDULE_NAME', name: 'Second' }));
    expect(denied).toHaveBeenCalledWith('24h-meaningful-edited');
    expect(meaningfulCalls()).toHaveLength(1);
    expect(vi.mocked(track).mock.calls.filter(([event]) => event === 'schedule_edit')).toHaveLength(1);
  });
});
