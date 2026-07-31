import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '@/hooks/usePreferences';
import { SLICE_ALARM_EVENT, type SliceAlarmDetail } from '@/lib/notify';

/** How long the popup stays before auto-dismissing. */
const VISIBLE_MS = 5000;

/**
 * In-app slice-start popup. When the timetable crosses into a new block,
 * useSliceAlarms fires a `slice-alarm` window event and this card appears at the
 * bottom-right (desktop) / bottom (mobile) for 5s, above everything else in the
 * page. Rendered by the app itself, so — unlike an OS notification — it shows
 * even when notification permission is off and the OS can neither suppress nor
 * reposition it. Mounted once at the app root.
 */
export function SliceAlarmPopup() {
  const { t } = useTranslation();
  const [alarm, setAlarm] = useState<SliceAlarmDetail | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    const onAlarm = (e: Event) => {
      const detail = (e as CustomEvent<SliceAlarmDetail>).detail;
      if (!detail) return;
      setAlarm(detail); // a newer boundary replaces the current card
      clear();
      timerRef.current = window.setTimeout(() => setAlarm(null), VISIBLE_MS);
    };
    window.addEventListener(SLICE_ALARM_EVENT, onAlarm);
    return () => {
      window.removeEventListener(SLICE_ALARM_EVENT, onAlarm);
      clear();
    };
  }, []);

  if (!alarm) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-slice-alarm
      style={{ zIndex: 10000 }}
      className="fixed bottom-4 left-1/2 flex h-72 w-72 -translate-x-1/2 flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-2xl duration-200 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 sm:left-auto sm:right-4 sm:h-80 sm:w-80 sm:translate-x-0"
    >
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={() => setAlarm(null)}
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-black/10"
      >
        <X className="h-4 w-4" />
      </button>
      <span aria-hidden className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-primary/15 text-4xl">
        🔔
      </span>
      <div className="min-w-0 max-w-full">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('alarm.started')}</p>
        <p className="mt-1 line-clamp-2 text-xl font-bold text-foreground">{alarm.title}</p>
        <p className="mt-1 text-sm tabular-nums text-muted-foreground">{alarm.body}</p>
      </div>
    </div>
  );
}
