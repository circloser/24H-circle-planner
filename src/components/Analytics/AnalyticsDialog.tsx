import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AdSlot } from '@/components/Ads/AdSlot';
import { useDiary, dateKey } from '@/hooks/useDiary';
import { useTranslation } from '@/hooks/usePreferences';
import { analyzeDays } from '@/lib/analytics';
import type { TimeSlice } from '@/types/time-slice';

interface AnalyticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Range = 'all' | 'month' | 'week';

/**
 * Time analysis over SAVED DIARY entries ONLY (all / last month / last week).
 * The working/unsaved timetable is never analysed, so these numbers stay
 * consistent with the goals view. Every distinct label is its own line (raw, no
 * bucketing) with the slice's colour + icon — a daily-average split plus a
 * per-day timeline strip.
 */
export function AnalyticsDialog({ open, onOpenChange }: AnalyticsDialogProps) {
  const { entries } = useDiary();
  const { t, lang } = useTranslation();
  const [range, setRange] = useState<Range>('all');
  // Hover tooltip for the per-day trend segments (the native `title` was too
  // slow/undiscoverable to tell which item a colour band is).
  const [tip, setTip] = useState<{ x: number; y: number; label: string; color: string; minutes: number } | null>(null);

  // Saved diary entries within the chosen range, oldest → newest.
  const sources = useMemo<Array<{ label: string; slices: TimeSlice[] }>>(() => {
    let list = Object.values(entries).sort((a, b) => a.date.localeCompare(b.date));
    if (range !== 'all') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (range === 'week' ? 6 : 29));
      const cutKey = dateKey(cutoff);
      list = list.filter((e) => e.date >= cutKey);
    }
    return list.map((e) => ({ label: e.date.slice(5).replace('-', '/'), slices: e.slices }));
  }, [range, entries]);

  const a = useMemo(() => analyzeDays(sources.map((s) => ({ schedule: { slices: s.slices } }))), [sources]);
  const totalMin = a.dayCount * 1440 || 1;
  const pct = (min: number) => Math.round((min / totalMin) * 100);

  // "8시간 30분" / "8h 30m" (drops a zero part).
  const fmtMin = (v: number) => {
    const h = Math.floor(v / 60);
    const m = v % 60;
    if (lang === 'ko') return h && m ? `${h}시간 ${m}분` : h ? `${h}시간` : `${m}분`;
    return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
  };
  // Average minutes/day.
  const fmtAvg = (min: number) => fmtMin(Math.round(min / a.dayCount));

  const seg = (active: boolean): React.CSSProperties =>
    active
      ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: '1px solid hsl(var(--primary))' }
      : { backgroundColor: 'hsl(var(--surface))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' };
  const segCls = 'rounded-full px-3 py-1 text-xs font-medium transition-colors';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('analytics.title')}</DialogTitle>
        </DialogHeader>

        {/* Range selector — analysis uses SAVED DIARIES only. */}
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'month', 'week'] as Range[]).map((r) => (
            <button key={r} type="button" className={segCls} style={seg(range === r)} aria-pressed={range === r} onClick={() => setRange(r)}>
              {t(r === 'all' ? 'analytics.rangeAll' : r === 'month' ? 'analytics.rangeMonth' : 'analytics.rangeWeek')}
            </button>
          ))}
        </div>

        {a.dayCount === 0 || a.byLabel.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{t('analytics.empty')}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {t('analytics.subtitle', { n: String(a.dayCount) })}
            </p>

            {/* Per-label split bars — one row per item actually entered. */}
            <div className="mt-1 flex flex-col gap-2.5">
              {a.byLabel.map((it, idx) => (
                <div key={idx}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5 text-foreground">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: it.color }} />
                      {it.icon && <span aria-hidden className="shrink-0">{it.icon}</span>}
                      <span className="truncate">{it.label.trim() || t('analytics.untitled')}</span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                      {fmtAvg(it.minutes)} · {pct(it.minutes)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted-foreground/12">
                    <div className="h-full rounded-full" style={{ width: `${pct(it.minutes)}%`, backgroundColor: it.color }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Per-day timeline strip (when 2+ days) — each day's slices in order. */}
            {a.dayCount > 1 && (
              <section className="mt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('analytics.trend')}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {a.perDay.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-xs text-muted-foreground">
                        {sources[i]?.label}
                      </span>
                      <div className="flex h-3 w-full overflow-hidden rounded border border-border">
                        {d.segments.map((s, j) => (
                          <div
                            key={j}
                            onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, label: s.label, color: s.color, minutes: s.minutes })}
                            onMouseLeave={() => setTip(null)}
                            style={{ width: `${(s.minutes / 1440) * 100}%`, backgroundColor: s.color }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Reserved ad space (consistent with the other dialogs). */}
        <AdSlot slot="analytics" className="mt-3" />

        {/* Trend hover tooltip — follows the cursor, above the dialog (z-50). */}
        {tip && (
          <div
            className="pointer-events-none fixed z-[60] flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs shadow-md"
            style={{ left: tip.x + 12, top: tip.y - 34 }}
            role="tooltip"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tip.color }} />
            <span className="font-medium text-foreground">{tip.label.trim() || t('analytics.untitled')}</span>
            <span className="text-muted-foreground">{fmtMin(tip.minutes)}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
