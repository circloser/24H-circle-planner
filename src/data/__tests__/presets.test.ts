import { describe, it, expect } from 'vitest';
import { PRESETS } from '../presets';
import { isContiguous24h } from '@/lib/time-utils';

/**
 * Canonical label → first-acceptable-emoji mapping, derived from
 * src/scripts/dict-coverage.test.ts PRESET_LABELS array.
 * Used to verify preset slice icons without importing the dict-coverage test.
 */
const CANONICAL_LABELS = new Set([
  // 학생 (10)
  '수면', '기상·아침', '등교', '오전 수업', '점심', '오후 수업',
  '학원·자율학습', '저녁', '휴식·취침준비', '취침',
  // 대학생 (9)
  '기상·준비', '강의·공강 자율', '점심·휴식', '강의·세미나', '알바·팀플',
  '자습·복습', '저녁·여가', '과제·공부', '수면준비',
  // 직장인 (10)
  '출근', '오전 업무', '퇴근', '오후 업무',
  '운동', '여가', '취침준비',
  // 자영업자 (9)
  '가게 준비·청소', '영업 (오전)', '영업 (오후)', '브레이크', '마감 정리',
  // 은퇴자 (9)
  '기상', '산책·운동', '취미·독서', '휴식·낮잠', '가족 시간·TV', '정원·취미',
]);

/** Expected icon per label — first acceptable emoji from dict-coverage PRESET_LABELS. */
const CANONICAL_ICON: Record<string, string[]> = {
  // 학생
  '수면': ['💤'],
  '기상·아침': ['🍳', '☕', '🌅'],
  '등교': ['🚌', '🚇', '🚶'],
  '오전 수업': ['📖', '✏️', '🎓'],
  '점심': ['🍱', '🍚', '🍝', '🍽️'],
  '오후 수업': ['📖', '✏️', '🎓'],
  '학원·자율학습': ['✏️', '📝', '💻', '📖'],
  '저녁': ['🍚', '🍕', '🍱', '🍽️', '🍝'],
  '휴식·취침준비': ['🛀', '🌙', '💤', '🛋️'],
  '취침': ['💤', '🌙', '🛌'],
  // 대학생
  '기상·준비': ['🍳', '☕', '🌅', '🌄'],
  '강의·공강 자율': ['🎓', '📖', '✏️'],
  '점심·휴식': ['🍱', '🍚', '🛋️', '🍽️'],
  '강의·세미나': ['🎓', '📖', '✏️'],
  '알바·팀플': ['💼', '🤝', '👥'],
  '자습·복습': ['✏️', '📝', '💻', '📖'],
  '저녁·여가': ['🍚', '🍕', '🍱', '🍽️', '🎮', '📺'],
  '과제·공부': ['📝', '✏️', '💻', '📖'],
  '수면준비': ['🛀', '🌙', '💤'],
  // 직장인
  '출근': ['🚇', '🚌', '🚗', '🚶'],
  '오전 업무': ['💻', '📈', '🏢', '📊'],
  '퇴근': ['🚇', '🚌', '🚗', '🚶'],
  '오후 업무': ['📈', '💻', '🏢', '📊'],
  '운동': ['🏃', '🚶', '🏋️', '⚽'],
  '여가': ['🎮', '📺', '🛋️', '🌈'],
  '취침준비': ['🌙', '🛀', '💤'],
  // 자영업자
  '가게 준비·청소': ['🧹', '🏪', '🏢'],
  '영업 (오전)': ['🏪', '💼', '📈'],
  '영업 (오후)': ['🏪', '💼', '📈'],
  '브레이크': ['☕', '🛋️', '🌈'],
  '마감 정리': ['📋', '🗒️', '📊'],
  // 은퇴자
  '기상': ['🌅', '☕', '🍳'],
  '산책·운동': ['🚶', '🏃', '🌳'],
  '취미·독서': ['📚', '📖', '🎨'],
  '휴식·낮잠': ['🛌', '🛋️', '💤'],
  '가족 시간·TV': ['📺', '👨‍👩‍👧', '🎮'],
  '정원·취미': ['🌷', '🌳', '🎨'],
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('PRESETS data', () => {
  it('exports exactly 5 presets', () => {
    expect(PRESETS).toHaveLength(5);
  });

  it('has correct preset names', () => {
    const names = PRESETS.map((p) => p.name);
    expect(names).toEqual([
      '학생',
      '대학생',
      '직장인 9 to 6',
      '자영업자',
      '은퇴자',
    ]);
  });

  it('has correct slice counts per preset (10/9/10/9/9)', () => {
    const counts = PRESETS.map((p) => p.slices.length);
    expect(counts).toEqual([10, 9, 10, 9, 9]);
  });

  it('has exactly 47 slices in total', () => {
    const total = PRESETS.reduce((sum, p) => sum + p.slices.length, 0);
    expect(total).toBe(47);
  });

  it('each preset is contiguous 24h (isContiguous24h)', () => {
    for (const preset of PRESETS) {
      expect(
        isContiguous24h(preset.slices),
        `Preset "${preset.name}" is not contiguous 24h`,
      ).toBe(true);
    }
  });

  it('every slice label is one of the 47 canonical dict-coverage labels', () => {
    for (const preset of PRESETS) {
      for (const slice of preset.slices) {
        expect(
          CANONICAL_LABELS.has(slice.label),
          `Preset "${preset.name}" slice label "${slice.label}" is not in the canonical label set`,
        ).toBe(true);
      }
    }
  });

  it('every slice icon is an acceptable canonical emoji for its label', () => {
    for (const preset of PRESETS) {
      for (const slice of preset.slices) {
        const acceptable = CANONICAL_ICON[slice.label];
        if (acceptable) {
          expect(
            acceptable.includes(slice.icon),
            `Preset "${preset.name}" slice "${slice.label}" icon "${slice.icon}" not in [${acceptable.join(', ')}]`,
          ).toBe(true);
        }
      }
    }
  });

  it('preset slice ids are stable preset-prefixed strings (not uuids)', () => {
    for (const preset of PRESETS) {
      for (const slice of preset.slices) {
        expect(
          UUID_RE.test(slice.id),
          `Preset slice id "${slice.id}" should NOT be a uuid in the preset constant`,
        ).toBe(false);
        expect(slice.id).toMatch(/^preset-/);
      }
    }
  });
});
