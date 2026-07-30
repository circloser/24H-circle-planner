/** Payload for the in-app slice-start popup (SliceAlarmPopup renders it). */
export interface SliceAlarmDetail {
  title: string;
  body: string;
}

/** Window event name the in-app slice-start popup listens on. */
export const SLICE_ALARM_EVENT = 'slice-alarm';

/**
 * Show the in-app slice-start popup — a DOM card the app renders itself, so it
 * appears even when OS notification permission is off and the OS can't suppress
 * or reposition it (bottom-right, always-on-top in-page, auto-dismiss). Only
 * visible while the tab is on screen — the OS notification covers backgrounded
 * tabs, so the two together give full coverage.
 */
export function fireSliceAlarmPopup(detail: SliceAlarmDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SliceAlarmDetail>(SLICE_ALARM_EVENT, { detail }));
}

/**
 * Show a local notification the way each platform allows. Mobile Chrome /
 * Android (incl. the installed TWA) FORBID the `new Notification()` constructor
 * — it throws "Illegal constructor" — so prefer the service worker's
 * `showNotification()` (works on mobile AND desktop) and fall back to the
 * constructor only where no SW is registered (e.g. the offline file:// build).
 * `getRegistration()` is used rather than `.ready` because `.ready` never
 * resolves when there is no SW at all.
 *
 * Returns true if a notification was shown (or at least dispatched without
 * throwing) — used by the settings "test notification" button to surface a
 * clear failure when nothing can be shown.
 */
export async function fireNotification(
  title: string,
  options: NotificationOptions = {},
): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, options);
        return true;
      }
    }
  } catch {
    // SW notification unavailable — fall through to the page-level constructor
  }
  try {
    new Notification(title, options);
    return true;
  } catch {
    // desktop-only API; on mobile the constructor throws — nothing more to do
    return false;
  }
}
