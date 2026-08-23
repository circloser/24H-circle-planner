import { useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { toast } from 'sonner';
import { usePushDeviceStatus } from '@/hooks/usePushDeviceStatus';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { enablePush, pushSupported } from '@/lib/push';

/**
 * A slim banner shown only when the user has an alarm turned on but THIS device
 * hasn't granted notification permission (the classic "planned on desktop / no
 * alarms on the reinstalled phone" gap). One tap requests permission and, for the
 * Pro closed-app push, subscribes this device. Dismissible for the session.
 */
export function EnablePushBanner() {
  const { needsEnable, denied, refresh } = usePushDeviceStatus();
  const { t } = useTranslation();
  const { prefs } = usePreferences();
  const { user, plan } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!needsEnable || dismissed) return null;

  const standalone =
    typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches;
  const deniedMsg = t(standalone ? 'settings.alarmPermDeniedApp' : 'settings.alarmPermDenied');

  const enable = async () => {
    if (denied) {
      toast(deniedMsg);
      return;
    }
    setBusy(true);
    try {
      const p =
        Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (p !== 'granted') {
        toast(deniedMsg);
        return;
      }
      // Pro closed-app push: register this device so the minute-cron can reach it.
      if (prefs.pushAlarms && plan === 'pro' && user && pushSupported()) {
        await enablePush();
      }
      toast.success(t('pushbanner.enabled'));
      refresh(); // permission now granted → banner hides
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto px-3 pt-2 sm:px-4">
      <div
        role="status"
        className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm"
      >
        <BellRing className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 text-foreground">{t('pushbanner.text')}</span>
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {t('pushbanner.enable')}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t('common.close')}
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-black/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
