import { describe, it, expect } from 'vitest';
import {
  DIRTY_AT,
  HUNGRY_AT,
  TIRED_AT,
  moodJitterFactor,
  moodSpeedFactor,
  petMood,
  type MoodInput,
} from '../tama-mood';

const pet = (over: Partial<MoodInput> = {}): MoodInput => ({
  phase: 'adult',
  sleeping: false,
  hunger: 80,
  energy: 80,
  ...over,
});

describe('petMood', () => {
  it('is content when nothing is wrong', () => {
    expect(petMood(pet(), 100)).toBe('content');
  });

  it('frowns below the hunger threshold — the badge that used to say so is gone', () => {
    expect(petMood(pet({ hunger: HUNGRY_AT - 1 }), 100)).toBe('hungry');
    expect(petMood(pet({ hunger: HUNGRY_AT }), 100)).toBe('content');
  });

  it('turns queasy when the shared hygiene drops', () => {
    expect(petMood(pet(), DIRTY_AT - 1)).toBe('dirty');
    expect(petMood(pet(), DIRTY_AT)).toBe('content');
  });

  it('ranks exhaustion above hunger, and both above filth', () => {
    expect(petMood(pet({ energy: TIRED_AT - 1, hunger: 5 }), 0)).toBe('tired');
    expect(petMood(pet({ hunger: 5 }), 0)).toBe('hungry');
  });

  it('death and sleep outrank everything', () => {
    expect(petMood(pet({ phase: 'dead', hunger: 0, energy: 0 }), 0)).toBe('dead');
    expect(petMood(pet({ sleeping: true, hunger: 0, energy: 0 }), 0)).toBe('sleeping');
  });

  it('a tap always shows a reaction, even on a starving or filthy pet', () => {
    expect(petMood(pet({ hunger: 0, energy: 0 }), 0, true)).toBe('happy');
    // …but not on one that is asleep or dead — those need waking / burying.
    expect(petMood(pet({ sleeping: true }), 100, true)).toBe('sleeping');
    expect(petMood(pet({ phase: 'dead' }), 100, true)).toBe('dead');
  });
});

describe('mood movement factors', () => {
  it('all but stops a hungry pet, so standing still IS the hunger cue', () => {
    expect(moodSpeedFactor('hungry')).toBeLessThan(0.2);
    expect(moodJitterFactor('hungry')).toBeLessThan(0.5);
  });

  it('leaves a healthy pet at full pace and full wander', () => {
    for (const m of ['content', 'happy'] as const) {
      expect(moodSpeedFactor(m)).toBe(1);
      expect(moodJitterFactor(m)).toBe(1);
    }
  });

  it('slows a tired or queasy pet without freezing it', () => {
    for (const m of ['tired', 'dirty'] as const) {
      expect(moodSpeedFactor(m)).toBeGreaterThan(moodSpeedFactor('hungry'));
      expect(moodSpeedFactor(m)).toBeLessThan(1);
    }
  });
});
