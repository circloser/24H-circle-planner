import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClockTools, MAX_WEATHERS, MAX_CLOCKS } from '../useClockTools';
import { clampOffset, migrateLegacyPos } from '../clock-utils';

const KEY = '24h-circle-planner.clocktools';

beforeEach(() => localStorage.clear());

describe('useClockTools — multi-window weather', () => {
  it('migrates a legacy ON weather widget into one list item (place preserved, pos re-based to a clamped centre offset)', () => {
    localStorage.setItem(KEY, JSON.stringify({
      version: 1,
      state: { weather: { on: true, pos: { x: 300, y: 400 }, place: { name: '서울', lat: 37.56, lon: 126.97 } } },
    }));
    const { result } = renderHook(() => useClockTools());
    expect(result.current.state.weathers).toHaveLength(1);
    expect(result.current.state.weathers[0].place?.name).toBe('서울');
    // Unmarked legacy envelope → absolute pixels become centre offsets (same
    // rendered spot), then the on-screen clamp applies.
    expect(result.current.state.weathers[0].pos).toEqual(clampOffset(migrateLegacyPos({ x: 300, y: 400 }), 204, 200));
    expect(typeof result.current.state.weathers[0].id).toBe('string');
  });

  it('migrates a legacy OFF weather widget to no windows', () => {
    localStorage.setItem(KEY, JSON.stringify({
      version: 1,
      state: { weather: { on: false, pos: { x: 1, y: 2 }, place: { name: 'Paris', lat: 48.85, lon: 2.35 } } },
    }));
    const { result } = renderHook(() => useClockTools());
    expect(result.current.state.weathers).toEqual([]);
  });

  it('addWeather appends windows up to MAX_WEATHERS, then no-ops', () => {
    const { result } = renderHook(() => useClockTools());
    for (let i = 0; i < MAX_WEATHERS + 2; i++) act(() => result.current.addWeather());
    expect(result.current.state.weathers).toHaveLength(MAX_WEATHERS);
    // Cascaded spawn positions — windows must not stack exactly on top of each other.
    const [a, b] = result.current.state.weathers;
    expect(a.pos).not.toEqual(b.pos);
  });

  it('removeWeather removes only that window; setWeather patches only that window', () => {
    const { result } = renderHook(() => useClockTools());
    act(() => result.current.addWeather());
    act(() => result.current.addWeather());
    const [first, second] = result.current.state.weathers;

    act(() => result.current.setWeather(second.id, { place: { name: 'Tokyo', lat: 35.68, lon: 139.69 } }));
    expect(result.current.state.weathers[0].place).toBeNull();
    expect(result.current.state.weathers[1].place?.name).toBe('Tokyo');

    act(() => result.current.removeWeather(first.id));
    expect(result.current.state.weathers).toHaveLength(1);
    expect(result.current.state.weathers[0].id).toBe(second.id);
  });

  it('migrates a legacy ON clock into one list item (mode kept, tz local, pos re-based to a clamped centre offset)', () => {
    localStorage.setItem(KEY, JSON.stringify({
      version: 1,
      state: { clock: { on: true, mode: 'digital', pos: { x: 30, y: 40 } } },
    }));
    const { result } = renderHook(() => useClockTools());
    expect(result.current.state.clocks).toHaveLength(1);
    expect(result.current.state.clocks[0]).toMatchObject({ mode: 'digital', tz: null });
    expect(result.current.state.clocks[0].pos).toEqual(clampOffset(migrateLegacyPos({ x: 30, y: 40 }), 168, 150));
  });

  it('migrates a legacy OFF clock to no clocks; missing clock info → default local clock', () => {
    localStorage.setItem(KEY, JSON.stringify({
      version: 1,
      state: { clock: { on: false, mode: 'analog', pos: { x: 1, y: 2 } } },
    }));
    expect(renderHook(() => useClockTools()).result.current.state.clocks).toEqual([]);
    localStorage.setItem(KEY, JSON.stringify({ version: 1, state: {} }));
    expect(renderHook(() => useClockTools()).result.current.state.clocks).toHaveLength(1);
  });

  it('addClock caps at MAX_CLOCKS; setClock patches ONE clock (timezone)', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, state: { clock: { on: false, mode: 'analog', pos: { x: 0, y: 0 } } } }));
    const { result } = renderHook(() => useClockTools());
    for (let i = 0; i < MAX_CLOCKS + 2; i++) act(() => result.current.addClock());
    expect(result.current.state.clocks).toHaveLength(MAX_CLOCKS);

    const [first, second] = result.current.state.clocks;
    act(() => result.current.setClock(second.id, { tz: 'Asia/Tokyo' }));
    expect(result.current.state.clocks[0].tz).toBeNull();
    expect(result.current.state.clocks[1].tz).toBe('Asia/Tokyo');

    act(() => result.current.removeClock(first.id));
    expect(result.current.state.clocks).toHaveLength(MAX_CLOCKS - 1);
    expect(result.current.state.clocks[0].id).toBe(second.id);
  });

  it('persists the weathers list and restores it on the next mount', () => {
    const a = renderHook(() => useClockTools());
    act(() => a.result.current.addWeather());
    act(() => a.result.current.addWeather());
    const ids = a.result.current.state.weathers.map((w) => w.id);
    a.unmount();

    const b = renderHook(() => useClockTools());
    expect(b.result.current.state.weathers.map((w) => w.id)).toEqual(ids);
    // The stored envelope carries the list (no legacy `weather` key needed).
    const envelope = JSON.parse(localStorage.getItem(KEY)!);
    expect(Array.isArray(envelope.state.weathers)).toBe(true);
    expect(envelope.state.weathers).toHaveLength(2);
  });
});
