import type { TimeSlice } from '@/types/time-slice';

/** Daily task-completion, counting only LABELED blocks as tasks (sleep, empty
 *  filler and unnamed slices aren't "tasks", so they don't dilute the rate). */
export interface DayCompletion {
  done: number;
  total: number;
  pct: number; // 0..100 (0 when there are no labeled tasks)
}

const isTask = (s: TimeSlice) => (s.label ?? '').trim() !== '';

export function dayCompletion(slices: readonly TimeSlice[]): DayCompletion {
  let total = 0;
  let done = 0;
  for (const s of slices) {
    if (!isTask(s)) continue;
    total++;
    if (s.done) done++;
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
