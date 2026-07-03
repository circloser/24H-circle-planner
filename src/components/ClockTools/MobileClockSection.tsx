import { Clock, Calendar, CloudSun, Check, CircleDot, Plus } from 'lucide-react';
import { useTranslation, usePreferences } from '@/hooks/usePreferences';
import { useClockTools, MAX_WEATHERS, MAX_CLOCKS, type ToolKind } from './useClockTools';
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
  const { state, toggle, addClock, removeClock, setClock, addWeather, removeWeather, setWeather } = useClockTools();
  const { t } = useTranslation();
  const { prefs, setPreference } = usePreferences();
  const isRecord = (prefs.chartView ?? 'full') === 'record';

  const chips: Array<[ToolKind, React.ReactNode, string]> = [
    ['calendar', <Calendar className="h-4 w-4" />, t('clock.calendar')],
  ];

  return (
    <section className="w-full">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
        {/* Clock ADDS a card per tap (multi-timezone, cap MAX_CLOCKS); each
            inline card below closes itself via its ✕. */}
        <button
          type="button"
          onClick={addClock}
          aria-label={t('clock.clockAdd')}
          disabled={state.clocks.length >= MAX_CLOCKS}
          aria-pressed={state.clocks.length > 0}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
          style={
            state.clocks.length > 0
              ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: '1px solid hsl(var(--primary))' }
              : { backgroundColor: 'hsl(var(--surface))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }
          }
        >
          <Clock className="h-4 w-4" />
          {t('clock.clock')}
          {state.clocks.length > 0 && (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary-foreground/25 px-1 text-[10px] font-bold">
              {state.clocks.length}
            </span>
          )}
          <Plus className="h-3.5 w-3.5" />
        </button>
        {/* Weather ADDS a card per tap (multi-city, cap MAX_WEATHERS); each
            inline card below closes itself via its ✕. */}
        <button
          type="button"
          onClick={addWeather}
          aria-label={t('clock.weatherAdd')}
          disabled={state.weathers.length >= MAX_WEATHERS}
          aria-pressed={state.weathers.length > 0}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
          style={
            state.weathers.length > 0
              ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: '1px solid hsl(var(--primary))' }
              : { backgroundColor: 'hsl(var(--surface))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }
          }
        >
          <CloudSun className="h-4 w-4" />
          {t('clock.weather')}
          {state.weathers.length > 0 && (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary-foreground/25 px-1 text-[10px] font-bold">
              {state.weathers.length}
            </span>
          )}
          <Plus className="h-3.5 w-3.5" />
        </button>
        {/* Record mode entry (a separate mode, not a clock tool). */}
        <button
          type="button"
          onClick={() => setPreference('chartView', isRecord ? 'full' : 'record')}
          aria-pressed={isRecord}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors"
          style={
            isRecord
              ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', border: '1px solid hsl(var(--primary))' }
              : { backgroundColor: 'hsl(var(--surface))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }
          }
        >
          <CircleDot className="h-4 w-4" />
          {t('view.record')}
          {isRecord && <Check className="h-3.5 w-3.5" />}
        </button>
      </div>

      <FloatingInlineContext.Provider value={true}>
        <div className="mt-3 flex flex-col gap-3">
          {state.clocks.map((c) => (
            <ClockWidget
              key={c.id}
              clock={c}
              onChange={(patch) => setClock(c.id, patch)}
              onMove={noMove}
              onClose={() => removeClock(c.id)}
            />
          ))}
          {state.calendar.on && (
            <CalendarWidget calendar={state.calendar} onMove={noMove} onClose={() => toggle('calendar')} />
          )}
          {state.weathers.map((w) => (
            <WeatherWidget
              key={w.id}
              weather={w}
              onChange={(patch) => setWeather(w.id, patch)}
              onMove={noMove}
              onClose={() => removeWeather(w.id)}
            />
          ))}
        </div>
      </FloatingInlineContext.Provider>
    </section>
  );
}
