import { v4 as uuid } from 'uuid';
import type { Schedule } from '@/types/schedule';

export function createInitialSchedule(): Schedule {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    version: 1,
    name: '내 시간표',
    presetSource: null,
    updatedAt: now,
    slices: [
      {
        id: uuid(),
        label: '',
        startTime: '00:00',
        endTime: '00:00', // full-day single empty slice convention: width = 1440
        color: '#9CA3AF', // gray-400
        icon: '',
        textPosition: 'inside',
      },
    ],
  };
}
