/**
 * E1a: Preset label dictionary coverage gate.
 * All 47 preset labels from the spec's Reference Preset Data tables must resolve
 * to their canonical emoji in the top-3 results of suggestIcons().
 *
 * 학생 (10) + 대학생 (9) + 직장인 (10) + 자영업자 (9) + 은퇴자 (9) = 47 labels
 */
import { describe, it, expect } from 'vitest';
import { suggestIcons } from '@/lib/fuse-dict';

interface PresetLabel {
  label: string;
  acceptableEmojis: string[];
}

// 47 canonical preset labels and their acceptable emoji(s) from the spec
const PRESET_LABELS: PresetLabel[] = [
  // ─── 학생 (10) ──────────────────────────────────────────────────────────
  { label: '수면', acceptableEmojis: ['💤'] },
  { label: '기상·아침', acceptableEmojis: ['🍳', '☕', '🌅'] },
  { label: '등교', acceptableEmojis: ['🚌', '🚇', '🚶'] },
  { label: '오전 수업', acceptableEmojis: ['📖', '✏️', '🎓'] },
  { label: '점심', acceptableEmojis: ['🍱', '🍚', '🍝', '🍽️'] },
  { label: '오후 수업', acceptableEmojis: ['📖', '✏️', '🎓'] },
  { label: '학원·자율학습', acceptableEmojis: ['✏️', '📝', '💻', '📖'] },
  { label: '저녁', acceptableEmojis: ['🍚', '🍕', '🍱', '🍽️', '🍝'] },
  { label: '휴식·취침준비', acceptableEmojis: ['🛀', '🌙', '💤', '🛋️'] },
  { label: '취침', acceptableEmojis: ['💤', '🌙', '🛌'] },

  // ─── 대학생 (9) ─────────────────────────────────────────────────────────
  { label: '기상·준비', acceptableEmojis: ['🍳', '☕', '🌅', '🌄'] },
  { label: '강의·공강 자율', acceptableEmojis: ['🎓', '📖', '✏️'] },
  { label: '점심·휴식', acceptableEmojis: ['🍱', '🍚', '🛋️', '🍽️'] },
  { label: '강의·세미나', acceptableEmojis: ['🎓', '📖', '✏️'] },
  { label: '알바·팀플', acceptableEmojis: ['💼', '🤝', '👥'] },
  { label: '자습·복습', acceptableEmojis: ['✏️', '📝', '💻', '📖'] },
  { label: '저녁·여가', acceptableEmojis: ['🍚', '🍕', '🍱', '🍽️', '🎮', '📺'] },
  { label: '과제·공부', acceptableEmojis: ['📝', '✏️', '💻', '📖'] },
  { label: '수면준비', acceptableEmojis: ['🛀', '🌙', '💤'] },

  // ─── 직장인 (10) ─────────────────────────────────────────────────────────
  { label: '출근', acceptableEmojis: ['🚇', '🚌', '🚗', '🚶'] },
  { label: '오전 업무', acceptableEmojis: ['💻', '📈', '🏢', '📊'] },
  { label: '퇴근', acceptableEmojis: ['🚇', '🚌', '🚗', '🚶'] },
  { label: '오후 업무', acceptableEmojis: ['📈', '💻', '🏢', '📊'] },
  { label: '점심', acceptableEmojis: ['🍱', '🍚', '🍝', '🍽️'] },
  { label: '저녁', acceptableEmojis: ['🍚', '🍕', '🍱', '🍽️'] },
  { label: '운동', acceptableEmojis: ['🏃', '🚶', '🏋️', '⚽'] },
  { label: '여가', acceptableEmojis: ['🎮', '📺', '🛋️', '🌈'] },
  { label: '취침준비', acceptableEmojis: ['🌙', '🛀', '💤'] },
  { label: '수면', acceptableEmojis: ['💤'] },

  // ─── 자영업자 (9) ─────────────────────────────────────────────────────────
  { label: '가게 준비·청소', acceptableEmojis: ['🧹', '🏪', '🏢'] },
  { label: '영업 (오전)', acceptableEmojis: ['🏪', '💼', '📈'] },
  { label: '점심·휴식', acceptableEmojis: ['🍱', '🍚', '🛋️', '🍽️'] },
  { label: '영업 (오후)', acceptableEmojis: ['🏪', '💼', '📈'] },
  { label: '브레이크', acceptableEmojis: ['☕', '🛋️', '🌈'] },
  { label: '마감 정리', acceptableEmojis: ['📋', '🗒️', '📊'] },
  { label: '저녁', acceptableEmojis: ['🍚', '🍕', '🍱', '🍽️'] },
  { label: '여가', acceptableEmojis: ['🎮', '📺', '🛋️', '🌈'] },
  { label: '수면', acceptableEmojis: ['💤'] },

  // ─── 은퇴자 (9) ──────────────────────────────────────────────────────────
  { label: '기상', acceptableEmojis: ['🌅', '☕', '🍳'] },
  { label: '산책·운동', acceptableEmojis: ['🚶', '🏃', '🌳'] },
  { label: '취미·독서', acceptableEmojis: ['📚', '📖', '🎨'] },
  { label: '점심', acceptableEmojis: ['🍱', '🍚', '🍝', '🍽️'] },
  { label: '휴식·낮잠', acceptableEmojis: ['🛌', '🛋️', '💤'] },
  { label: '가족 시간·TV', acceptableEmojis: ['📺', '👨‍👩‍👧', '🎮'] },
  { label: '정원·취미', acceptableEmojis: ['🌷', '🌳', '🎨'] },
  { label: '저녁', acceptableEmojis: ['🍚', '🍕', '🍱', '🍽️'] },
  { label: '수면', acceptableEmojis: ['💤'] },
];

describe('E1a: preset label dictionary coverage', () => {
  PRESET_LABELS.forEach(({ label, acceptableEmojis }) => {
    it(`"${label}" resolves to one of [${acceptableEmojis.join(', ')}] in top-3`, () => {
      const results = suggestIcons(label, 3);
      const foundEmojis = results.map((r) => r.emoji);
      const hasMatch = foundEmojis.some((e) => acceptableEmojis.includes(e));
      expect(
        hasMatch,
        `Label "${label}" top-3 was [${foundEmojis.join(', ')}], expected one of [${acceptableEmojis.join(', ')}]`,
      ).toBe(true);
    });
  });

  it('covers all 47 preset labels', () => {
    expect(PRESET_LABELS.length).toBe(47);
  });
});
