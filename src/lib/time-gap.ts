import type { TimeSlice } from '@/types/time-slice';
import type { RecordItem } from '@/hooks/useRecords';
import { hhmmToMinutes, sliceWidthMinutes } from '@/lib/time-utils';

/** One label's planned-vs-actual for a day. `pct` = actual/planned (null when
 *  nothing was planned for it — an unplanned activity). */
export interface GapRow {
  key: string; // normalized join key
  label: string; // display label
  color: string;
  planned: number; // minutes
  actual: number; // minutes
  diff: number; // actual - planned
  pct: number | null;
}

export interface TimeGap {
  planned: GapRow[]; // rows with a plan (planned > 0), sorted by planned desc
  unplanned: GapRow[]; // logged but not planned (planned === 0)
  plannedTotal: number;
  actualTotal: number;
}

const norm = (l: string) => l.trim().toLowerCase();

/** Minutes covered by a record; wrap-aware ("22:00"→"00:30" = 150). */
export function recordMinutes(r: RecordItem): number {
  const s = hhmmToMinutes(r.start === '24:00' ? '00:00' : r.start);
  const e = hhmmToMinutes(r.end === '24:00' ? '00:00' : r.end);
  return (((e - s) % 1440) + 1440) % 1440;
}

/**
 * Join a day's PLAN (labeled slices) with its ACTUAL log (records) by label, so
 * you can see planned vs actual time per activity. Label-string join (trim +
 * case-insensitive) — a stable task id is a later step; unmatched labels surface
 * as plan-only (0% done) or unplanned rows rather than being silently dropped.
 */
export function timeGap(planSlices: readonly TimeSlice[], records: readonly RecordItem[]): TimeGap {
  const map = new Map<string, GapRow>();
  const row = (label: string, color: string): GapRow => {
    const k = norm(label);
    let r = map.get(k);
    if (!r) {
      r = { key: k, label: label.trim(), color, planned: 0, actual: 0, diff: 0, pct: null };
      map.set(k, r);
    }
    return r;
  };

  for (const s of planSlices) {
    const l = (s.label ?? '').trim();
    if (!l) continue; // only labeled blocks are tasks
    row(l, s.color).planned += sliceWidthMinutes(s);
  }
  for (const r of records) {
    const l = (r.label ?? '').trim();
    if (!l) continue;
    row(l, r.color).actual += recordMinutes(r);
  }

  const all = [...map.values()].map((r) => ({
    ...r,
    diff: r.actual - r.planned,
    pct: r.planned > 0 ? Math.round((r.actual / r.planned) * 100) : null,
  }));

  const planned = all.filter((r) => r.planned > 0).sort((a, b) => b.planned - a.planned || b.actual - a.actual);
  const unplanned = all.filter((r) => r.planned === 0 && r.actual > 0).sort((a, b) => b.actual - a.actual);

  return {
    planned,
    unplanned,
    plannedTotal: planned.reduce((n, r) => n + r.planned, 0),
    actualTotal: all.reduce((n, r) => n + r.actual, 0),
  };
}
