/**
 * GA4 event tracking — thin, safe wrapper over the gtag loaded in index.html.
 *
 * gtag only exists on the deployed http(s) site (index.html skips local dev and
 * the offline single-file build), so `track` must be a silent no-op everywhere
 * else — never throw, never block the action being measured.
 *
 * Event vocabulary (keep this list the source of truth; params are flat strings):
 *  - login_start                        — Google sign-in begun
 *  - upgrade_open                       — paywall/upgrade dialog shown
 *  - checkout_start                     — Polar checkout begun
 *  - coupon_redeem                      — coupon code applied successfully
 *  - export           {format}          — png | pdf | json | …
 *  - share            {method}          — image | link
 *  - preset_load      {preset}          — built-in persona id or 'user'
 *  - schedule_import  {name}            — #p= link accepted (incl. template CTAs)
 */

type Gtag = (command: 'event', eventName: string, params?: Record<string, string | number | boolean>) => void;

export function track(event: string, params?: Record<string, string | number | boolean>): void {
  try {
    const g = (window as unknown as { gtag?: Gtag }).gtag;
    if (typeof g === 'function') g('event', event, params);
  } catch {
    // analytics must never break the app
  }
}
