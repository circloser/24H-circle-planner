import { Clock, Calendar, CloudSun, Check } from 'lucide-react';
import { useTranslation } from '@/hooks/usePreferences';
import { useClockTools, type ToolKind } from './useClockTools';
import { ClockWidget } from './ClockWidget';
import { CalendarWidget } from './CalendarWidget';
import { WeatherWidget } from './WeatherWidget';
import { FloatingInlineContext } from './floatingInline';

const noMove = () => {};

/**
 * Mobile clock tools — a FIXED section (below the memos) instead of the desktop
 * floating widgets. A row of toggle chips turns each tool on/off; active tools
 * render INLINE, stacked, via FloatingInlineContext (the widget code is reused
 * unchanged). Timer + alarm are intentionally omitted on mobile — the phone's
 * own clock app already covers those.
 */
export function MobileClockSection() {
  const { state, toggle, setClock, setWeather } = useClockTools();
  const { t } = useTranslation();

  const chips: Array<[ToolKind, React.ReactNode, string]> = [
    ['clock', <Clock className="h-4 w-4" />, t('clock.clock')],
    ['calendar', <Calendar className="h-4 w-4" />, t('clock.calendar')],
    ['weather', <CloudSun className="h-4 w-4" />, t('clock.weather')],
  ];

  return (
    <section className="w-full">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--text-muted))' }}>
        {t('clock.tools')}
      </h2>

      <div className="flex flex-wrap gap-2">
        {chips.map(([kind, icon, label]) => {
          const on = state[kind].on;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => toggle(kind)}
              aria-pressed={on}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors"
              style={
                on
                  ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: '1px solid hsl(var(--primary))' }
                  : { backgroundColor: 'hsl(var(--surface))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }
              }
            >
              {icon}
              {label}
              {on && <Check className="h-3.5 w-3.5" />}
            </button>
          );
        })}
      </div>

      <FloatingInlineContext.Provider value={true}>
        <div className="mt-3 flex flex-col gap-3">
          {state.clock.on && (
            <ClockWidget
              clock={state.clock}
              onMove={noMove}
              onClose={() => toggle('clock')}
              onToggleMode={() => setClock({ mode: state.clock.mode === 'analog' ? 'digital' : 'analog' })}
            />
          )}
          {state.calendar.on && (
            <CalendarWidget calendar={state.calendar} onMove={noMove} onClose={() => toggle('calendar')} />
          )}
          {state.weather.on && (
            <WeatherWidget weather={state.weather} onChange={setWeather} onMove={noMove} onClose={() => toggle('weather')} />
          )}
        </div>
      </FloatingInlineContext.Provider>
    </section>
  );
}
