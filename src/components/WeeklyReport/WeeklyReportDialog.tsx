import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRecords } from '@/hooks/useRecords';
import { dateKey } from '@/hooks/useDiary';
import { useTranslation } from '@/hooks/usePreferences';
import { weeklyReport } from '@/lib/weekly-report';

function fmtMin(min: number, lang: string): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ko = lang.toLowerCase().startsWith('ko');
  if (h > 0) return ko ? (m > 0 ? `${h}시간 ${m}분` : `${h}시간`) : m > 0 ? `${h}h ${m}m` : `${h}h`;
  return ko ? `${m}분` : `${m}m`;
}

interface WeeklyReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Span = 7 | 30;

/**
 * Weekly / monthly report over ACTUAL records (record mode). Reads the record
 * history (`byDate`) for the last 7 or 30 calendar days and shows accumulated
 * time trends: a totals line, a per-day bar strip, and a per-label split. Free
 * (not Pro-gated) — this is the retention loop's "your data adds up" surface.
 */
export function WeeklyReportDialog({ open, onOpenChange }: WeeklyReportDialogProps) {
  const { t, lang } = useTranslation();
  const { byDate } = useRecords();
  const [span, setSpan] = useState<Span>(7);
  const today = dateKey();
  const r = useMemo(() => weeklyReport(byDate, today, span), [byDate, today, span]);
  const fmt = (m: number) => fmtMin(m, lang);

  const seg = (active: boolean): React.CSSProperties =>
    active
      ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: '1px solid hsl(var(--primary))' }
      : { backgroundColor: 'hsl(var(--surface))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' };
  const segCls = 'rounded-full px-3 py-1 text-xs font-medium transition-colors';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('weekly.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {([7, 30] as Span[]).map((s) => (
            <button key={s} type="button" className={segCls} style={seg(span === s)} aria-pressed={span === s} onClick={() => setSpan(s)}>
              {t(s === 7 ? 'weekly.span7' : 'weekly.span30')}
            </button>
          ))}
        </div>

        {r.total === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{t('weekly.empty')}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {t('weekly.totals', { total: fmt(r.total), n: String(r.activeDays), avg: fmt(r.avgPerActiveDay) })}
            </p>

            {/* Per-day bar strip — one row per calendar day (empty days show a flat track). */}
            <section className="mt-1">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('weekly.perDay')}</h3>
              <div className="flex flex-col gap-1.5">
                {r.days.map((d) => (
                  <div key={d.date} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">{d.label}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted-foreground/12">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{ width: r.maxDay > 0 ? `${(d.minutes / r.maxDay) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="w-14 shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground">
                      {d.minutes > 0 ? fmt(d.minutes) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Per-label split across the window. */}
            {r.byLabel.length > 0 && (
              <section className="mt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('weekly.byLabel')}</h3>
                <div className="flex flex-col gap-2.5">
                  {r.byLabel.map((it) => (
                    <div key={it.key}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-1.5 text-foreground">
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: it.color }} />
                          <span className="truncate">{it.label || t('analytics.untitled')}</span>
                        </span>
                        <span className="shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">
                          {fmt(it.minutes)} · {it.pct}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted-foreground/12">
                        <div className="h-full rounded-full" style={{ width: `${it.pct}%`, backgroundColor: it.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
