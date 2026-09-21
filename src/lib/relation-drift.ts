/**
 * The float.
 *
 * Nobody on the map sits perfectly still. Each person drifts a little way off
 * their own place and back again, the way something resting on water does —
 * never far enough to change where they are, only far enough that the map
 * reads as alive rather than as a printed diagram.
 *
 * It is a sum of two slow waves per axis rather than a random walk, which
 * matters for three reasons: it is a pure function of who and when, so any
 * frame can be drawn without keeping state between frames; the two periods do
 * not divide into each other, so the path never visibly repeats; and nothing
 * accumulates, so a tab left open all afternoon comes back to exactly the
 * same map as one just opened.
 *
 * The amplitude is small on purpose — smaller than the clear space the layout
 * keeps between circles, so drifting can never make two people touch, and
 * smaller than the slack in hit-testing, so what is under a finger is still
 * the person who looks as though they are under it.
 */

const TAU = Math.PI * 2;

/** How far anybody may wander from their own place, in layout units. */
export const DRIFT = 4.5;
/** The two periods, in seconds. Deliberately not multiples of each other. */
const SLOW = 11;
const SLOWER = 17;

export interface Drift { dx: number; dy: number }

/**
 * Where somebody is, relative to where they belong, at time `t` in seconds.
 *
 * `seed` is any number in 0–1 that is the person's own — lib/relation-layout's
 * angleOf(id) is what the canvas passes — so two people never float in step.
 */
export function driftAt(seed: number, t: number): Drift {
  const p = seed * TAU;
  // A little of the amplitude is the person's too: a map where everything
  // moves exactly as much reads as a wobble in the page, not as people.
  const size = DRIFT * (0.65 + 0.35 * Math.sin(p * 3));
  return {
    dx: size * (
      0.7 * Math.sin((t / SLOW) * TAU + p)
      + 0.3 * Math.sin((t / SLOWER) * TAU + p * 2.3)
    ),
    dy: size * (
      0.7 * Math.cos((t / (SLOW * 1.31)) * TAU + p * 1.7)
      + 0.3 * Math.cos((t / (SLOWER * 0.83)) * TAU + p * 0.6)
    ),
  };
}
