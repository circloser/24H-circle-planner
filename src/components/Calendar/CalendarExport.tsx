import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';
import { downloadBlob } from '@/lib/share';
import { track } from '@/lib/track';
import type { YearMonth } from '@/lib/calendar-grid';

/**
 * Calendar export: the header's 내보내기 opens this while the calendar is
 * showing (the timetable export needs the chart, which is not on screen). Pick
 * one of the two months shown, see it, then save it or share it.
 */
export function CalendarExportDialog({ open, onOpenChange, months, label, keyOf, make }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  months: YearMonth[];
  label: (m: YearMonth) => string;
  keyOf: (m: YearMonth) => string;
  /** Draw a month; `scale` 1 is 1080 px wide. */
  make: (m: YearMonth, scale: number) => Promise<Blob>;
}) {
  const { t } = useTranslation();
  const [pick, setPick] = useState(0);
  const [shown, setShown] = useState<{ id: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const month = months[Math.min(pick, months.length - 1)];
  const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] });

  // A small preview of the chosen month.
  const monthId = month ? keyOf(month) : '';
  const preview = shown?.id === monthId ? shown.url : null;
  useEffect(() => {
    if (!open || !month) return;
    let live = true;
    let url: string | null = null;
    void make(month, 0.5).then((blob) => {
      if (!live) return;
      url = URL.createObjectURL(blob);
      setShown({ id: monthId, url });
    }).catch(() => { /* the buttons still work without a preview */ });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
    // `make` changes with every render of the calendar; the month and the
    // dialog being open are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, monthId]);

  const run = async (how: 'save' | 'share') => {
    if (!month || busy) return;
    setBusy(true);
    try {
      const blob = await make(month, 2);
      const name = `24houring-${keyOf(month)}.png`;
      if (how === 'share') {
        await navigator.share({
          files: [new File([blob], name, { type: 'image/png' })],
          title: '24Houring',
          text: t('calendar.imageShareText', { month: label(month) }),
        });
        track('cal_image', { outcome: 'shared' });
      } else {
        downloadBlob(blob, name);
        track('cal_image', { outcome: 'downloaded' });
        toast.success(t('calendar.imageSaved'));
      }
      onOpenChange(false);
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') track('cal_image', { outcome: 'cancelled' });
      else toast.error(t('calendar.imageError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-cal-export>
        <DialogHeader>
          <DialogTitle>{t('calendar.exportTitle')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">{t('calendar.exportMonth')}</span>
            {months.map((m, i) => (
              <button key={keyOf(m)} type="button" data-cal-export-month={keyOf(m)} aria-pressed={i === pick}
                onClick={() => setPick(i)}
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                  i === pick ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent/10'
                }`}>
                {label(m)}
              </button>
            ))}
          </div>
          <div className="grid min-h-[200px] place-items-center overflow-hidden rounded-lg border border-border bg-muted/30" data-cal-export-preview>
            {preview
              ? <img src={preview} alt={month ? label(month) : ''} className="block w-full" />
              : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground">{t('calendar.exportNote')}</p>
          <div className="flex flex-wrap justify-end gap-2">
            {canShare && (
              <Button variant="outline" disabled={busy} onClick={() => void run('share')} className="gap-1.5" data-cal-export-share>
                <Share2 className="h-4 w-4" />
                {t('calendar.exportShare')}
              </Button>
            )}
            <Button disabled={busy} onClick={() => void run('save')} className="gap-1.5 bg-primary text-primary-foreground" data-cal-export-save>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t('calendar.exportSave')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
