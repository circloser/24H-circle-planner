/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';

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

function load(): Goal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { version?: number; goals?: unknown };
      if (p && p.version === 1 && Array.isArray(p.goals)) return p.goals.filter(isGoal);
    }
  } catch {
    /* ignore corrupt/unavailable storage */
  }
  return [];
}

function persist(goals: Goal[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, goals }));
  } catch {
    /* storage unavailable */
  }
}

interface GoalsApi {
  goals: Goal[];
  addGoal: (g: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, patch: Partial<Omit<Goal, 'id'>>) => void;
  removeGoal: (id: string) => void;
}

const GoalsContext = createContext<GoalsApi | null>(null);

export function GoalsProvider({ children }: { children: React.ReactNode }) {
  const [goals, setGoals] = useState<Goal[]>(load);

  useEffect(() => {
    persist(goals);
  }, [goals]);

  const addGoal = useCallback((g: Omit<Goal, 'id'>) => {
    setGoals((prev) => [...prev, { ...g, id: uuid() }]);
  }, []);
  const updateGoal = useCallback((id: string, patch: Partial<Omit<Goal, 'id'>>) => {
    setGoals((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);
  const removeGoal = useCallback((id: string) => {
    setGoals((prev) => prev.filter((x) => x.id !== id));
  }, []);

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
