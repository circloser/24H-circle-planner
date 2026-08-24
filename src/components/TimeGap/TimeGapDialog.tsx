import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { useRecords } from '@/hooks/useRecords';
import { useTranslation } from '@/hooks/usePreferences';
import { timeGap } from '@/lib/time-gap';

function fmtMin(min: number, lang: string): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ko = lang.toLowerCase().startsWith('ko');
  if (h > 0) return ko ? (m > 0 ? `${h}시간 ${m}분` : `${h}시간`) : m > 0 ? `${h}h ${m}m` : `${h}h`;
  return ko ? `${m}분` : `${m}m`;
}

interface TimeGapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Plan vs actual (today)" — joins the current schedule's labeled blocks (planned
 * minutes) with today's record-mode log (actual minutes) by label, and shows the
 * gap per activity. Neutral framing: it reports the difference, never judges.
 */
export function TimeGapDialog({ open, onOpenChange }: TimeGapDialogProps) {
  const { t, lang } = useTranslation();
  const slices = useStoreSelector((s) => s.history.present.slices);
  const { records } = useRecords();
  const g = useMemo(() => timeGap(slices, records), [slices, records]);
  const fmt = (m: number) => fmtMin(m, lang);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('timegap.title')}</DialogTitle>
        </DialogHeader>

        {g.actualTotal === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{t('timegap.empty')}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {t('timegap.totals', { a: fmt(g.actualTotal), p: fmt(g.plannedTotal) })}
            </p>

            <div className="mt-1 flex flex-col gap-2.5">
              {g.planned.map((r) => (
                <div key={r.key}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5 text-foreground">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className="truncate">{r.label || t('analytics.untitled')}</span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">
                      {t('timegap.metric', { a: fmt(r.actual), p: fmt(r.planned) })} · {r.pct}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted-foreground/12">
                    <div
                      className="h-full rounded-full transition-[width] duration-300"
                      style={{ width: `${Math.min(100, r.pct ?? 0)}%`, backgroundColor: r.color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {g.unplanned.length > 0 && (
              <>
                <p className="mt-4 text-xs font-medium text-muted-foreground">{t('timegap.unplanned')}</p>
                <div className="mt-1 flex flex-col gap-1.5 text-sm">
                  {g.unplanned.map((r) => (
                    <div key={r.key} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-foreground">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                        <span className="truncate">{r.label || t('analytics.untitled')}</span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">{fmt(r.actual)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
