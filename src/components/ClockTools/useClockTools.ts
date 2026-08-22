import { useCallback, useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { spawnNearCentre, migrateLegacyPos, clampOffset, type Pos } from './clock-utils';
import { CLOCKTOOLS_SYNC_EVENT } from '@/lib/sync/widgetSync';

export type ClockMode = 'analog' | 'digital';
// NB: clock and weather are NOT ToolKinds — unlike the on/off singleton tools,
// they are LISTS (a clock per timezone, a weather window per city); see
// addClock/addWeather below.
export type ToolKind = 'timer' | 'alarm' | 'calendar' | 'nownext';

/** One open clock window. tz null = the device's local time. */
export interface ClockItem {
  id: string;
  mode: ClockMode;
  pos: Pos;
  tz: string | null; // IANA time zone, e.g. "Asia/Seoul"
}

/** More than this and the strip becomes soup; the add action no-ops at the cap. */
export const MAX_CLOCKS = 5;
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
  clocks: ClockItem[];
  timer: TimerState;
  alarm: AlarmState;
  calendar: CalendarState;
  /** "Now & Next" schedule widget — same on/pos shape as the calendar singleton. */
  nownext: CalendarState;
  weathers: WeatherItem[];
}

/** Pre-multi-window envelopes: single toggleable clock / weather widgets. */
interface LegacyClockState {
  on: boolean;
  mode: ClockMode;
  pos: Pos;
}
interface LegacyWeatherState {
  on: boolean;
  pos: Pos;
  place: WeatherPlace | null;
}

const STORAGE_KEY = '24h-circle-planner.clocktools';

/** Where a NEW weather window spawns: just right of the chart, cascaded per
 *  already-open window so stacked windows stay individually grabbable. */
export function weatherSpawnPos(count: number): Pos {
  return spawnNearCentre(150 + count * 26, -40 + count * 26, 204, 200);
}

/** Where a NEW clock spawns: just left of the chart, same cascade. */
export function clockSpawnPos(count: number): Pos {
  return spawnNearCentre(-340 + count * 26, -40 + count * 26, 168, 150);
}

/** Default stacked positions above the bottom-left FAB. One local clock + the
 *  calendar start ON (floating on the LEFT) so a first-time visitor lands on a
 *  live dashboard; every other tool stays off until opened. */
function defaultState(): ClockToolsState {
  return {
    clocks: [{ id: uuid(), mode: 'analog', pos: spawnNearCentre(-340, -40, 168, 150), tz: null }],
    calendar: { on: true, pos: spawnNearCentre(-360, -210, 232, 240) },
    nownext: { on: false, pos: spawnNearCentre(150, -210, 210, 180) },
    timer: { on: false, pos: spawnNearCentre(-340, 130, 200, 160), setSec: 300, remainingSec: 300, running: false, endAt: null },
    weathers: [],
    alarm: { on: false, pos: spawnNearCentre(-340, 210, 200, 140), time: '07:00', enabled: false },
  };
}

type LegacyEnvelope = Partial<ClockToolsState> & {
  clock?: Partial<LegacyClockState>;
  weather?: Partial<LegacyWeatherState>;
};

/** Accept both shapes: `weathers` (current) or the legacy single `weather`
 *  (an ON widget becomes the first list item; OFF is simply no windows). */
