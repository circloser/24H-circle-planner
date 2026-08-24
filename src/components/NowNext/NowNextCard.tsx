import { useNow } from '@/components/ClockTools/clock-utils';
import { useTranslation } from '@/hooks/usePreferences';
import { translateLabel } from '@/i18n/content';
import { computeNowNext } from '@/lib/now-next';
import type { TimeSlice } from '@/types/time-slice';

/** Human duration: "1시간 20분" / "1h 20m" (drops a zero part). */
function fmtDur(min: number, lang: string): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ko = lang.toLowerCase().startsWith('ko');
  if (h > 0) return ko ? (m > 0 ? `${h}시간 ${m}분` : `${h}시간`) : m > 0 ? `${h}h ${m}m` : `${h}h`;
  return ko ? `${m}분` : `${m}m`;
}

const hhmm = (s: string) => (s === '24:00' ? '00:00' : s);

/**
 * The "Now & Next" content: the timetable block you're in right now (icon, name,
 * time range, time left + progress) and the one coming up. Ticks itself every
 * second so the remaining time and bar stay live. Shared by the floating widget
 * and the /widget window.
 */
export function NowNextCard({ slices }: { slices: readonly TimeSlice[] }) {
  const { t, lang } = useTranslation();
  const now = useNow(true);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const { current, next, elapsedMin, remainingMin, progress } = computeNowNext(slices, minutes);

  if (!current) {
    return <p className="text-sm text-muted-foreground">{t('nownext.empty')}</p>;
  }

  const untitled = t('alarm.untitled');
  const curLabel = current.label ? translateLabel(current.label, lang) : untitled;
  const nextLabel = next ? (next.label ? translateLabel(next.label, lang) : untitled) : null;

  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('nownext.now')}</p>
      <div className="mt-0.5 flex items-center gap-2">
        {current.icon ? (
          <span className="shrink-0 text-xl" aria-hidden>{current.icon}</span>
        ) : (
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: current.color }} aria-hidden />
        )}
        <span className="truncate text-lg font-bold text-foreground">{curLabel}</span>
      </div>
      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
        {hhmm(current.startTime)}–{hhmm(current.endTime)}
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {t('nownext.elapsed', { d: fmtDur(elapsedMin, lang) })} · {t('nownext.left', { d: fmtDur(remainingMin, lang) })}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      {next && (
        <div className="mt-2.5 border-t border-border pt-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('nownext.next')}</p>
          <div className="mt-0.5 flex items-center gap-2">
            {next.icon ? (
              <span className="shrink-0" aria-hidden>{next.icon}</span>
            ) : (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: next.color }} aria-hidden />
            )}
            <span className="truncate text-sm font-semibold text-foreground">{nextLabel}</span>
            <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{hhmm(next.startTime)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
