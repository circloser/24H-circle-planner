import type { RecordItem } from '@/hooks/useRecords';
import { recordMinutes } from '@/lib/time-gap';

/** One activity's share of the window's total logged time. */
export interface WeeklyLabelRow {
  key: string; // normalized label (join key)
  label: string; // display label
  color: string;
  minutes: number;
  pct: number; // of total logged minutes in the window (0–100)
}

/** One calendar day in the window (present even when nothing was logged). */
export interface WeeklyDay {
  date: string; // YYYY-MM-DD
  label: string; // MM/DD for display
  minutes: number; // total logged that day
}

export interface WeeklyReport {
  days: WeeklyDay[]; // oldest → newest, one per calendar day in the window
  byLabel: WeeklyLabelRow[]; // aggregated across the window, minutes desc
  total: number; // total logged minutes in the window
  activeDays: number; // days with > 0 logged minutes
  maxDay: number; // busiest day's minutes (for bar scaling; 0 when empty)
  avgPerActiveDay: number; // total / activeDays (0 when none)
}

const norm = (l: string) => l.trim().toLowerCase();
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Shift a YYYY-MM-DD key by whole days (local-calendar, DST-safe via noon). */
function shiftKey(key: string, deltaDays: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays, 12, 0, 0);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/**
 * Aggregate the last `days` calendar days of ACTUAL records (record mode),
 * ending at and including `todayKey`. Read-only over `byDate`; used by the
 * weekly/monthly report to show accumulated time trends. Label join is
 * trim + case-insensitive, matching {@link timeGap}. Every day in the window
 * appears in `days` (zero minutes when nothing was logged) so the daily strip
 * has no gaps.
 */
export function weeklyReport(
  byDate: Record<string, RecordItem[]>,
  todayKey: string,
  days = 7,
): WeeklyReport {
  const window: WeeklyDay[] = [];
  const map = new Map<string, WeeklyLabelRow>();

  for (let i = days - 1; i >= 0; i--) {
    const date = shiftKey(todayKey, -i);
    const items = byDate[date] ?? [];
    let dayMin = 0;
    for (const r of items) {
      const l = (r.label ?? '').trim();
      const min = recordMinutes(r);
      dayMin += min;
      if (!l) continue; // unlabeled time still counts in totals, not the split
      const k = norm(l);
      let row = map.get(k);
      if (!row) {
        row = { key: k, label: l, color: r.color, minutes: 0, pct: 0 };
        map.set(k, row);
      }
      row.minutes += min;
    }
    window.push({ date, label: `${date.slice(5, 7)}/${date.slice(8, 10)}`, minutes: dayMin });
  }

  const total = window.reduce((n, d) => n + d.minutes, 0);
  const activeDays = window.filter((d) => d.minutes > 0).length;
  const maxDay = window.reduce((m, d) => Math.max(m, d.minutes), 0);
  const byLabel = [...map.values()]
    .map((r) => ({ ...r, pct: total > 0 ? Math.round((r.minutes / total) * 100) : 0 }))
    .sort((a, b) => b.minutes - a.minutes);

  return {
    days: window,
    byLabel,
    total,
    activeDays,
    maxDay,
    avgPerActiveDay: activeDays > 0 ? Math.round(total / activeDays) : 0,
  };
}
