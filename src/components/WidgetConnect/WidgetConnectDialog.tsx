import { useEffect, useRef, useState } from 'react';
import { Loader2, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createServerShareUrl } from '@/lib/share-link';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { useTranslation } from '@/hooks/usePreferences';
import { track } from '@/lib/track';

/**
 * Android home-screen widget hookup (shown only inside the Play Store TWA).
 *
 * The native widget can't read the web app's storage, so the bridge is a
 * server-stored share: opening this dialog renders the current ring to a
 * square PNG and stores it (same /api/share used by link sharing), then the
 * button navigates to houring24://widget?id=… — an intent the Android app
 * catches to remember which share its widget should display. The share
 * creation happens on OPEN so the button click stays a synchronous
 * user-gesture navigation (Chrome blocks external-protocol launches without
 * one). Re-opening and reconnecting refreshes the widget after edits.
 */
export function WidgetConnectDialog({
  open,
  onOpenChange,
  svgRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}) {
  const { t } = useTranslation();
  const present = useStoreSelector((s) => s.history.present);
  const [status, setStatus] = useState<'preparing' | 'ready' | 'error'>('preparing');
  const [shareId, setShareId] = useState<string | null>(null);
  const runRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const run = ++runRef.current;
    setStatus('preparing');
    setShareId(null);
    void (async () => {
      const png = svgRef.current
        ? await import('@/lib/export/ogImage').then((m) => m.buildSquarePngBase64(svgRef.current!)).catch(() => null)
        : null;
      const url = await createServerShareUrl(present, undefined, png ?? undefined);
      if (runRef.current !== run) return; // dialog re-opened meanwhile
      const id = url?.split('/').pop() ?? null;
      setShareId(id);
      setStatus(id ? 'ready' : 'error');
    })();
    // Re-render the snapshot each time the dialog opens (not on every edit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function connect() {
    if (!shareId) return;
    track('widget_connect');
    // Caught by the Android app's WidgetLinkActivity (scheme houring24).
    window.location.href = `houring24://widget?id=${shareId}`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            {t('homewidget.title')}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{t('homewidget.desc')}</p>

        <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
          <li>{t('homewidget.step1')}</li>
          <li>{t('homewidget.step2')}</li>
          <li>{t('homewidget.step3')}</li>
        </ol>

        {status === 'error' ? (
          <p className="text-sm text-destructive">{t('homewidget.fail')}</p>
        ) : null}

        <Button onClick={connect} disabled={status !== 'ready'} className="w-full gap-2">
          {status === 'preparing' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {status === 'preparing' ? t('homewidget.preparing') : t('homewidget.connect')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
