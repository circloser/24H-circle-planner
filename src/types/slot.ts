import type { Schedule } from './schedule';

export interface Slot {
  id: string;
  name: string;
  schedule: Schedule;
  createdAt: string;
}

export interface SlotsEnvelope {
  version: 1;
  slots: Record<string, Slot>;
}
