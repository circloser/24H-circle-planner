import type { Schedule } from './schedule';

export interface HistoryState {
  past: Schedule[];
  present: Schedule;
  future: Schedule[];
}

export const HISTORY_DEPTH = 20;
