import { Plus, X } from 'lucide-react';
import { slicePath } from '@/lib/svg-geometry';
import { useDays } from '@/hooks/useDays';
import { useTranslation } from '@/hooks/usePreferences';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';
import type { Schedule } from '@/types/schedule';

const THUMB = 46;

/** A tiny donut thumbnail of a day's schedule — wedges only, no labels/ticks. */
function DayThumb({ schedule, size }: { schedule: Schedule; size: number }) {
  return (
    <svg viewBox="0 0 1000 1000" width={size} height={size} style={{ display: 'block' }} aria-hidden="true">
      {schedule.slices.map((s) => (
        <path key={s.id} d={slicePath(s)} fill={s.color} />
      ))}
      {/* Hub fill so the centre reads as a clean disc, matching the main chart. */}
      <circle cx={500} cy={500} r={100} fill="hsl(var(--surface))" />
      <circle cx={500} cy={500} r={460} fill="none" stroke="hsl(var(--border) / 0.6)" strokeWidth={6} />
    </svg>
  );
}

/**
 * Multi-day switcher. Top-centre: a thumbnail per day (click to switch, × to
 * delete) plus a trailing + to add a day; when empty it is just the +. Bottom-
 * centre: a "Day M of N" indicator for the active day. Lets the chart hold a
 * whole trip or week of 24h plans.
 */
export function DayBar() {
  const { days, activeId, activeIndex, switchTo, addDay, deleteDay } = useDays();
  const { t } = useTranslation();
  const coarse = useCoarsePointer();

  const pill =
    'flex items-center gap-2 overflow-x-auto rounded-full px-2 py-1.5 shadow-md max-w-[88vw]';
  const pillStyle = {
    backgroundColor: 'hsl(var(--surface) / 0.92)',
    border: '1px solid hsl(var(--border))',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  } as React.CSSProperties;

  const roundBtn =
    'grid place-items-center rounded-full shrink-0 transition-transform hover:scale-105';

  return (
    <>
      {/* Top-centre day strip */}
      <div className="fixed left-1/2 top-16 z-20 -translate-x-1/2">
        <div className={pill} style={pillStyle}>
          {days.map((d, i) => {
            const isActive = d.id === activeId;
            return (
              <div key={d.id} className="group relative shrink-0">
                <button
                  type="button"
                  onClick={() => switchTo(d.id)}
                  aria-label={t('day.thumb', { m: String(i + 1) })}
                  aria-pressed={isActive}
                  className="block overflow-hidden rounded-full"
                  style={{
                    boxShadow: isActive ? '0 0 0 2px hsl(var(--primary))' : '0 0 0 1px hsl(var(--border))',
                  }}
                >
                  <DayThumb schedule={d.schedule} size={THUMB} />
                </button>
                {/* Delete is hidden when only one day remains — the last
                    schedule can't be removed. */}
                {days.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDay(d.id);
                    }}
                    aria-label={t('day.delete')}
                    title={t('day.delete')}
                    className={`absolute -right-1 -top-1 z-10 grid h-[18px] w-[18px] place-items-center rounded-full transition-opacity ${
                      coarse ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                    }`}
                    style={{
                      backgroundColor: 'hsl(var(--surface))',
                      color: 'hsl(var(--foreground))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={addDay}
            aria-label={t('day.add')}
            title={t('day.add')}
            className={roundBtn}
            style={{
              width: THUMB,
              height: THUMB,
              backgroundColor: 'hsl(var(--muted) / 0.6)',
              color: 'hsl(var(--foreground))',
              border: '1px dashed hsl(var(--border))',
            }}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Bottom-centre day indicator */}
      {days.length > 0 && activeIndex >= 0 && (
        <div
          className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium shadow"
          style={{
            backgroundColor: 'hsl(var(--surface) / 0.92)',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {t('day.indicator', { m: String(activeIndex + 1), n: String(days.length) })}
        </div>
      )}
    </>
  );
}
