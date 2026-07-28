import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useDayChange } from '../useDayChange';

afterEach(() => {
  vi.useRealTimers();
});

describe('useDayChange', () => {
  it('returns today’s local YYYY-MM-DD key', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 28, 10, 0, 0)); // Jul 28 2026, local
    const { result } = renderHook(() => useDayChange());
    expect(result.current).toBe('2026-07-28');
  });

  it('rolls over when the local calendar day changes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 28, 23, 59, 30));
    const { result } = renderHook(() => useDayChange());
    expect(result.current).toBe('2026-07-28');

    act(() => {
      vi.setSystemTime(new Date(2026, 6, 29, 0, 0, 10)); // past midnight
      vi.advanceTimersByTime(60_000); // next poll tick
    });
    expect(result.current).toBe('2026-07-29');
  });

  it('stays stable within the same day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 28, 8, 0, 0));
    const { result } = renderHook(() => useDayChange());
    const first = result.current;
    act(() => {
      vi.advanceTimersByTime(60_000 * 30); // 30 min later, still Jul 28
    });
    expect(result.current).toBe(first);
  });
});
