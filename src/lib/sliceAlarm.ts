import type { TimeSlice } from '@/types/time-slice';
import { hhmmToMinutes } from '@/lib/time-utils';

/**
 * The slice the clock is INSIDE at `minutes` (0–1439) — the timetable ring is
 * contiguous, so exactly one slice contains any moment; a slice whose end is
 * numerically before its start wraps across midnight.
 */
export function currentSliceAt(slices: readonly TimeSlice[], minutes: number): TimeSlice | null {
  for (const s of slices) {
    // A midnight boundary is stored as either "00:00" or "24:00"; normalise
    // "24:00" (hour 24 is out of hhmmToMinutes's 0–23 range and would throw).
    const start = hhmmToMinutes(s.startTime === '24:00' ? '00:00' : s.startTime) % 1440;
    const end = hhmmToMinutes(s.endTime === '24:00' ? '00:00' : s.endTime) % 1440;
    const inside = start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
    if (inside) return s;
  }
  return null;
}
