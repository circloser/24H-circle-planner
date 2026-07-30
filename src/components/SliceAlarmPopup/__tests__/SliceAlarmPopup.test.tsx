import { render, screen, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SliceAlarmPopup } from '../SliceAlarmPopup';
import { fireSliceAlarmPopup } from '@/lib/notify';

afterEach(() => {
  cleanup(); // unmount between tests — a leftover popup would also catch the event
  vi.useRealTimers();
});

describe('SliceAlarmPopup', () => {
  it('is empty until a slice-alarm event fires', () => {
    render(<SliceAlarmPopup />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('appears on a slice-alarm event and auto-dismisses after 5s', () => {
    vi.useFakeTimers();
    render(<SliceAlarmPopup />);
    act(() => {
      fireSliceAlarmPopup({ title: '수면', body: '00:00–08:00' });
    });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('수면')).toBeTruthy();
    expect(screen.getByText('00:00–08:00')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a newer boundary replaces the current card', () => {
    vi.useFakeTimers();
    render(<SliceAlarmPopup />);
    act(() => {
      fireSliceAlarmPopup({ title: '수면', body: 'a' });
    });
    act(() => {
      vi.advanceTimersByTime(3000);
      fireSliceAlarmPopup({ title: '운동', body: 'b' });
    });
    expect(screen.queryByText('수면')).toBeNull();
    expect(screen.getByText('운동')).toBeTruthy();

    // The replacement resets the 5s timer (not dismissed at the original 5s).
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('운동')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
