import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { makeDragStart, useNow, type Pos } from './clock-utils';
import type { CalendarState } from './useClockTools';
import { useTranslation } from '@/hooks/usePreferences';

interface CalendarWidgetProps {
  calendar: CalendarState;
  onMove: (p: Pos) => void;
  onClose: () => void;
}

// Arrows reveal on hover only; they keep their layout space so the label never
// shifts. Inert (pointer-events-none) until the calendar is hovered.
const navBtn =
  'grid h-6 w-6 place-items-center rounded opacity-0 transition pointer-events-none hover:bg-black/10 group-hover:opacity-100 group-hover:pointer-events-auto';

/**
 * Floating mini calendar. Like the clock, only the calendar itself shows by
 * default (transparent); hovering reveals the box plus the Today/close controls.
 * Drag from the calendar body (the month nav buttons opt out).
 */
export function CalendarWidget({ calendar, onMove, onClose }: CalendarWidgetProps) {
  const { t, lang } = useTranslation();
  const today = useNow(true, 60_000); // keep "today" correct across midnight
  const [view, setView] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }));

  const first = new Date(view.y, view.m, 1);
  const startOffset = first.getDay(); // 0 = Sunday
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const monthLabel = first.toLocaleDateString(lang, { year: 'numeric', month: 'long' });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 7 + i).toLocaleDateString(lang, { weekday: 'narrow' }),
  );
  const cells: Array<number | null> = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const isToday = (d: number) =>
    view.y === today.getFullYear() && view.m === today.getMonth() && d === today.getDate();
  const shift = (delta: number) =>
    setView(({ y, m }) => {
      const nm = m + delta;
      return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });

  return (
    <div className="group" style={{ position: 'fixed', left: calendar.pos.x, top: calendar.pos.y, width: 232, zIndex: 25 }}>
      {/* Box — fades in only on hover (clean calendar by default). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        style={{ backgroundColor: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
      />

      {/* Hover controls — Today + close, INSIDE the box at top-right (the month-nav
          arrows live on the left, so there is no overlap and no hover gap). */}
      <div
        data-no-drag
        className="pointer-events-none absolute right-1.5 top-1.5 z-20 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100"
      >
        <button
          type="button"
          onClick={() => setView({ y: today.getFullYear(), m: today.getMonth() })}
          className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}
        >
          {t('clock.today')}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('clock.close')}
          className="grid h-5 w-5 place-items-center rounded transition-colors hover:bg-black/10"
          style={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
        >
          <X className="h-3 w-3" style={{ color: 'hsl(var(--text-muted))' }} />
        </button>
      </div>

      {/* Calendar body — always visible; drag from here (nav buttons opt out). */}
      <div
        onPointerDown={makeDragStart(calendar.pos, onMove)}
        className="relative z-10 cursor-grab touch-none select-none px-3 py-3 active:cursor-grabbing"
      >
        {/* Nav arrows grouped on the left so the top-right stays free for the
            hover controls. The label gets right padding so it never runs under them. */}
        <div className="mb-1.5 flex items-center gap-0.5 pr-14" data-no-drag>
          <button type="button" className={navBtn} aria-label="prev" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" style={{ color: 'hsl(var(--foreground))' }} />
          </button>
          <button type="button" className={navBtn} aria-label="next" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" style={{ color: 'hsl(var(--foreground))' }} />
          </button>
          <span className="ml-1 min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
            {monthLabel}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center">
          {weekdays.map((w, i) => (
            <div key={`wd-${i}`} className="text-[11px] font-semibold" style={{ color: i === 0 ? '#EF4444' : 'hsl(var(--text-muted))' }}>
              {w}
            </div>
          ))}
          {cells.map((d, i) => (
            <div key={i} className="grid place-items-center">
              {d === null ? (
                <span />
              ) : (
                <span
                  className="grid h-7 w-7 place-items-center rounded-full text-xs"
                  style={
                    isToday(d)
                      ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontWeight: 700 }
                      : { color: i % 7 === 0 ? '#EF4444' : 'hsl(var(--foreground))' }
                  }
                >
                  {d}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
