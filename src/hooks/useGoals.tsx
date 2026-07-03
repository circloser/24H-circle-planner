/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext } from 'react';
import { v4 as uuid } from 'uuid';
import { usePersistedState, type PersistedCodec } from '@/hooks/usePersistedState';

/**
 * Time-accumulation goals (e.g. 운동 5시간/주, 공부 3시간/일). A goal targets a
 * timetable label and a period; progress is summed from the schedule/diary by
 * exact label (see lib/goals.ts).
 */
export interface Goal {
  id: string;
  label: string;
  targetMinutes: number;
  period: 'day' | 'week';
}

const STORAGE_KEY = '24h-circle-planner.goals';

function isGoal(g: unknown): g is Goal {
  if (!g || typeof g !== 'object') return false;
  const o = g as Record<string, unknown>;
  return (
    typeof o['id'] === 'string' &&
    typeof o['label'] === 'string' &&
    typeof o['targetMinutes'] === 'number' &&
    (o['period'] === 'day' || o['period'] === 'week')
  );
}

/** Storage envelope `{version: 1, goals}` — byte-compat pinned by tests. */
export const goalsCodec: PersistedCodec<Goal[]> = {
  decode: (parsed) => {
    const p = parsed as { version?: number; goals?: unknown } | null;
    if (p && p.version === 1 && Array.isArray(p.goals)) return p.goals.filter(isGoal);
    return null;
  },
  encode: (goals) => ({ version: 1, goals }),
  fallback: () => [],
};

interface GoalsApi {
  goals: Goal[];
  addGoal: (g: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, patch: Partial<Omit<Goal, 'id'>>) => void;
  removeGoal: (id: string) => void;
}

const GoalsContext = createContext<GoalsApi | null>(null);

export function GoalsProvider({ children }: { children: React.ReactNode }) {
  const [goals, setGoals] = usePersistedState(STORAGE_KEY, goalsCodec);

  const addGoal = useCallback((g: Omit<Goal, 'id'>) => {
    setGoals((prev) => [...prev, { ...g, id: uuid() }]);
  }, [setGoals]);
  const updateGoal = useCallback((id: string, patch: Partial<Omit<Goal, 'id'>>) => {
    setGoals((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, [setGoals]);
  const removeGoal = useCallback((id: string) => {
    setGoals((prev) => prev.filter((x) => x.id !== id));
  }, [setGoals]);

  return (
    <GoalsContext.Provider value={{ goals, addGoal, updateGoal, removeGoal }}>
      {children}
    </GoalsContext.Provider>
  );
}

export function useGoals(): GoalsApi {
  const ctx = useContext(GoalsContext);
  if (!ctx) return { goals: [], addGoal: () => {}, updateGoal: () => {}, removeGoal: () => {} };
  return ctx;
}
