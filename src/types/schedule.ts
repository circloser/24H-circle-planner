import type { TimeSlice } from './time-slice';

export interface Schedule {
  id: string;
  version: 1;
  name: string;
  slices: TimeSlice[];
  updatedAt: string; // ISO8601
  presetSource: string | null;
}

export interface ScheduleEnvelope {
  version: 1;
  schedule: Schedule;
}
