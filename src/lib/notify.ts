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
