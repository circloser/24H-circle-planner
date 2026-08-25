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

/** Public Play Store listing for the Android app. */
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.houring24.app';

/** Running as an installed standalone (PWA/home-screen or iOS standalone)? */
export function isStandalone(): boolean {
  try {
    if (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches) return true;
    if (typeof navigator !== 'undefined' && (navigator as { standalone?: boolean }).standalone === true) return true;
  } catch {
    /* matchMedia unavailable */
  }
  return false;
}

/** iOS device (iPhone/iPad/iPod), including iPadOS 13+ which reports as Mac. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
}

/** Should we promote the Android app here? No when we're already INSIDE it, and
 *  no when running as an installed standalone (they clearly have an app). */
export function canPromoteApp(): boolean {
  if (isPlayStoreApp()) return false;
  try {
    if (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches) return false;
    if (typeof navigator !== 'undefined' && (navigator as { standalone?: boolean }).standalone) return false;
  } catch {
    /* matchMedia unavailable → fine to promote */
  }
  return true;
}
