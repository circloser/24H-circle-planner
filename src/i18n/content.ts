/**
 * Translation for DATA strings that live in presets (preset names, descriptions,
 * and slice labels). Korean is the canonical/stored form (matches the icon dict
 * and tests), so we only need an English map: ko renders the original, every
 * other language renders English (matching the en fallback used for UI chrome).
 * User-typed labels that aren't in the map pass through unchanged.
 */
import type { Lang } from './translations';

const PRESET_NAME_EN: Record<string, string> = {
  '학생': 'Student',
  '대학생': 'College Student',
  '직장인 9 to 6': 'Office Worker 9 to 6',
  '자영업자': 'Self-employed',
  '은퇴자': 'Retiree',
};

const PRESET_DESC_EN: Record<string, string> = {
  '초/중/고등학생을 위한 학업 루틴': 'Academic routine for school students',
  '유연한 공강·알바·과제 시간을 포함한 대학생 루틴':
    'College routine with flexible gaps, part-time work, and assignments',
  '출퇴근 + 업무 + 저녁 여가 루틴': 'Commute + work + evening leisure routine',
  '준비·영업·마감 위주의 자영업 루틴': 'Self-employed routine: prep, business hours, closing',
  '산책·취미·가족 시간 위주의 건강 루틴': 'Healthy routine: walks, hobbies, family time',
};

const LABEL_EN: Record<string, string> = {
  '수면': 'Sleep',
  '기상·아침': 'Wake & Breakfast',
  '등교': 'To School',
  '오전 수업': 'Morning Class',
  '점심': 'Lunch',
  '오후 수업': 'Afternoon Class',
  '학원·자율학습': 'Academy & Study',
  '저녁': 'Dinner',
  '자습·복습': 'Self-study',
  '휴식·취침준비': 'Wind-down',
  '강의·공강 자율': 'Lectures & Free',
  '점심·휴식': 'Lunch & Break',
  '강의·세미나': 'Lecture & Seminar',
  '알바·팀플': 'Part-time & Group',
  '과제·공부': 'Assignments',
  '여가': 'Leisure',
  '출근': 'To Work',
  '오전 업무': 'Morning Work',
  '오후 업무': 'Afternoon Work',
  '퇴근': 'Commute Home',
  '저녁·여가': 'Dinner & Leisure',
  '운동': 'Exercise',
  '수면준비': 'Wind-down',
  '기상·준비': 'Wake & Prep',
  '가게 준비·청소': 'Open & Clean',
  '영업 (오전)': 'Open (AM)',
  '브레이크': 'Break',
  '영업 (오후)': 'Open (PM)',
  '마감 정리': 'Closing',
  '산책·운동': 'Walk & Exercise',
  '취미·독서': 'Hobby & Reading',
  '휴식·낮잠': 'Rest & Nap',
  '정원·취미': 'Garden & Hobby',
  '가족 시간·TV': 'Family & TV',
};

const pick = (map: Record<string, string>, value: string, lang: Lang): string =>
  lang === 'ko' ? value : (map[value] ?? value);

export const translatePresetName = (name: string, lang: Lang): string =>
  pick(PRESET_NAME_EN, name, lang);

export const translatePresetDesc = (desc: string, lang: Lang): string =>
  pick(PRESET_DESC_EN, desc, lang);

export const translateLabel = (label: string, lang: Lang): string =>
  pick(LABEL_EN, label, lang);
