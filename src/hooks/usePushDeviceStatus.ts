import { useCallback, useEffect, useState } from 'react';
import { usePreferences } from '@/hooks/usePreferences';

/**
 * Whether THIS device still needs notification permission for alarms the user
 * has already turned on. `pushAlarms`/`sliceAlarms` are synced prefs, so enabling
 * on one device makes the toggle read "on" everywhere — but each device must
 * grant its own OS notification permission (and, after an app reinstall on
 * Android, that permission resets). This surfaces that silent gap so a banner can
 * offer a one-tap fix on the device that's actually missing permission.
 */
export interface PushDeviceStatus {
  /** An alarm pref is on, but this device hasn't granted notification permission. */
  needsEnable: boolean;
  /** Permission is blocked ('denied') — a button can't re-prompt; guide to settings. */
  denied: boolean;
  /** Re-read the permission state (call after requesting it). */
  refresh: () => void;
}

function permState(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export function usePushDeviceStatus(): PushDeviceStatus {
  const { prefs } = usePreferences();
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(permState);

  const refresh = useCallback(() => setPerm(permState()), []);

  // Re-check when returning to the app (permission may have changed in OS/site settings).
  useEffect(() => {
    const on = () => refresh();
    window.addEventListener('focus', on);
    document.addEventListener('visibilitychange', on);
    return () => {
      window.removeEventListener('focus', on);
      document.removeEventListener('visibilitychange', on);
    };
  }, [refresh]);

  const wantsAlarms = !!prefs.pushAlarms || !!prefs.sliceAlarms;
  return {
    needsEnable: wantsAlarms && perm !== 'granted' && perm !== 'unsupported',
    denied: perm === 'denied',
    refresh,
  };
}
