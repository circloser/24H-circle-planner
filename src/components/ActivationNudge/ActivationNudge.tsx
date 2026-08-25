import { useEffect, useRef, useState } from 'react';
import { BellRing, Smartphone, X } from 'lucide-react';
import { toast } from 'sonner';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { useIsMobile } from '@/hooks/useIsMobile';
import { track } from '@/lib/track';

/** Dismissed for this session only — if they still haven't activated, nudge
 *  again next session (but never twice in one). */
const DISMISS_KEY = '24h-aha-nudge-dismissed';
const SHOWN_KEY = '24h-aha-nudge-shown';

/**
 * The activation nudge: the moment a user has MADE the schedule theirs (first
 * edit) but hasn't reached the aha (alarms on the phone), point them straight at
 * it. Mobile → one-tap "turn on alarms"; desktop → "send to phone" (QR), since
 * the alarm value lives on the phone. Shown once per session, dismissible.
 */
export function ActivationNudge({ onSendToPhone }: { onSendToPhone: () => void }) {
  const { t } = useTranslation();
  const { prefs, setPreference } = usePreferences();
  const isMobile = useIsMobile();
  const edited = useStoreSelector((s) => s.history.past.length > 0);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const shownRef = useRef(false);

  const notifBlocked = typeof Notification === 'undefined' || Notification.permission === 'denied';
  // Mobile with notifications blocked → the alarm CTA can't work, so skip.
  const visible = edited && !prefs.sliceAlarms && !dismissed && !(isMobile && notifBlocked);

  useEffect(() => {
    if (!visible || shownRef.current) return;
    shownRef.current = true;
    try {
      if (sessionStorage.getItem(SHOWN_KEY) !== '1') {
        sessionStorage.setItem(SHOWN_KEY, '1');
        track('aha_nudge_shown', { device: isMobile ? 'mobile' : 'desktop' });
      }
    } catch {
      track('aha_nudge_shown', { device: isMobile ? 'mobile' : 'desktop' });
    }
  }, [visible, isMobile]);

  if (!visible) return null;

  const close = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const enableAlarms = async () => {
    if (notifBlocked) {
      toast(t('settings.alarmPermDenied'));
      return;
    }
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    track('notif_permission', { result: p });
    if (p === 'granted') {
      setPreference('sliceAlarms', true);
      track('alarm_enable', { type: 'slice' });
      track('aha_nudge_action', { action: 'alarm' });
      toast.success(t('aha.enabled'));
    } else {
      toast(t('settings.alarmPermDenied'));
    }
  };

  const sendToPhone = () => {
    track('aha_nudge_action', { action: 'phone' });
    onSendToPhone();
  };

  return (
    <div className="container mx-auto px-3 pt-2 sm:px-4">
      <div
        role="status"
        className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm"
      >
        <BellRing className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 text-foreground">
          {isMobile ? t('aha.mobileText') : t('aha.desktopText')}
        </span>
        {isMobile ? (
          <button
            type="button"
            onClick={enableAlarms}
            className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {t('aha.enableAlarms')}
          </button>
        ) : (
          <button
            type="button"
            onClick={sendToPhone}
            className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Smartphone className="h-3.5 w-3.5" />
            {t('aha.sendToPhone')}
          </button>
        )}
        <button
          type="button"
          onClick={close}
          aria-label={t('common.close')}
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-black/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
