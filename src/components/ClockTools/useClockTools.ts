import { useCallback, useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { Pos } from './clock-utils';

export type ClockMode = 'analog' | 'digital';
// NB: weather is NOT a ToolKind — unlike the on/off singleton tools, weather
// windows are a LIST (one per city); see addWeather/removeWeather below.
export type ToolKind = 'clock' | 'timer' | 'alarm' | 'calendar';

export interface ClockState {
  on: boolean;
  mode: ClockMode;
  pos: Pos;
}
export interface CalendarState {
  on: boolean;
  pos: Pos;
}
export interface WeatherPlace {
  name: string;
  lat: number;
  lon: number;
}
/** One open weather window. Being in the list = open; closing removes it. */
export interface WeatherItem {
  id: string;
  pos: Pos;
  place: WeatherPlace | null;
}

/** More than this and the strip becomes soup; the add action no-ops at the cap. */
export const MAX_WEATHERS = 5;
export interface TimerState {
  on: boolean;
  pos: Pos;
  setSec: number; // configured length (for reset)
  remainingSec: number; // remaining when paused/idle (live value derived from endAt while running)
  running: boolean;
  endAt: number | null; // epoch ms the countdown reaches 0 (while running)
}
export interface AlarmState {
  on: boolean;
  pos: Pos;
  time: string; // "HH:mm"
  enabled: boolean;
}
export interface ClockToolsState {
  clock: ClockState;
  timer: TimerState;
  alarm: AlarmState;
  calendar: CalendarState;
  weathers: WeatherItem[];
}

/** Pre-multi-window envelope: a single toggleable weather widget. */
interface LegacyWeatherState {
  on: boolean;
  pos: Pos;
  place: WeatherPlace | null;
}

const STORAGE_KEY = '24h-circle-planner.clocktools';

const clampY = (y: number) => Math.max(76, y);

/** Where a NEW weather window spawns: the old single-widget spot, cascaded
 *  24px per already-open window so stacked windows stay individually grabbable. */
export function weatherSpawnPos(count: number): Pos {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  return {
    x: Math.min(206 + count * 24, Math.max(20, vw - 224)),
    y: clampY(Math.min(vh - 360 + count * 24, vh - 160)),
  };
}

/** Default stacked positions above the bottom-left FAB. The clock + calendar
 *  start ON (floating on the LEFT) so a first-time visitor lands on a live
 *  dashboard; every other tool stays off until opened. */
function defaultState(): ClockToolsState {
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  return {
    clock: { on: true, mode: 'analog', pos: { x: 20, y: clampY(vh - 600) } },
    calendar: { on: true, pos: { x: 206, y: clampY(vh - 600) } },
    timer: { on: false, pos: { x: 20, y: clampY(vh - 360) }, setSec: 300, remainingSec: 300, running: false, endAt: null },
    weathers: [],
    alarm: { on: false, pos: { x: 20, y: clampY(vh - 200) }, time: '07:00', enabled: false },
  };
}

/** Accept both shapes: `weathers` (current) or the legacy single `weather`
 *  (an ON widget becomes the first list item; OFF is simply no windows). */
function migrateWeathers(s: Partial<ClockToolsState> & { weather?: Partial<LegacyWeatherState> }): WeatherItem[] {
  if (Array.isArray(s.weathers)) {
    return s.weathers
      .filter((w) => w && typeof w === 'object' && w.pos)
      .map((w) => ({ id: typeof w.id === 'string' ? w.id : uuid(), pos: w.pos, place: w.place ?? null }));
  }
  if (s.weather?.on) {
    return [{ id: uuid(), pos: s.weather.pos ?? weatherSpawnPos(0), place: s.weather.place ?? null }];
  }
  return [];
}

function loadState(): ClockToolsState {
  const def = defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { version?: number; state?: Partial<ClockToolsState> };
      if (parsed && parsed.version === 1 && parsed.state) {
        const s = parsed.state;
        const merged: ClockToolsState = {
          clock: { ...def.clock, ...s.clock, pos: { ...def.clock.pos, ...s.clock?.pos } },
          calendar: { ...def.calendar, ...s.calendar, pos: { ...def.calendar.pos, ...s.calendar?.pos } },
          timer: { ...def.timer, ...s.timer, pos: { ...def.timer.pos, ...s.timer?.pos } },
          weathers: migrateWeathers(s),
          alarm: { ...def.alarm, ...s.alarm, pos: { ...def.alarm.pos, ...s.alarm?.pos } },
        };
        // A timer that finished while the tab was closed: stop it silently.
        if (merged.timer.running && (!merged.timer.endAt || merged.timer.endAt <= Date.now())) {
          merged.timer = { ...merged.timer, running: false, endAt: null, remainingSec: 0 };
        }
        return merged;
      }
    }
  } catch {
    // ignore corrupt/unavailable storage
  }
  return def;
}

function saveState(state: ClockToolsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state }));
  } catch {
    // storage unavailable — tools simply won't persist
  }
}

export interface ClockToolsApi {
  state: ClockToolsState;
  toggle: (kind: ToolKind) => void;
  setClock: (patch: Partial<ClockState>) => void;
  setTimer: (patch: Partial<TimerState>) => void;
  setAlarm: (patch: Partial<AlarmState>) => void;
  setCalendar: (patch: Partial<CalendarState>) => void;
  /** Open one more weather window (up to MAX_WEATHERS; no-ops at the cap). */
  addWeather: () => void;
  /** Close ONE weather window (the ✕ on that window). */
  removeWeather: (id: string) => void;
  /** Patch one weather window (its place, or its position while dragging). */
  setWeather: (id: string, patch: Partial<Omit<WeatherItem, 'id'>>) => void;
}

/** Self-contained store for the floating clock tools (no provider needed). */
export function useClockTools(): ClockToolsApi {
  const [state, setState] = useState<ClockToolsState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const toggle = useCallback((kind: ToolKind) => {
    setState((s) => ({ ...s, [kind]: { ...s[kind], on: !s[kind].on } }));
  }, []);

  const setClock = useCallback((patch: Partial<ClockState>) => {
    setState((s) => ({ ...s, clock: { ...s.clock, ...patch } }));
  }, []);
  const setTimer = useCallback((patch: Partial<TimerState>) => {
    setState((s) => ({ ...s, timer: { ...s.timer, ...patch } }));
  }, []);
  const setAlarm = useCallback((patch: Partial<AlarmState>) => {
    setState((s) => ({ ...s, alarm: { ...s.alarm, ...patch } }));
  }, []);
  const setCalendar = useCallback((patch: Partial<CalendarState>) => {
    setState((s) => ({ ...s, calendar: { ...s.calendar, ...patch } }));
  }, []);

  const addWeather = useCallback(() => {
    setState((s) => {
      if (s.weathers.length >= MAX_WEATHERS) return s;
      const item: WeatherItem = { id: uuid(), pos: weatherSpawnPos(s.weathers.length), place: null };
      return { ...s, weathers: [...s.weathers, item] };
    });
  }, []);
  const removeWeather = useCallback((id: string) => {
    setState((s) => ({ ...s, weathers: s.weathers.filter((w) => w.id !== id) }));
  }, []);
  const setWeather = useCallback((id: string, patch: Partial<Omit<WeatherItem, 'id'>>) => {
    setState((s) => ({ ...s, weathers: s.weathers.map((w) => (w.id === id ? { ...w, ...patch } : w)) }));
  }, []);

  return { state, toggle, setClock, setTimer, setAlarm, setCalendar, addWeather, removeWeather, setWeather };
}
