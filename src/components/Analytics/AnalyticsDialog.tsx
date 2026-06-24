import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AdSlot } from '@/components/Ads/AdSlot';
import { useDays } from '@/hooks/useDays';
import { useTranslation } from '@/hooks/usePreferences';
import { analyzeDays, CATEGORY_ORDER, CATEGORY_COLOR, type CategoryKey } from '@/lib/analytics';

interface AnalyticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CAT_KEY: Record<CategoryKey, 'cat.sleep' | 'cat.work' | 'cat.meal' | 'cat.leisure' | 'cat.commute' | 'cat.other'> = {
  sleep: 'cat.sleep',
  work: 'cat.work',
  meal: 'cat.meal',
  leisure: 'cat.leisure',
  commute: 'cat.commute',
  other: 'cat.other',
};

/**
 * Time analysis — categorises every day's blocks into life buckets (sleep /
 * work / meal / leisure / commute / other) and shows the daily-average split
 * plus a per-day trend strip. Turns the planner into something worth returning to.
 */
export function AnalyticsDialog({ open, onOpenChange }: AnalyticsDialogProps) {
  const { days } = useDays();
  const { t, lang } = useTranslation();
  const a = useMemo(() => analyzeDays(days), [days]);

  const totalMin = a.dayCount * 1440 || 1;
  const cats = CATEGORY_ORDER.filter((c) => a.totalByCat[c] > 0).sort(
    (x, y) => a.totalByCat[y] - a.totalByCat[x],
  );
  const hUnit = lang === 'ko' ? '시간' : 'h';
  const hPerDay = (min: number) => (min / a.dayCount / 60).toFixed(1);
  const pct = (min: number) => Math.round((min / totalMin) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('analytics.title')}</DialogTitle>
        </DialogHeader>

        {a.dayCount === 0 ? (
          <p className="text-sm" style={{ color: 'hsl(var(--text-muted))' }}>{t('analytics.empty')}</p>
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

            {/* Per-day trend (multi-day only) */}
            {a.dayCount > 1 && (
              <section className="mt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--text-muted))' }}>
                  {t('analytics.trend')}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {a.perDay.map((d) => (
                    <div key={d.n} className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-xs" style={{ color: 'hsl(var(--text-muted))' }}>
                        {t('day.thumb', { m: String(d.n) })}
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
