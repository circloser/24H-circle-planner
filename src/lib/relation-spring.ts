/**
 * The give in the map.
 *
 * Dragging someone used to move them to the fingertip exactly, frame for
 * frame, which is correct and feels like nothing at all. Here the finger pulls
 * and the person follows: a spring with enough damping that it settles without
 * wobbling about, and lines that bow while they are being stretched.
 *
 * It is plain arithmetic on purpose — no library, nothing to install, and each
 * piece is a function that can be tested on its own. The canvas keeps one of
 * these per moving thing and steps it once a frame.
 */

export interface Spring {
  /** Where it is now. */
  x: number;
  y: number;
  /** How fast it is going, in units a second. */
  vx: number;
  vy: number;
}

/** How hard the spring pulls. Higher is snappier. */
export const STIFFNESS = 170;
/** How much of the speed is taken away. At 2·√k it settles without wobbling
 *  at all; three quarters of that gives the single small overshoot that reads
 *  as weight rather than as a bug. */
export const DAMPING = 2 * Math.sqrt(STIFFNESS) * 0.75;
/** Below this it has arrived, and the frames can stop. */
export const REST = 0.05;
/** No step longer than this, whatever the browser says. A tab returning from
 *  the background hands out a gap of seconds, and a spring integrated over a
 *  second in one go flies off the screen. */
export const MAX_STEP = 1 / 30;

export const springAt = (x: number, y: number): Spring => ({ x, y, vx: 0, vy: 0 });

/**
 * One step towards the target. `dt` is in seconds and is clamped, so a
 * dropped frame slows the motion down rather than breaking it.
 */
export function stepSpring(
  s: Spring, tx: number, ty: number, dt: number, k = STIFFNESS, c = DAMPING,
): Spring {
  const h = Math.min(Math.max(dt, 0), MAX_STEP);
  if (h === 0) return s;
  // Semi-implicit Euler: the new speed moves the position, which is stable
  // at the step sizes a screen actually produces.
  const vx = s.vx + (-k * (s.x - tx) - c * s.vx) * h;
  const vy = s.vy + (-k * (s.y - ty) - c * s.vy) * h;
  return { x: s.x + vx * h, y: s.y + vy * h, vx, vy };
}

/** Has it stopped moving, near enough that another frame would show nothing? */
export const atRest = (s: Spring, tx: number, ty: number): boolean =>
  Math.hypot(s.x - tx, s.y - ty) < REST && Math.hypot(s.vx, s.vy) < REST * 10;

/**
 * How far a line bows while it is being pulled.
 *
 * A line at its resting length is straight. Stretched, it bows to the side,
 * a little more the further it is pulled, and never past `max` — so a person
 * dragged right across the map trails a curve rather than a hairpin.
 */
export function sagOf(length: number, rest: number, max = 26): number {
  if (!(rest > 0) || length <= rest) return 0;
  const over = (length - rest) / rest;
  return max * (1 - 1 / (1 + over));
}

/**
 * The control point of the bowed line from a to b: the middle, pushed
 * sideways by `sag`. Which side does not matter as long as it is the same
 * side every frame, so it is taken from the line's own direction.
 */
export function bowOf(
  ax: number, ay: number, bx: number, by: number, sag: number,
): { x: number; y: number } {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  if (sag === 0) return { x: mx, y: my };
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  // A quadratic curve only reaches halfway to its control point, so the point
  // goes twice as far out as the bow is meant to be deep.
  return { x: mx - (dy / len) * sag * 2, y: my + (dx / len) * sag * 2 };
}
