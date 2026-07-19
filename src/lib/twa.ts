/**
 * Detect the Google Play (TWA) build of the app.
 *
 * Play policy: digital goods sold inside a Play-distributed app must use Play
 * Billing — so the TWA must not show the Polar checkout (or even steer to an
 * external purchase). The web app is unchanged; inside the TWA the upgrade
 * dialog turns informational (see UpgradeDialog).
 *
 * Detection: on the FIRST navigation a TWA sets `document.referrer` to
 * `android-app://<package>`; we persist that in sessionStorage because the
 * referrer disappears on subsequent in-app navigations/reloads.
 */
const KEY = '24h-twa';

export function isPlayStoreApp(): boolean {
  try {
    if (sessionStorage.getItem(KEY) === '1') return true;
    if (typeof document !== 'undefined' && document.referrer.startsWith('android-app://')) {
      sessionStorage.setItem(KEY, '1');
      return true;
    }
  } catch {
    /* storage unavailable → treat as web */
  }
  return false;
}
