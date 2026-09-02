import { useEffect, useRef } from 'react';
import { useLiveDaySlices } from '@/hooks/useLiveDaySlices';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { dateKey } from '@/hooks/useDiary';
import { currentSliceAt } from '@/lib/sliceAlarm';
import { fireNotification, fireSliceAlarmPopup } from '@/lib/notify';
import { playBeep } from '@/components/ClockTools/clock-utils';

/** Last chime we fired — device-local (like the slice alarm): notification
 *  permission/delivery is per-device. `${yyyy-mm-dd}|${HH:MM}`. */
const LAST_KEY = '24h-circle-planner.last-chime';

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Recurring time chime while the tab is open: every `chimeEvery` minutes aligned
 * to midnight (60 = on the hour, "정각"), fire a soft beep + notification with
 * the time (and the block you're in). Free and in-tab only — the Pro closed-app
 * version rides on the uploaded push plan (see uploadPushPlan). Background tabs
 * are throttled to ~1/min, so a chime may land up to a minute late but never
 * doubles (deduped per local HH:MM).
 */
export function useChimes(): void {
  // The chime is a clock, so it keeps ringing while a saved/diary day is open —
  // but the block name it announces comes from the LIVE day or not at all
  // (useLiveDaySlices), never from the day being browsed.
  const slices = useLiveDaySlices();
  const { prefs } = usePreferences();
  const { t, lang } = useTranslation();
  const every = prefs.chimeEvery;

  const slicesRef = useRef(slices);
  useEffect(() => {
    slicesRef.current = slices;
  }, [slices]);
  const tRef = useRef(t);
  const langRef = useRef(lang);
  useEffect(() => {
    tRef.current = t;
    langRef.current = lang;
  });

  useEffect(() => {
    if (!every) return;

    const tick = () => {
      try {
        const now = new Date();
        const minuteOfDay = now.getHours() * 60 + now.getMinutes();
        if (minuteOfDay % every !== 0) return; // not an aligned minute
        const hhmm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
        const slot = `${dateKey(now)}|${hhmm}`;
        if (localStorage.getItem(LAST_KEY) === slot) return; // already chimed this minute
        localStorage.setItem(LAST_KEY, slot);

        const live = slicesRef.current;
        const cur = live ? currentSliceAt(live, minuteOfDay) : null;
        const title = `🔔 ${hhmm}`;
        const body = cur && cur.label ? cur.label : tRef.current('chime.body');
        fireSliceAlarmPopup({ title, body });
        playBeep(2);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          void fireNotification(title, { body, tag: 'slice-start', icon: '/icon-192.png', requireInteraction: true });
        }
      } catch {
        // best-effort — never break the app
      }
    };

    // Check often enough to catch the aligned minute even with some throttling.
    const iv = window.setInterval(tick, 15_000);
    tick();
    const onWake = () => tick();
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [every]);
}