function migrateWeathers(s: LegacyEnvelope): WeatherItem[] {
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

/** Same for clocks: `clocks` (current) or the legacy single `clock`. */
function migrateClocks(s: LegacyEnvelope): ClockItem[] {
  if (Array.isArray(s.clocks)) {
    return s.clocks
      .filter((c) => c && typeof c === 'object' && c.pos)
      .map((c) => ({
        id: typeof c.id === 'string' ? c.id : uuid(),
        mode: c.mode === 'digital' ? 'digital' : 'analog',
        pos: c.pos,
        tz: typeof c.tz === 'string' ? c.tz : null,
      }));
  }
  if (s.clock?.on) {
    return [{ id: uuid(), mode: s.clock.mode === 'digital' ? 'digital' : 'analog', pos: s.clock.pos ?? clockSpawnPos(0), tz: null }];
  }
  // Legacy envelope with the clock explicitly OFF → no clocks.
  if (s.clock) return [];
  // No clock info at all (corrupt fragment) → the first-visit default.
  return defaultState().clocks;
}

function loadState(): ClockToolsState {
  const def = defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { version?: number; coords?: string; state?: Partial<ClockToolsState> };
      if (parsed && parsed.version === 1 && parsed.state) {
        const s = parsed.state as LegacyEnvelope;
        const merged: ClockToolsState = {
          clocks: migrateClocks(s),
          calendar: { ...def.calendar, ...s.calendar, pos: { ...def.calendar.pos, ...s.calendar?.pos } },
          nownext: { ...def.nownext, ...s.nownext, pos: { ...def.nownext.pos, ...s.nownext?.pos } },
          timer: { ...def.timer, ...s.timer, pos: { ...def.timer.pos, ...s.timer?.pos } },
          weathers: migrateWeathers(s),
          alarm: { ...def.alarm, ...s.alarm, pos: { ...def.alarm.pos, ...s.alarm?.pos } },
        };
        // Positions without the `coords:'centre'` marker are legacy ABSOLUTE
        // pixels — re-express them as centre offsets (same rendered spot).
        // Marked envelopes are already offsets and pass through untouched, so a
        // load→save round-trip is byte-stable (sync sees no phantom change).
        if (parsed.coords !== 'centre') {
          merged.clocks = merged.clocks.map((c) => ({ ...c, pos: migrateLegacyPos(c.pos) }));
          merged.calendar = { ...merged.calendar, pos: migrateLegacyPos(merged.calendar.pos) };
          merged.nownext = { ...merged.nownext, pos: migrateLegacyPos(merged.nownext.pos) };
          merged.timer = { ...merged.timer, pos: migrateLegacyPos(merged.timer.pos) };
          merged.weathers = merged.weathers.map((w) => ({ ...w, pos: migrateLegacyPos(w.pos) }));
          merged.alarm = { ...merged.alarm, pos: migrateLegacyPos(merged.alarm.pos) };
        }
        // Every position gets clamped on-screen — an unreachable widget can't be
        // dragged back (in-range values pass through unchanged → byte-stable).
        merged.clocks = merged.clocks.map((c) => ({ ...c, pos: clampOffset(c.pos, 168, 150) }));
        merged.calendar = { ...merged.calendar, pos: clampOffset(merged.calendar.pos, 232, 240) };
        merged.nownext = { ...merged.nownext, pos: clampOffset(merged.nownext.pos, 210, 180) };
        merged.timer = { ...merged.timer, pos: clampOffset(merged.timer.pos, 200, 160) };
        merged.weathers = merged.weathers.map((w) => ({ ...w, pos: clampOffset(w.pos, 204, 200) }));
        merged.alarm = { ...merged.alarm, pos: clampOffset(merged.alarm.pos, 200, 140) };
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
    // version stays 1 (older builds still read it — they just see the positions
    // as absolute, shifted but never reset); `coords` marks the offset space.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, coords: 'centre', state }));
  } catch {
    // storage unavailable — tools simply won't persist
  }
}

export interface ClockToolsApi {
  state: ClockToolsState;
  toggle: (kind: ToolKind) => void;
  /** Open one more clock (up to MAX_CLOCKS; no-ops at the cap). */
  addClock: () => void;
  /** Close ONE clock (the ✕ on that clock). */
  removeClock: (id: string) => void;
  /** Patch one clock (mode toggle, timezone, or position while dragging). */
  setClock: (id: string, patch: Partial<Omit<ClockItem, 'id'>>) => void;
  setTimer: (patch: Partial<TimerState>) => void;
  setAlarm: (patch: Partial<AlarmState>) => void;
  setCalendar: (patch: Partial<CalendarState>) => void;
  setNownext: (patch: Partial<CalendarState>) => void;
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

  // Cloud sync applied a new clock-tools value to localStorage (no reload) — adopt
  // it into memory so the widgets move/appear live. loadState is idempotent for a
  // full-shape value, so re-saving it produces identical wire data (no sync churn).
  useEffect(() => {
    const onSync = () => setState(loadState());
    window.addEventListener(CLOCKTOOLS_SYNC_EVENT, onSync);
    return () => window.removeEventListener(CLOCKTOOLS_SYNC_EVENT, onSync);
  }, []);

  const toggle = useCallback((kind: ToolKind) => {
    setState((s) => {
      if (s[kind].on) return { ...s, [kind]: { ...s[kind], on: false } };
      // Opening a singleton tool → (re)spawn it next to the chart, so it never
      // opens at a stale, far-flung stored position. The user can drag it after.
      const pos =
        kind === 'timer'
          ? spawnNearCentre(-340, 130, 200, 160)
          : kind === 'alarm'
            ? spawnNearCentre(-340, 210, 200, 140)
            : kind === 'nownext'
              ? spawnNearCentre(150, -210, 210, 180)
              : spawnNearCentre(-360, -210, 232, 240); // calendar
      return { ...s, [kind]: { ...s[kind], on: true, pos } };
    });
  }, []);

  const addClock = useCallback(() => {
    setState((s) => {
      if (s.clocks.length >= MAX_CLOCKS) return s;
      const item: ClockItem = { id: uuid(), mode: 'analog', pos: clockSpawnPos(s.clocks.length), tz: null };
      return { ...s, clocks: [...s.clocks, item] };
    });
  }, []);
  const removeClock = useCallback((id: string) => {
    setState((s) => ({ ...s, clocks: s.clocks.filter((c) => c.id !== id) }));
  }, []);
  const setClock = useCallback((id: string, patch: Partial<Omit<ClockItem, 'id'>>) => {
    setState((s) => ({ ...s, clocks: s.clocks.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
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
  const setNownext = useCallback((patch: Partial<CalendarState>) => {
    setState((s) => ({ ...s, nownext: { ...s.nownext, ...patch } }));
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

  return { state, toggle, addClock, removeClock, setClock, setTimer, setAlarm, setCalendar, setNownext, addWeather, removeWeather, setWeather };
}
