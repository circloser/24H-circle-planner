import type { TimeSlice } from './time-slice';

export interface Preset {
  name: string;
  description: string;
  slices: TimeSlice[];
}
