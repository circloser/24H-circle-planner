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

// Checked in this order; first hit wins. Leisure precedes meal so "저녁·여가"
// reads as leisure; commute precedes work so "출근" stays commute. Keep keywords
// ≥2 chars and specific — `includes()` is a substring match, so short English
// stems (bus→"business", date→"update", run→"brunch") are intentionally omitted
// in favour of their Korean equivalents.
const MATCH_ORDER: Exclude<CategoryKey, 'other'>[] = ['sleep', 'leisure', 'meal', 'commute', 'work'];
const KEYWORDS: Record<Exclude<CategoryKey, 'other'>, string[]> = {
  sleep: [
    '수면', '잠', '취침', '낮잠', '숙면', '잠자리',
    'sleep', 'nap', 'bed', 'asleep', 'snooze', 'doze', 'slumber',
  ],
  leisure: [
    '여가', '휴식', '취미', '자유', '놀이', '여행', '나들이', '외출', '소풍', '데이트', '약속', '모임', '회식', '파티', '술자리',
    '운동', '헬스', '요가', '필라테스', '스트레칭', '조깅', '러닝', '달리기', '수영', '등산', '산책', '자전거', '라이딩', '축구', '농구', '야구', '테니스', '배드민턴', '골프', '클라이밍', '볼링',
    '게임', '오락', '피시방', 'tv', '티비', '영상', '유튜브', '넷플릭스', '넷플', '영화', '드라마', '예능', '방송', '스트리밍', '웹툰', '만화', '음악', '노래', '콘서트', '공연', '전시',
    '독서', '그림', '사진', '악기', '피아노', '명상', '힐링', '카페', '쇼핑', '캠핑', '낚시', '봉사',
    'rest', 'leisure', 'hobby', 'game', 'gaming', 'relax', 'play', 'walk', 'exercise', 'workout', 'gym', 'fitness', 'running', 'jog', 'jogging', 'yoga', 'pilates', 'swim', 'swimming', 'hike', 'hiking', 'bike', 'cycling', 'soccer', 'basketball', 'tennis', 'golf',
    'netflix', 'movie', 'film', 'drama', 'music', 'concert', 'party', 'hangout', 'shopping', 'picnic', 'camping', 'fishing', 'meditation', 'reading', 'draw', 'paint', 'piano',
  ],
  meal: [
    '식사', '점심', '저녁', '아침', '밥', '간식', '야식', '브런치', '커피', '외식', '식당', '요리', '디저트', '음료',
    'meal', 'lunch', 'dinner', 'breakfast', 'brunch', 'snack', 'coffee', 'eating', 'dining', 'supper', 'dessert', 'cook', 'cooking',
  ],
  commute: [
    '이동', '출근', '퇴근', '출퇴근', '통근', '통학', '운전', '지하철', '버스', '대중교통', '교통', '차량',
    'commute', 'drive', 'driving', 'subway', 'transit', 'transport',
  ],
  work: [
    '업무', '근무', '회의', '미팅', '회사', '직장', '사무', '출장', '작업', '프로젝트', '개발', '코딩', '프로그래밍', '보고서', '문서', '기획', '영업', '운영', '마감', '일과', '알바', '아르바이트', '자기계발',
    '공부', '학습', '수업', '강의', '강연', '공강', '과제', '학교', '학원', '시험', '연구', '논문', '실험', '인턴', '면접', '취준', '자격증', '독학', '세미나', '발표',
    'work', 'working', 'study', 'studying', 'class', 'lecture', 'meeting', 'job', 'office', 'task', 'project', 'coding', 'dev', 'report', 'exam', 'school', 'homework', 'research', 'interview',
  ],
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
