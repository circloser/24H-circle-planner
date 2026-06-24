import { v4 as uuid } from 'uuid';
import type { Schedule } from '@/types/schedule';
import type { TimeSlice } from '@/types/time-slice';

/**
 * A friendly, pre-filled EXAMPLE day shown on a first visit so newcomers never
 * face an empty circle ("blank-circle fear"). Fully editable; replaced the moment
 * a preset is loaded. Labels reuse the preset vocabulary so they localize via
 * translateLabel for non-Korean visitors.
 */
export function createDemoSchedule(): Schedule {
  const s = (startTime: string, endTime: string, label: string, color: string, icon: string): TimeSlice => ({
    id: uuid(),
    label,
    startTime,
    endTime,
    color,
    icon,
    textPosition: 'inside',
  });
  return {
    id: uuid(),
    version: 1,
    name: '내 하루',
    presetSource: null,
    updatedAt: new Date().toISOString(),
    slices: [
      s('00:00', '07:00', '수면', '#c7d2fe', '😴'),
      s('07:00', '08:00', '기상·아침', '#fbcfe8', '☀️'),
      s('08:00', '12:00', '오전 업무', '#bfdbfe', '💻'),
      s('12:00', '13:00', '점심', '#fde68a', '🍚'),
      s('13:00', '18:00', '오후 업무', '#a7f3d0', '📊'),
      s('18:00', '22:00', '저녁·여가', '#fed7aa', '🌆'),
      s('22:00', '24:00', '수면준비', '#ddd6fe', '🌙'),
    ],
  };
}
