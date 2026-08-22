import type { TimeSlice } from '@/types/time-slice';
import { hhmmToMinutes, sliceWidthMinutes } from '@/lib/time-utils';
import { currentSliceAt } from '@/lib/sliceAlarm';

/**
 * "Now & Next" snapshot of a contiguous 24h timetable at a given minute-of-day.
 * The ring is contiguous and ordered clockwise (each slice's end == the next
 * slice's start), so the following slice is simply index+1 (mod length).
 */
export interface NowNext {
  current: TimeSlice | null;
  next: TimeSlice | null;
  /** Minutes elapsed since the current slice started (0..width). */
  elapsedMin: number;
  /** Minutes until the current slice ends (0..width). */
  remainingMin: number;
  /** Fraction through the current slice, 0..1. */
  progress: number;
}

export function computeNowNext(slices: readonly TimeSlice[], minutes: number): NowNext {
  const empty: NowNext = { current: null, next: null, elapsedMin: 0, remainingMin: 0, progress: 0 };
  if (!slices.length) return empty;

  const current = currentSliceAt(slices, minutes);
  if (!current) return empty;

  const start = hhmmToMinutes(current.startTime) % 1440;
  const width = sliceWidthMinutes(current); // wrap-aware; full-day slice = 1440
  const elapsed = (((minutes - start) % 1440) + 1440) % 1440; // minutes since start, wrap-aware
  const elapsedMin = Math.min(elapsed, width);
  const remainingMin = Math.max(0, width - elapsedMin);
  const progress = width > 0 ? Math.min(1, elapsedMin / width) : 0;

  const idx = slices.findIndex((s) => s.id === current.id);
  const candidate = slices.length > 1 ? slices[(idx + 1) % slices.length] : null;
  const next = candidate && candidate.id !== current.id ? candidate : null;

  return { current, next, elapsedMin, remainingMin, progress };
}
