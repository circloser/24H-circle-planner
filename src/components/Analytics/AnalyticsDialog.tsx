import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AdSlot } from '@/components/Ads/AdSlot';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { useDays } from '@/hooks/useDays';
import { useDiary, dateKey } from '@/hooks/useDiary';
import { useTranslation } from '@/hooks/usePreferences';
import { analyzeDays, CATEGORY_ORDER, CATEGORY_COLOR, type CategoryKey } from '@/lib/analytics';
import type { TimeSlice } from '@/types/time-slice';

interface AnalyticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Scope = 'current' | 'all' | 'diary';
type Range = 'all' | 'month' | 'week';

const CAT_KEY: Record<CategoryKey, 'cat.sleep' | 'cat.work' | 'cat.meal' | 'cat.leisure' | 'cat.commute' | 'cat.other'> = {
  sleep: 'cat.sleep', work: 'cat.work', meal: 'cat.meal', leisure: 'cat.leisure', commute: 'cat.commute', other: 'cat.other',
};

/**
 * Time analysis across three sources — the current timetable, all days, or the
 * diary (all / last month / last week) — each categorised into life buckets and
 * shown as a daily-average split plus a per-day trend strip.
 */
export function AnalyticsDialog({ open, onOpenChange }: AnalyticsDialogProps) {
  const present = useStoreSelector((s) => s.history.present);
  const { days } = useDays();
  const { entries } = useDiary();
  const { t, lang } = useTranslation();
  const [scope, setScope] = useState<Scope>('current');
  const [range, setRange] = useState<Range>('all');

  // Build the labelled day-sources for the chosen scope.
  const sources = useMemo<Array<{ label: string; slices: TimeSlice[] }>>(() => {
    if (scope === 'current') return [{ label: t('day.thumb', { m: '1' }), slices: present.slices }];
    if (scope === 'all') return days.map((d, i) => ({ label: t('day.thumb', { m: String(i + 1) }), slices: d.schedule.slices }));
    // diary
    let list = Object.values(entries).sort((a, b) => a.date.localeCompare(b.date));
    if (range !== 'all') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (range === 'week' ? 6 : 29));
      const cutKey = dateKey(cutoff);
      list = list.filter((e) => e.date >= cutKey);
    }
    return list.map((e) => ({ label: e.date.slice(5).replace('-', '/'), slices: e.slices }));
  }, [scope, range, present, days, entries, t]);

  const a = useMemo(() => analyzeDays(sources.map((s) => ({ schedule: { slices: s.slices } }))), [sources]);
  const totalMin = a.dayCount * 1440 || 1;
  const cats = CATEGORY_ORDER.filter((c) => a.totalByCat[c] > 0).sort((x, y) => a.totalByCat[y] - a.totalByCat[x]);
  const hUnit = lang === 'ko' ? '시간' : 'h';
  const hPerDay = (min: number) => (min / a.dayCount / 60).toFixed(1);
  const pct = (min: number) => Math.round((min / totalMin) * 100);

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

        {/* Scope selector */}
        <div className="flex flex-wrap gap-1.5">
          {(['current', 'all', 'diary'] as Scope[]).map((s) => (
            <button key={s} type="button" className={segCls} style={seg(scope === s)} aria-pressed={scope === s} onClick={() => setScope(s)}>
              {t(s === 'current' ? 'analytics.scopeCurrent' : s === 'all' ? 'analytics.scopeAll' : 'analytics.scopeDiary')}
            </button>
          ))}
        </div>
        {/* Diary range sub-selector */}
        {scope === 'diary' && (
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'month', 'week'] as Range[]).map((r) => (
              <button key={r} type="button" className={segCls} style={seg(range === r)} aria-pressed={range === r} onClick={() => setRange(r)}>
                {t(r === 'all' ? 'analytics.rangeAll' : r === 'month' ? 'analytics.rangeMonth' : 'analytics.rangeWeek')}
              </button>
            ))}
          </div>
        )}

        {a.dayCount === 0 ? (
          <p className="py-4 text-sm" style={{ color: 'hsl(var(--text-muted))' }}>{t('analytics.empty')}</p>
        ) : (
          <>
            <p className="text-xs" style={{ color: 'hsl(var(--text-muted))' }}>
              {t('analytics.subtitle', { n: String(a.dayCount) })}
            </p>

            {/* Daily-average split bars */}
            <div className="mt-1 flex flex-col gap-2.5">
              {cats.map((c) => (
                <div key={c}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5" style={{ color: 'hsl(var(--foreground))' }}>
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: CATEGORY_COLOR[c] }} />
                      {t(CAT_KEY[c])}
                    </span>
                    <span style={{ color: 'hsl(var(--text-muted))' }}>
                      {hPerDay(a.totalByCat[c])}{hUnit} · {pct(a.totalByCat[c])}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'hsl(var(--text-muted) / 0.12)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct(a.totalByCat[c])}%`, backgroundColor: CATEGORY_COLOR[c] }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Per-day trend strip (when 2+ days) */}
            {a.dayCount > 1 && (
              <section className="mt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--text-muted))' }}>
                  {t('analytics.trend')}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {a.perDay.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-xs" style={{ color: 'hsl(var(--text-muted))' }}>
                        {sources[i]?.label}
                      </span>
                      <div className="flex h-3 w-full overflow-hidden rounded" style={{ border: '1px solid hsl(var(--border))' }}>
                        {CATEGORY_ORDER.map((c) =>
                          d.minutes[c] > 0 ? (
                            <div key={c} style={{ width: `${(d.minutes[c] / 1440) * 100}%`, backgroundColor: CATEGORY_COLOR[c] }} />
                          ) : null,
                        )}
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
      </DialogContent>
    </Dialog>
  );
}
