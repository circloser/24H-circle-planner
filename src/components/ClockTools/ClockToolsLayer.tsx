import { useState } from 'react';
import { Clock, Timer, AlarmClock, Calendar, CloudSun, Check, CircleDot, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation, usePreferences } from '@/hooks/usePreferences';
import { useClockTools, MAX_WEATHERS, MAX_CLOCKS, type ToolKind } from './useClockTools';
import { playBeep } from './clock-utils';
import { ClockWidget } from './ClockWidget';
import { TimerWidget } from './TimerWidget';
import { AlarmWidget } from './AlarmWidget';
import { CalendarWidget } from './CalendarWidget';
import { WeatherWidget } from './WeatherWidget';

/**
 * Bottom-left floating cluster mirroring the bottom-right memo FAB. One clock
 * icon opens a popup to toggle three movable tools: a clock (analog/digital),
 * a countdown timer, and an alarm. State + positions persist to localStorage.
 */
export function ClockToolsLayer() {
  const { state, toggle, addClock, removeClock, setClock, setTimer, setAlarm, setCalendar, addWeather, removeWeather, setWeather } = useClockTools();
  const { t } = useTranslation();
  const { prefs, setPreference } = usePreferences();
  const isRecord = (prefs.chartView ?? 'full') === 'record';
  const [menuOpen, setMenuOpen] = useState(false);

  const ringTimer = () => {
    playBeep(5);
    toast.success(t('clock.timerDone'));
  };
  const ringAlarm = () => {
    playBeep(6);
    toast(t('clock.alarmRing'));
  };

  const item =
    'flex w-40 items-center gap-2 rounded-full px-3 py-2 text-sm shadow-md transition-transform hover:scale-105 bg-surface text-foreground border border-border';

  const menuRow = (kind: ToolKind, icon: React.ReactNode, label: string) => (
    <button type="button" className={item} onClick={() => toggle(kind)}>
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {state[kind].on && <Check className="h-4 w-4 text-primary" />}
    </button>
  );

  return (
    <>
      {/* Clocks — one per timezone, each closable on its own. */}
      {state.clocks.map((c) => (
        <ClockWidget
          key={c.id}
          clock={c}
          onChange={(patch) => setClock(c.id, patch)}
          onMove={(pos) => setClock(c.id, { pos })}
          onClose={() => removeClock(c.id)}
        />
      ))}
      {state.timer.on && (
        <TimerWidget
          timer={state.timer}
          onChange={setTimer}
          onMove={(pos) => setTimer({ pos })}
          onClose={() => toggle('timer')}
          onRing={ringTimer}
        />
      )}
      {state.alarm.on && (
        <AlarmWidget
          alarm={state.alarm}
          onChange={setAlarm}
          onMove={(pos) => setAlarm({ pos })}
          onClose={() => toggle('alarm')}
          onRing={ringAlarm}
        />
      )}
      {state.calendar.on && (
        <CalendarWidget
          calendar={state.calendar}
          onMove={(pos) => setCalendar({ pos })}
          onClose={() => toggle('calendar')}
        />
      )}
      {/* Weather windows — one per city, each closable on its own. */}
      {state.weathers.map((w) => (
        <WeatherWidget
          key={w.id}
          weather={w}
          onChange={(patch) => setWeather(w.id, patch)}
          onMove={(pos) => setWeather(w.id, { pos })}
          onClose={() => removeWeather(w.id)}
        />
      ))}

      {/* Click-away backdrop for the popup menu. */}
      {menuOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      {/* Popup menu — stacked above the FAB (bottom-left). */}
      {menuOpen && (
        <div className="fixed bottom-[76px] left-5 z-30 flex flex-col items-start gap-2">
          {/* Clock ADDS a window per click (multi-timezone) instead of toggling. */}
          <button
            type="button"
            className={item}
            onClick={addClock}
            aria-label={t('clock.clockAdd')}
            disabled={state.clocks.length >= MAX_CLOCKS}
            style={state.clocks.length >= MAX_CLOCKS ? { opacity: 0.5 } : undefined}
          >
            <Clock className="h-4 w-4" />
            <span className="flex-1 text-left">{t('clock.clock')}</span>
            {state.clocks.length > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                {state.clocks.length}
              </span>
            )}
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
          {menuRow('calendar', <Calendar className="h-4 w-4" />, t('clock.calendar'))}
          {/* Weather ADDS a window per click (multi-city) instead of toggling. */}
          <button
            type="button"
            className={item}
            onClick={addWeather}
            aria-label={t('clock.weatherAdd')}
            disabled={state.weathers.length >= MAX_WEATHERS}
            style={state.weathers.length >= MAX_WEATHERS ? { opacity: 0.5 } : undefined}
          >
            <CloudSun className="h-4 w-4" />
            <span className="flex-1 text-left">{t('clock.weather')}</span>
            {state.weathers.length > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                {state.weathers.length}
              </span>
            )}
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
          {menuRow('timer', <Timer className="h-4 w-4" />, t('clock.timer'))}
          {menuRow('alarm', <AlarmClock className="h-4 w-4" />, t('clock.alarm'))}
          {/* Record mode — a separate mode (not a clock-tool); toggles the view. */}
          <button
            type="button"
            className={item}
            onClick={() => { setPreference('chartView', isRecord ? 'full' : 'record'); setMenuOpen(false); }}
          >
            <CircleDot className="h-4 w-4" />
            <span className="flex-1 text-left">{t('view.record')}</span>
            {isRecord && <Check className="h-4 w-4 text-primary" />}
          </button>
        </div>
      )}

      {/* The single clock-tools FAB. */}
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={t('clock.tools')}
        aria-expanded={menuOpen}
        title={t('clock.tools')}
        className="fixed bottom-5 left-5 z-30 grid h-12 w-12 place-items-center rounded-full shadow-lg transition-transform hover:scale-105 bg-surface text-muted-foreground border border-border"
      >
        <Clock className="h-5 w-5" />
      </button>
    </>
  );
}
