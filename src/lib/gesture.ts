/**
 * Two fingers on a map.
 *
 * A wheel is the only way a desktop zooms, so both maps started with only a
 * wheel — which left a phone with no way in or out at all. This is the small
 * amount of arithmetic a pinch needs, kept apart from the components so both
 * maps do it the same way and so it can be tested without a touchscreen.
 */

export interface Pointer { id: number; x: number; y: number }

export interface Move {
  /** How far the fingers moved together, in pixels. */
  dx: number;
  dy: number;
  /** How much further apart they got: 1 is no change. */
  scale: number;
  /** The point between them, which is what a pinch zooms about. */
  cx: number;
  cy: number;
}

const middle = (ps: readonly Pointer[]) => {
  let x = 0;
  let y = 0;
  for (const p of ps) {
    x += p.x;
    y += p.y;
  }
  return { x: x / ps.length, y: y / ps.length };
};

const spread = (ps: readonly Pointer[]): number =>
  (ps.length < 2 ? 0 : Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y));

/**
 * What happened between two moments of the same fingers being down. With one
 * finger it is a drag and the scale is 1; with two it is both at once.
 * Fingers that were not down before are ignored, so putting a second finger
 * down never makes the map jump.
 */
export function moveBetween(before: readonly Pointer[], after: readonly Pointer[]): Move {
  const ids = new Set(before.map((p) => p.id));
  const now = after.filter((p) => ids.has(p.id));
  const then = before.filter((p) => now.some((q) => q.id === p.id));
  if (!now.length) return { dx: 0, dy: 0, scale: 1, cx: 0, cy: 0 };
  const a = middle(then);
  const b = middle(now);
  const was = spread(then);
  const is = spread(now);
  return {
    dx: b.x - a.x,
    dy: b.y - a.y,
    // Below a few pixels apart the ratio is noise, not a pinch.
    scale: was > 8 && is > 8 ? is / was : 1,
    cx: b.x,
    cy: b.y,
  };
}

/** The pointers as a list, in the order they went down. */
export const listOf = (map: ReadonlyMap<number, Pointer>): Pointer[] => [...map.values()];

/**
 * Follow this pointer even when it leaves the element. Some browsers throw
 * rather than refuse when the pointer is not one they know about, and a map
 * that cannot capture a pointer should still work — so the failure is
 * swallowed rather than allowed to stop the gesture before it starts.
 */
export function capture(el: Element, pointerId: number): void {
  try {
    el.setPointerCapture?.(pointerId);
  } catch {
    /* not capturable — dragging still works, it just stops at the edge */
  }
}
