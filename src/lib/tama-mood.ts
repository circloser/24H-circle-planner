/**
 * How a pet is feeling — the single source of truth for its FACE and for how it
 * moves. Kept free of React and of the tamagotchi hook (structural params only)
 * so both the art and the movement tick can read it, and so it can be tested
 * on its own.
 *
 * The design rule: a pet's state is shown by the pet, not by a badge floating
 * over its head. Emoji bubbles for hunger and grime were hard to read at 40px
 * and told the user nothing they could act on; a hungry pet now frowns and
 * plants itself, and a pet near a dropping walks away from it — the mess
 * becomes visible because the animals refuse to stand in it.
 */

/** Faces, ordered loosely from worst to best. */
export type Mood = 'dead' | 'sleeping' | 'tired' | 'hungry' | 'dirty' | 'happy' | 'content';

/** Below this the pet frowns and stops wandering. Matches the old 🍽️ badge. */
export const HUNGRY_AT = 30;
/** Shared hygiene below this turns every pet queasy. */
export const DIRTY_AT = 20;
/** Energy below this is the auto-nap threshold (LOW_ENERGY in useTamagotchi). */
export const TIRED_AT = 20;

export interface MoodInput {
  phase: string;
  sleeping: boolean;
  hunger: number;
  energy: number;
}

/**
 * Pick the face. Priority is "what stops the pet from being a happy animal
 * first": death, then sleep, then exhaustion, then hunger, then filth.
 * `playing` (a tap just landed) beats everything except death and sleep, so
 * interacting always gets a visible reaction.
 */
export function petMood(p: MoodInput, hygiene: number, playing = false): Mood {
  if (p.phase === 'dead') return 'dead';
  if (p.sleeping) return 'sleeping';
  if (playing) return 'happy';
  if (p.energy < TIRED_AT) return 'tired';
  if (p.hunger < HUNGRY_AT) return 'hungry';
  if (hygiene < DIRTY_AT) return 'dirty';
  return 'content';
}

/**
 * Movement speed multiplier for a mood. A hungry pet has no energy to spare:
 * it stays put and only shuffles, which is the whole tell now that the food
 * badge is gone. A queasy one is merely sluggish.
 */
export function moodSpeedFactor(mood: Mood): number {
  if (mood === 'hungry') return 0.12;
  if (mood === 'tired') return 0.45;
  if (mood === 'dirty') return 0.8;
  return 1;
}

/** Wander jitter multiplier — a hungry pet barely changes direction either. */
export function moodJitterFactor(mood: Mood): number {
  return mood === 'hungry' ? 0.25 : 1;
}
