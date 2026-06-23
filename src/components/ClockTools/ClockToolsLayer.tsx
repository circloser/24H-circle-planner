import { useState } from 'react';
import { Clock, Timer, AlarmClock, Calendar, CloudSun, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/usePreferences';
import { useClockTools, type ToolKind } from './useClockTools';
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
  const { state, toggle, setClock, setTimer, setAlarm, setCalendar, setWeather } = useClockTools();
  const { t } = useTranslation();
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
    'flex w-40 items-center gap-2 rounded-full px-3 py-2 text-sm shadow-md transition-transform hover:scale-105';
  const itemStyle: React.CSSProperties = {
    backgroundColor: 'hsl(var(--surface))',
    color: 'hsl(var(--foreground))',
    border: '1px solid hsl(var(--border))',
  };

  const menuRow = (kind: ToolKind, icon: React.ReactNode, label: string) => (
    <button type="button" className={item} style={itemStyle} onClick={() => toggle(kind)}>
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {state[kind].on && <Check className="h-4 w-4" style={{ color: 'hsl(var(--primary))' }} />}
    </button>
  );

  return (
    <>
      {state.clock.on && (
        <ClockWidget
          clock={state.clock}
          onMove={(pos) => setClock({ pos })}
          onClose={() => toggle('clock')}
          onToggleMode={() => setClock({ mode: state.clock.mode === 'analog' ? 'digital' : 'analog' })}
        />
      )}
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
      {state.weather.on && (
        <WeatherWidget
          weather={state.weather}
          onChange={setWeather}
          onMove={(pos) => setWeather({ pos })}
          onClose={() => toggle('weather')}
        />
      )}

      {/* Click-away backdrop for the popup menu. */}
      {menuOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      {/* Popup menu — stacked above the FAB (bottom-left). */}
      {menuOpen && (
        <div className="fixed bottom-[76px] left-5 z-30 flex flex-col items-start gap-2">
          {menuRow('clock', <Clock className="h-4 w-4" />, t('clock.clock'))}
          {menuRow('calendar', <Calendar className="h-4 w-4" />, t('clock.calendar'))}
          {menuRow('weather', <CloudSun className="h-4 w-4" />, t('clock.weather'))}
          {menuRow('timer', <Timer className="h-4 w-4" />, t('clock.timer'))}
          {menuRow('alarm', <AlarmClock className="h-4 w-4" />, t('clock.alarm'))}
        </div>
      )}

      {/* The single clock-tools FAB. */}
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={t('clock.tools')}
        aria-expanded={menuOpen}
        title={t('clock.tools')}
        className="fixed bottom-5 left-5 z-30 grid h-12 w-12 place-items-center rounded-full shadow-lg transition-transform hover:scale-105"
        style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
      >
        <Clock className="h-5 w-5" />
      </button>
    </>
  );
}
