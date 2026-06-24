import type { TimeSlice } from '@/types/time-slice';
import { sliceWidthMinutes } from '@/lib/time-utils';

// Categorise free-text slice labels into a handful of life buckets so we can show
// "how your day splits" (sleep / work / leisure …). Keyword match is order-
// sensitive: the first matching category wins (e.g. "저녁·여가" → leisure, not meal).

export type CategoryKey = 'sleep' | 'leisure' | 'meal' | 'commute' | 'work' | 'other';

export const CATEGORY_ORDER: CategoryKey[] = ['sleep', 'work', 'meal', 'leisure', 'commute', 'other'];

/** Fixed display colour per category (independent of slice colours). */
export const CATEGORY_COLOR: Record<CategoryKey, string> = {
  sleep: '#c7d2fe',
  work: '#93c5fd',
  meal: '#fde68a',
  leisure: '#6ee7b7',
  commute: '#fdba74',
  other: '#d1d5db',
};

// Checked in this order; first hit wins.
const MATCH_ORDER: Exclude<CategoryKey, 'other'>[] = ['sleep', 'leisure', 'meal', 'commute', 'work'];
const KEYWORDS: Record<Exclude<CategoryKey, 'other'>, string[]> = {
  sleep: ['수면', '잠', '취침', '낮잠', 'sleep', 'nap', 'bed'],
  leisure: ['여가', '휴식', '취미', '운동', '게임', 'tv', '티비', '영상', '유튜브', '산책', '독서', '자유', '여행', '놀이', 'rest', 'leisure', 'hobby', 'exercise', 'workout', 'game', 'relax', 'play', 'walk'],
  meal: ['식사', '점심', '저녁', '아침', '밥', '간식', '커피', 'meal', 'lunch', 'dinner', 'breakfast', 'brunch', 'snack', 'coffee'],
  commute: ['이동', '출근', '퇴근', '출퇴근', '통근', '통학', '운전', 'commute', 'drive'],
  work: ['업무', '근무', '회의', '공부', '학습', '수업', '공강', '과제', '자기계발', '알바', '운영', '영업', '마감', '일과', '작업', 'work', 'study', 'class', 'meeting', 'job', 'office', 'task'],
};

/** Map a slice label to its life-category bucket. */
export function categorize(label: string): CategoryKey {
  const s = (label ?? '').toLowerCase();
  if (!s.trim()) return 'other';
  for (const cat of MATCH_ORDER) {
    if (KEYWORDS[cat].some((k) => s.includes(k))) return cat;
  }
  return 'other';
}

export interface DayBreakdown {
  /** 1-based day number for display. */
  n: number;
  minutes: Record<CategoryKey, number>;
}

export interface Analytics {
  dayCount: number;
  /** Total minutes per category across all days. */
  totalByCat: Record<CategoryKey, number>;
  perDay: DayBreakdown[];
}

function emptyMinutes(): Record<CategoryKey, number> {
  return { sleep: 0, work: 0, meal: 0, leisure: 0, commute: 0, other: 0 };
}

/** Aggregate categorised time across every day's schedule. */
export function analyzeDays(days: Array<{ schedule: { slices: TimeSlice[] } }>): Analytics {
  const totalByCat = emptyMinutes();
  const perDay: DayBreakdown[] = days.map((d, i) => {
    const minutes = emptyMinutes();
    for (const sl of d.schedule.slices) {
      const cat = categorize(sl.label);
      const w = sliceWidthMinutes(sl);
      minutes[cat] += w;
      totalByCat[cat] += w;
    }
    return { n: i + 1, minutes };
  });
  return { dayCount: days.length, totalByCat, perDay };
}
