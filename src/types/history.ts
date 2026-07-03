import type { Schedule } from './schedule';

export interface HistoryState {
  past: Schedule[];
  present: Schedule;
  future: Schedule[];
}

/** Undo steps kept (the header undo button + Ctrl+Z share this history). */
export const HISTORY_DEPTH = 10;
