import { useEffect, useRef } from 'react';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { dateKey } from '@/hooks/useDiary';
import { currentSliceAt } from '@/lib/sliceAlarm';
import { fireNotification, fireSliceAlarmPopup } from '@/lib/notify';
import { playBeep } from '@/components/ClockTools/clock-utils';

/** Last boundary we notified for — device-local ON PURPOSE (notification
 *  permission and delivery are per-device; syncing this would suppress alarms
 *  on the other device). `${yyyy-mm-dd}|${startTime}`. */
const LAST_KEY = '24h-circle-planner.last-alarm';

/**
 * "The timetable IS the alarm": while the tab is open (foreground or
 * background), crossing into the next slice of the ACTIVE schedule fires a
 * browser notification (+ a soft beep). Gated on the synced `sliceAlarms`
 * preference AND this device's Notification permission.
 *
 * Background tabs get their timers throttled to ~1/min by the browser — the
 * check compares absolute wall-clock time against slice boundaries, so a late
 * tick still fires the right (single) notification, at worst ~a minute late.
 * True closed-tab alarms need Web Push (the planned Pro tier), not this hook.
 */
export function useSliceAlarms(): void {
  const slices = useStoreSelector((s) => s.history.present.slices);
  const { prefs } = usePreferences();
  const { t } = useTranslation();
  const enabled = prefs.sliceAlarms;
  // Latest values for the long-lived interval without re-subscribing each edit.
  const slicesRef = useRef(slices);
  useEffect(() => {
    slicesRef.current = slices;
  }, [slices]);
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // {ring signature, current slice start} last observed. A notification fires
  // ONLY when the SAME ring's current slice changes — any ring change (mount,
  // async store restore, preset/template load, an edit that moves a boundary)
  // re-baselines silently. Without the signature check, the async schedule
  // restore right after page load looked like a slice transition and notified
  // the slice you were already in, on every open.
  const lastRef = useRef<{ sig: string; start: string } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    lastRef.current = null; // (re)enabling starts from a silent baseline

    const tick = () => {
      try {
        const now = new Date();
        const slices = slicesRef.current;
        const cur = currentSliceAt(slices, now.getHours() * 60 + now.getMinutes());
        if (!cur) {
          lastRef.current = null;
          return;
        }
        const sig = slices.map((s) => s.startTime).sort().join(',');
        const slot = `${dateKey(now)}|${cur.startTime}`; // reload-dedupe id
        if (!lastRef.current || lastRef.current.sig !== sig) {
          lastRef.current = { sig, start: cur.startTime }; // silent (re)baseline
          localStorage.setItem(LAST_KEY, slot);
          return;
        }
        if (lastRef.current.start === cur.startTime) return; // still inside (midnight-safe: start doesn't change)
        lastRef.current = { sig, start: cur.startTime };
        if (localStorage.getItem(LAST_KEY) === slot) return; // a reload straight after the boundary
        localStorage.setItem(LAST_KEY, slot);
        const title = `${cur.icon ? cur.icon + ' ' : ''}${cur.label || tRef.current('alarm.untitled')}`;
        const body = `${cur.startTime}–${cur.endTime}`;
        // In-app popup + beep fire regardless of OS notification permission —
        // an in-page card can't be blocked by the OS, so the alarm is visible
        // even when the browser/app notification permission was never granted.
        fireSliceAlarmPopup({ title, body });
        playBeep(2);
        // The OS notification additionally reaches a BACKGROUNDED tab / the phone
        // shade, but only when permission is granted.
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          void fireNotification(title, {
            body,
            tag: 'slice-start', // consecutive boundaries replace, never stack
            icon: '/icon-192.png',
            // Keep the current block pinned in the shade until it's replaced by
            // the next boundary (same tag) or dismissed — so "what am I doing
            // now" stays glanceable, not a toast that vanishes in a few seconds.
            requireInteraction: true,
          });
        }
      } catch {
        // notifications are best-effort — never break the app
      }
    };

    tick(); // baseline the slice we're currently in
    const iv = window.setInterval(tick, 15_000);
    const onWake = () => tick(); // throttled background tab → catch up on focus
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [enabled]);
}
