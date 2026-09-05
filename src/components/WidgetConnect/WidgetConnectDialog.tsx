import { useEffect, useRef, useState } from 'react';
import { Loader2, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useChartView, useNowLineStyle, useTranslation } from '@/hooks/usePreferences';
import { viewSpec } from '@/lib/chart-view';
import {
  clearWidgetToken,
  deleteWidgetSlot,
  ensureWidgetToken,
  isDarkTheme,
  publishWidget,
  readWidgetToken,
  widgetMeta,
} from '@/lib/widget/publish';
import { track } from '@/lib/track';
import { toast } from 'sonner';

/**
 * Android home-screen widget hookup (shown only inside the Play Store TWA).
 *
 * The native widget can't read the web app's storage, so the bridge is a
 * server slot keyed by a secret token this phone generates once. Opening the
 * dialog (re)publishes the current ring to that slot, and the button navigates
 * to houring24://widget?token=… — an intent the Android app catches to
 * remember which slot its widget should poll. The publish happens on OPEN so
 * the button click stays a synchronous user-gesture navigation (Chrome blocks
 * external-protocol launches without one). After that, useWidgetPublisher
 * keeps the slot fresh on every edit — no reconnecting needed.
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
  const view = useChartView();
  const nowLine = useNowLineStyle();
  const [status, setStatus] = useState<'preparing' | 'ready' | 'error'>('preparing');
  const [linked, setLinked] = useState<boolean>(() => !!readWidgetToken());
  const [unlinking, setUnlinking] = useState(false);
  const runRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const run = ++runRef.current;
    setStatus('preparing');
    setLinked(!!readWidgetToken());
    void (async () => {
      const token = ensureWidgetToken();
      const svg = svgRef.current;
      const ok = svg ? await publishWidget(svg, token, widgetMeta(viewSpec(view), nowLine.color, isDarkTheme())) : false;
      if (runRef.current !== run) return; // dialog re-opened meanwhile
      setStatus(ok ? 'ready' : 'error');
    })();
    // Re-render the snapshot each time the dialog opens (not on every edit —
    // the publisher hook handles edits).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function connect() {
    const token = readWidgetToken();
    if (!token) return;
    track('widget_connect');
    // Caught by the Android app's WidgetLinkActivity (scheme houring24).
    window.location.href = `houring24://widget?token=${token}`;
    setLinked(true);
  }

  async function unlink() {
    const token = readWidgetToken();
    if (!token) return;
    setUnlinking(true);
    const ok = await deleteWidgetSlot(token);
    setUnlinking(false);
    if (!ok) {
      toast.error(t('homewidget.fail'));
      return;
    }
    clearWidgetToken();
    setLinked(false);
    setStatus('preparing');
    track('widget_unlink');
    toast.success(t('homewidget.unlinked'));
    onOpenChange(false);
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

        <p className="text-sm text-muted-foreground">{linked ? t('homewidget.connected') : t('homewidget.desc')}</p>

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
          {status === 'preparing' ? t('homewidget.preparing') : linked ? t('homewidget.reconnect') : t('homewidget.connect')}
        </Button>

        {linked ? (
          <Button variant="outline" onClick={() => void unlink()} disabled={unlinking} className="w-full">
            {unlinking ? <Loader2 className="h-4 w-4 animate-spin" /> : t('homewidget.unlink')}
          </Button>
        ) : null}

        <p className="text-[11px] leading-snug text-muted-foreground">{t('homewidget.privacy')}</p>
      </DialogContent>
    </Dialog>
  );
}
