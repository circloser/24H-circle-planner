import type { TimeSlice } from '@/types/time-slice';
import { sliceWidthMinutes } from '@/lib/time-utils';

// Analyse a set of day-schedules using the slices EXACTLY as entered — every
// distinct label is its own line (no keyword bucketing), carrying the slice's
// own colour and icon so the read-out matches the chart 1:1.

const FALLBACK_COLOR = '#9ca3af';

/** Aggregate stat for one distinct label across all analysed days. */
export interface LabelStat {
  /** Raw label as typed ('' → the caller shows a placeholder). */
  label: string;
  /** Total minutes across every analysed day. */
  minutes: number;
  /** Representative colour (first occurrence of the label). */
  color: string;
  /** Representative icon (first non-empty occurrence), '' when none. */
  icon: string;
}

/** One day's ordered segments, for a per-day timeline strip. */
export interface DaySegments {
  /** 1-based day number for display. */
  n: number;
  segments: Array<{ label: string; minutes: number; color: string }>;
}

export interface Analytics {
  dayCount: number;
  /** Distinct labels, summed across days, sorted by minutes desc. */
  byLabel: LabelStat[];
  perDay: DaySegments[];
}

/**
 * Aggregate raw slice time across every day's schedule, grouped by the exact
 * label. Two slices share a row only when their labels match character-for-
 * character; the colour/icon shown is the first occurrence's.
 */
export function analyzeDays(days: Array<{ schedule: { slices: TimeSlice[] } }>): Analytics {
  const agg = new Map<string, { minutes: number; color: string; icon: string }>();
  const perDay: DaySegments[] = days.map((d, i) => {
    const segments = d.schedule.slices.map((sl) => {
      const key = sl.label ?? '';
      const w = sliceWidthMinutes(sl);
      const color = sl.color || FALLBACK_COLOR;
      const cur = agg.get(key);
      if (cur) {
        cur.minutes += w;
        if (!cur.icon && sl.icon) cur.icon = sl.icon;
      } else {
        agg.set(key, { minutes: w, color, icon: sl.icon || '' });
      }
      return { label: key, minutes: w, color };
    });
    return { n: i + 1, segments };
  });
  const byLabel: LabelStat[] = [...agg.entries()]
    .map(([label, v]) => ({ label, minutes: v.minutes, color: v.color, icon: v.icon }))
    .sort((a, b) => b.minutes - a.minutes);
  return { dayCount: days.length, byLabel, perDay };
}
