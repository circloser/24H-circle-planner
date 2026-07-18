import { useEffect, useRef } from 'react';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { enablePush, uploadPushPlan, pushSupported } from '@/lib/push';

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

  // Ensure this device's subscription exists whenever the feature is active
  // (permission may have been granted on another visit; enablePush is
  // idempotent and silently no-ops without permission).
  useEffect(() => {
    if (!active) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
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
}
