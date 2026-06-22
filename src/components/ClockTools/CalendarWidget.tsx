import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import { useNow, type Pos } from './clock-utils';
import type { CalendarState } from './useClockTools';
import { useTranslation } from '@/hooks/usePreferences';

interface CalendarWidgetProps {
  calendar: CalendarState;
  onMove: (p: Pos) => void;
  onClose: () => void;
}

const navBtn = 'grid h-6 w-6 place-items-center rounded transition-colors hover:bg-black/10';

export function CalendarWidget({ calendar, onMove, onClose }: CalendarWidgetProps) {
  const { t, lang } = useTranslation();
  const today = useNow(true, 60_000); // keep "today" correct across midnight
  // Displayed month (defaults to the current one).
  const [view, setView] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }));

  const first = new Date(view.y, view.m, 1);
  const startOffset = first.getDay(); // 0 = Sunday
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const monthLabel = first.toLocaleDateString(lang, { year: 'numeric', month: 'long' });
  // Weekday headers (narrow), Sunday-first. 2024-01-07 is a Sunday.
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
    <FloatingPanel
      pos={calendar.pos}
      width={232}
      title={t('clock.calendar')}
      closeLabel={t('clock.close')}
      onMove={onMove}
      onClose={onClose}
      headerRight={
        <button
          type="button"
          data-no-drag
          onClick={() => setView({ y: today.getFullYear(), m: today.getMonth() })}
          className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: 'hsl(var(--accent) / 0.15)', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}
        >
          {t('clock.today')}
        </button>
      }
    >
      <div className="mb-1.5 flex items-center justify-between" data-no-drag>
        <button type="button" className={navBtn} aria-label="prev" onClick={() => shift(-1)}>
          <ChevronLeft className="h-4 w-4" style={{ color: 'hsl(var(--foreground))' }} />
        </button>
        <span className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
          {monthLabel}
        </span>
        <button type="button" className={navBtn} aria-label="next" onClick={() => shift(1)}>
          <ChevronRight className="h-4 w-4" style={{ color: 'hsl(var(--foreground))' }} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {weekdays.map((w, i) => (
          <div
            key={`wd-${i}`}
            className="text-[11px] font-semibold"
            style={{ color: i === 0 ? '#EF4444' : 'hsl(var(--text-muted))' }}
          >
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
    </FloatingPanel>
  );
}
