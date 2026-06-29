import type { TimeSlice } from '@/types/time-slice';
import { analyzeDays } from '@/lib/analytics';
import { dateKey, type DiaryEntry } from '@/hooks/useDiary';

/**
 * Minutes accumulated toward a goal's label over its period, summed from the
 * timetable(s) by EXACT label (same aggregation analytics uses).
 *  - 'day'  : today's saved diary entry if present, else the current schedule.
 *  - 'week' : every saved diary entry in the last 7 days (+ the current schedule
 *             when today isn't saved yet).
 */
export function accumulatedMinutes(
  label: string,
  period: 'day' | 'week',
  presentSlices: TimeSlice[],
  entries: Record<string, DiaryEntry>,
): number {
  const todayKey = dateKey();
  const days: Array<{ schedule: { slices: TimeSlice[] } }> = [];

  if (period === 'day') {
    const todaySlices = entries[todayKey]?.slices ?? presentSlices;
    days.push({ schedule: { slices: todaySlices } });
  } else {
    const now = new Date();
    const cutoffKey = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    for (const e of Object.values(entries)) {
      if (e.date >= cutoffKey && e.date <= todayKey) days.push({ schedule: { slices: e.slices } });
    }
    if (!entries[todayKey]) days.push({ schedule: { slices: presentSlices } });
  }

  const target = label.trim();
  const stat = analyzeDays(days).byLabel.find((s) => s.label.trim() === target);
  return stat ? stat.minutes : 0;
}

/** Distinct non-empty labels across the current schedule + diary (for suggestions). */
export function knownLabels(presentSlices: TimeSlice[], entries: Record<string, DiaryEntry>): string[] {
  const set = new Set<string>();
  for (const s of presentSlices) if (s.label?.trim()) set.add(s.label.trim());
  for (const e of Object.values(entries)) for (const s of e.slices) if (s.label?.trim()) set.add(s.label.trim());
  return [...set].sort((a, b) => a.localeCompare(b));
}
