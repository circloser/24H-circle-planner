import { useEffect, useRef } from 'react';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { enablePush, uploadPushPlan, pushSupported } from '@/lib/push';

/** Min gap between foreground-wake push refreshes — rapid focus flips must not
 *  hammer the server; a real reopen is minutes apart. */
const WAKE_REFRESH_MS = 60_000;

function granted(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

/**
 * Keeps the Pro closed-tab alarms in sync while enabled: makes sure this
 * device is subscribed and (debounced) re-uploads the boundary plan whenever
 * the active schedule changes. Enable/disable side effects (permission ask,
 * server cleanup) live in the Settings toggle — this hook only maintains.
 */
export function usePushAlarms(): void {
  const slices = useStoreSelector((s) => s.history.present.slices);
  const { prefs } = usePreferences();
  const { user, plan } = useAuth();
  const { t } = useTranslation();
  const active = prefs.pushAlarms && plan === 'pro' && !!user && pushSupported();

  const untitledRef = useRef(t('alarm.untitled'));
  useEffect(() => {
    untitledRef.current = t('alarm.untitled');
  }, [t]);

  // Latest schedule for the wake handler — its listener is registered once per
  // `active` change, so it must read slices through a ref, not a stale closure.
  const slicesRef = useRef(slices);
  useEffect(() => {
    slicesRef.current = slices;
  }, [slices]);

  // Ensure this device's subscription exists whenever the feature is active
  // (permission may have been granted on another visit; enablePush is
  // idempotent and silently no-ops without permission).
  useEffect(() => {
    if (!active) return;
    if (!granted()) return;
    void enablePush();
  }, [active]);

  // Debounced plan upload on schedule changes.
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => {
      void uploadPushPlan(slices, untitledRef.current);
    }, 1500);
    return () => window.clearTimeout(id);
  }, [active, slices]);

  // Foreground-return self-heal: on every focus / tab-visible, re-assert this
  // device's subscription (push endpoints silently rotate or get pruned on a
  // 410, which quietly kills alarms) and re-upload the plan. So simply reopening
  // the app repairs alarms that would otherwise have gone silent. Throttled.
  useEffect(() => {
    if (!active) return;
    if (!granted()) return;
    let last = 0;
    const onWake = () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - last < WAKE_REFRESH_MS) return;
      last = now;
      void enablePush().then((ok) => {
        if (ok) void uploadPushPlan(slicesRef.current, untitledRef.current);
      });
    };
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    return () => {
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [active]);
}
