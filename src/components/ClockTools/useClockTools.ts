import { useCallback, useEffect, useState } from 'react';
import type { Pos } from './clock-utils';

export type ClockMode = 'analog' | 'digital';
export type ToolKind = 'clock' | 'timer' | 'alarm';

export interface ClockState {
  on: boolean;
  mode: ClockMode;
  pos: Pos;
}
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
}

const STORAGE_KEY = '24h-circle-planner.clocktools';

const clampY = (y: number) => Math.max(76, y);

/** Default stacked positions above the bottom-left FAB. */
function defaultState(): ClockToolsState {
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  return {
    clock: { on: false, mode: 'analog', pos: { x: 20, y: clampY(vh - 580) } },
    timer: { on: false, pos: { x: 20, y: clampY(vh - 360) }, setSec: 300, remainingSec: 300, running: false, endAt: null },
    alarm: { on: false, pos: { x: 20, y: clampY(vh - 200) }, time: '07:00', enabled: false },
  };
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
          timer: { ...def.timer, ...s.timer, pos: { ...def.timer.pos, ...s.timer?.pos } },
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

  return { state, toggle, setClock, setTimer, setAlarm };
}
