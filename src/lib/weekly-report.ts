import type { RecordItem } from '@/hooks/useRecords';
import { recordMinutes } from '@/lib/time-gap';

/** One activity's share of the window's total logged time. */
export interface WeeklyLabelRow {
  key: string; // normalized label (join key)
  label: string; // display label
  color: string;
  minutes: number;
  pct: number; // of total logged minutes in the window (0–100)
  days: number; // distinct calendar days this label was logged (consistency)
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
export function shiftKey(key: string, deltaDays: number): string {
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
    const seenToday = new Set<string>(); // count each label at most once per day
    let dayMin = 0;
    for (const r of items) {
      const l = (r.label ?? '').trim();
      const min = recordMinutes(r);
      dayMin += min;
      if (!l) continue; // unlabeled time still counts in totals, not the split
      const k = norm(l);
      let row = map.get(k);
      if (!row) {
        row = { key: k, label: l, color: r.color, minutes: 0, pct: 0, days: 0 };
        map.set(k, row);
      }
      row.minutes += min;
      if (!seenToday.has(k)) {
        seenToday.add(k);
        row.days += 1;
      }
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

/** A single plain-language observation about the window. Deterministic — the
 *  seed of the (later) AI coach's Observation step, computed with no model /
 *  API cost. `kind` picks the i18n template; `params` fills it. */
export interface Insight {
  kind: 'top' | 'consistent' | 'busiestDay' | 'trend';
  params: Record<string, string | number>;
}

/**
 * Turn a {@link WeeklyReport} into a few neutral observations (never a verdict).
 * `prevTotal` is the total logged minutes of the *previous* window of the same
 * length (0 when unknown) — used only for the trend line. Order is stable:
 * top activity, most consistent activity, busiest day, then trend.
 */
export function weeklyInsights(r: WeeklyReport, prevTotal: number): Insight[] {
  const out: Insight[] = [];
  if (r.total === 0) return out;

  // Top activity by logged time.
  const top = r.byLabel[0];
  if (top) out.push({ kind: 'top', params: { label: top.label, minutes: top.minutes, pct: top.pct } });

  // Most consistent activity — logged on the most distinct days (needs ≥ 2 days
  // to be a "pattern"; ties break toward more total time via byLabel order).
  const consistent = [...r.byLabel].sort((a, b) => b.days - a.days || b.minutes - a.minutes)[0];
  if (consistent && consistent.days >= 2) {
    out.push({ kind: 'consistent', params: { label: consistent.label, days: consistent.days, span: r.days.length } });
  }

  // Busiest day (only meaningful with 2+ active days).
  if (r.activeDays >= 2 && r.maxDay > 0) {
    const busiest = r.days.find((d) => d.minutes === r.maxDay);
    if (busiest) out.push({ kind: 'busiestDay', params: { date: busiest.label, minutes: busiest.minutes } });
  }

  // Trend vs the previous same-length window.
  if (prevTotal > 0) {
    const pct = Math.round(((r.total - prevTotal) / prevTotal) * 100);
    if (pct !== 0) out.push({ kind: 'trend', params: { dir: pct > 0 ? 'up' : 'down', pct: Math.abs(pct) } });
  }

  return out;
}
