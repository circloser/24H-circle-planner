/**
 * Going somewhere on the map, rather than appearing there.
 *
 * Pressing "where am I" used to cut straight to the answer, which tells you
 * nothing about where it is. This takes the camera out, across and back in —
 * the way you would move a globe with your hands — so the place arrives with
 * some idea of how far away it was.
 *
 * Arithmetic only, so it can be tested without a browser: given where the
 * camera is, where it is going and how far along the flight is, it says where
 * the camera should be now.
 */

export interface Flight {
  lng: number;
  lat: number;
  zoom: number;
}

/** How long a flight takes. Long enough to read as travel, short enough that
 *  nobody waits for it. */
export const FLY_MS = 1100;

/** Slow at both ends, quick in the middle. */
export const ease = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2;
};

/** The shorter way round the world from one longitude to another. */
export function turnTo(from: number, to: number, t: number): number {
  let gap = ((to - from + 540) % 360) - 180;
  // Exactly opposite: go the way that reads as forward rather than jittering.
  if (Math.abs(gap) === 180) gap = 180;
  const at = from + gap * t;
  return ((at + 540) % 360) - 180;
}

/**
 * Where the camera is, `t` of the way (0–1) from `from` to `to`.
 *
 * `out` is how much of the zoom to give up at the middle of the flight, as a
 * share: 0.5 means the camera pulls back to half the closer of the two ends
 * before coming in again. The dip is a sine, so it leaves and arrives without
 * a kink.
 */
export function flyStep(from: Flight, to: Flight, t: number, out = 0.55): Flight {
  const e = ease(t);
  const zoom = from.zoom + (to.zoom - from.zoom) * e;
  const dip = 1 - out * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  return {
    lng: turnTo(from.lng, to.lng, e),
    lat: from.lat + (to.lat - from.lat) * e,
    zoom: zoom * dip,
  };
}

/**
 * The same for a tile map, whose zoom is counted in levels rather than in
 * times bigger — so the dip is subtracted rather than multiplied.
 */
export function flyLevels(
  from: Flight, to: Flight, t: number, out = 2.5, least = 0,
): Flight {
  const e = ease(t);
  const zoom = from.zoom + (to.zoom - from.zoom) * e - out * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  return {
    lng: turnTo(from.lng, to.lng, e),
    lat: from.lat + (to.lat - from.lat) * e,
    zoom: Math.max(least, zoom),
  };
}
