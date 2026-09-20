/**
 * The world as a ball.
 *
 * An orthographic projection — the view from very far away, which is what the
 * earth looks like from space and what a paper globe looks like on a desk.
 * No 3D library: a sphere seen this way is two lines of trigonometry per
 * point, and everything else is knowing which half is facing you.
 *
 * All the difficulty is at the edge, and it is worth naming, because getting
 * it wrong is what puts wedges across the middle of the globe:
 *
 *  · An outline that runs over the horizon is cut there, and each cut is
 *    walked out to the rim rather than left at whichever point happened to be
 *    the last visible one.
 *  · A ring that is visible at both its first and last point is ONE stretch
 *    wrapped around the end of the list, not two.
 *  · A country is FILLED by a different rule than it is outlined. Every point
 *    of the ring is kept, and the ones round the back are pushed straight out
 *    to the rim, so the shape closes along the edge of the globe by itself.
 *    Deciding which way round the rim to close instead — by sampling — gets
 *    Russia wrong and floods the whole ball with one colour.
 *  · Halfway between two places is not the average of their longitudes when
 *    they sit either side of the date line.
 */
import type { CountryShape } from './place';

const RAD = Math.PI / 180;

export interface Camera {
  /** The longitude and latitude facing the viewer. */
  lng: number;
  lat: number;
  /** 1 fills the box; more than that is a closer look. */
  zoom: number;
}

export interface Screen {
  /** Middle of the globe, in pixels. */
  cx: number;
  cy: number;
  /** Its radius, in pixels. */
  r: number;
}

/** How far in and out the globe may be turned. */
export const GLOBE_MIN_ZOOM = 0.9;
export const GLOBE_MAX_ZOOM = 8;
/** The cities of one's own life appear at this zoom, and are named at the
 *  next one. */
export const CITY_DOT_ZOOM = 1.5;
export const CITY_NAME_ZOOM = 2.4;
/** Past this, the world's own cities start appearing under the countries —
 *  the capitals first, and more of them the closer the globe is brought. */
export const WORLD_CITY_ZOOM = 2.5;
/** How many ranks of city open up for each step of zoom. */
export const RANK_PER_ZOOM = 2;
/** The least important rank there is. */
export const LAST_CITY_RANK = 10;

/**
 * How far down the list of cities to go at this zoom: -1 for none at all,
 * 0 for the capitals, and up to LAST_CITY_RANK for every town in the file.
 *
 * Opening it a rank at a time is what keeps the globe legible. All seven
 * thousand at once is a grey smear; the capitals alone, on a globe held at
 * arm's length, is a map.
 */
export const cityRankAt = (zoom: number): number => (
  zoom < WORLD_CITY_ZOOM
    ? -1
    : Math.min(LAST_CITY_RANK, Math.floor((zoom - WORLD_CITY_ZOOM) * RANK_PER_ZOOM))
);

/** A city is named once it is well inside the cut, never as it arrives. */
export const cityNamedAt = (rank: number, cut: number): boolean => rank + 3 <= cut;
/** No step of a coastline may span more than this, or it is drawn as a chord
 *  across the curve of the globe instead of along it. */
export const MAX_STEP_DEG = 3;

/** The globe's place on screen for a box of this size. */
export const screenOf = (w: number, h: number, zoom: number): Screen => ({
  cx: w / 2,
  cy: h / 2,
  r: (Math.min(w, h) / 2) * 0.92 * zoom,
});

export interface Point { x: number; y: number; front: boolean }

/** One place on the globe, and whether it is on the half we can see. */
export function project(lng: number, lat: number, cam: Camera, s: Screen): Point {
  const p = lat * RAD;
  const l = (lng - cam.lng) * RAD;
  const p0 = cam.lat * RAD;
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
  return {
    x: s.cx + s.r * Math.cos(p) * Math.sin(l),
    y: s.cy - s.r * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)),
    front: cosc > 0,
  };
}

/** The place under a point on screen, or null off the edge of the world. */
export function unproject(sx: number, sy: number, cam: Camera, s: Screen): { lng: number; lat: number } | null {
  const x = (sx - s.cx) / s.r;
  const y = (s.cy - sy) / s.r;
  const rho = Math.hypot(x, y);
  if (rho > 1) return null;
  const c = Math.asin(Math.min(1, rho));
  const p0 = cam.lat * RAD;
  if (rho === 0) return { lng: cam.lng, lat: cam.lat };
  const lat = Math.asin(Math.cos(c) * Math.sin(p0) + (y * Math.sin(c) * Math.cos(p0)) / rho) / RAD;
  const lng = cam.lng + Math.atan2(
    x * Math.sin(c),
    rho * Math.cos(c) * Math.cos(p0) - y * Math.sin(c) * Math.sin(p0),
  ) / RAD;
  return { lng: ((lng + 540) % 360) - 180, lat };
}

/** Is this place on the half of the world facing us? */
export const facing = (lng: number, lat: number, cam: Camera): boolean => {
  const p0 = cam.lat * RAD;
  return Math.sin(p0) * Math.sin(lat * RAD)
    + Math.cos(p0) * Math.cos(lat * RAD) * Math.cos((lng - cam.lng) * RAD) > 0;
};

/** Longitudes wrap: the way between two of them is the short way. */
const lngStep = (from: number, to: number): number => {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};

const wrapLng = (lng: number): number => ((lng + 540) % 360) - 180;

/**
 * Extra points along any step long enough to show the curve of the globe.
 * Done once when the world is loaded, not every frame.
 */
export function densify(ring: ReadonlyArray<readonly [number, number]>, step = MAX_STEP_DEG): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    out.push([a[0], a[1]]);
    const b = ring[i + 1];
    if (!b) break;
    const dl = lngStep(a[0], b[0]);
    const dp = b[1] - a[1];
    const parts = Math.ceil(Math.max(Math.abs(dl), Math.abs(dp)) / step);
    for (let k = 1; k < parts; k++) {
      out.push([wrapLng(a[0] + (dl * k) / parts), a[1] + (dp * k) / parts]);
    }
  }
  return out;
}

/** Every ring of a country, with the long steps filled in. */
export const densifyShape = (shape: CountryShape): CountryShape => ({
  ...shape,
  rings: shape.rings.map((ring) => densify(ring)),
});

/** Walk along the way between two places to the horizon between them. */
function toHorizon(
  a: readonly [number, number],
  b: readonly [number, number],
  cam: Camera,
  steps = 14,
): [number, number] {
  const near = facing(a[0], a[1], cam);
  let lo = 0;
  let hi = 1;
  // Walk in the SHORT direction, so a step over the date line does not go
  // halfway round the world looking for its middle.
  const dl = lngStep(a[0], b[0]);
  const dp = b[1] - a[1];
  const at = (f: number): [number, number] => [wrapLng(a[0] + dl * f), a[1] + dp * f];
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2;
    const p = at(mid);
    if (facing(p[0], p[1], cam) === near) lo = mid;
    else hi = mid;
  }
  return at(lo);
}

/**
 * The whole of a ring as a shape to fill: what faces us where it is, and
 * everything round the back pushed out to the rim it disappeared behind. The
 * outline of the globe then closes the country for us, at no cost and with no
 * choice to get wrong. Null when none of it is facing us at all.
 */
export function ringFill(
  ring: ReadonlyArray<readonly [number, number]>,
  cam: Camera,
  s: Screen,
): Array<[number, number]> | null {
  let any = false;
  const out: Array<[number, number]> = [];
  for (const p of ring) {
    const q = project(p[0], p[1], cam, s);
    if (q.front) {
      any = true;
      out.push([q.x, q.y]);
    } else {
      // The far side folds onto the same disc, so its bearing from the middle
      // is still the bearing it went over the edge at.
      const a = Math.atan2(q.y - s.cy, q.x - s.cx);
      out.push([s.cx + Math.cos(a) * s.r, s.cy + Math.sin(a) * s.r]);
    }
  }
  return any ? out : null;
}

/**
 * One ring, cut into the stretches of it that face us, each in pixels: the
 * outline, as against the fill.
 */
export function visibleRuns(
  ring: ReadonlyArray<readonly [number, number]>,
  cam: Camera,
  s: Screen,
): Array<Array<[number, number]>> {
  const n = ring.length;
  if (!n) return [];
  const seen = ring.map((p) => facing(p[0], p[1], cam));
  if (seen.every(Boolean)) {
    return [ring.map((p) => { const q = project(p[0], p[1], cam, s); return [q.x, q.y] as [number, number]; })];
  }
  if (!seen.some(Boolean)) return [];

  const runs: Array<{ points: Array<[number, number]>; opened: boolean; closed: boolean }> = [];
  let run: { points: Array<[number, number]>; opened: boolean; closed: boolean } | null = null;
  for (let i = 0; i < n; i++) {
    if (seen[i]) {
      if (!run) {
        run = { points: [], opened: false, closed: false };
        const before = ring[(i - 1 + n) % n];
        if (!seen[(i - 1 + n) % n]) {
          const edge = toHorizon(ring[i], before, cam);
          const p = project(edge[0], edge[1], cam, s);
          run.points.push([p.x, p.y]);
          run.opened = true;
        }
      }
      const p = project(ring[i][0], ring[i][1], cam, s);
      run.points.push([p.x, p.y]);
    } else if (run) {
      const edge = toHorizon(ring[(i - 1 + n) % n], ring[i], cam);
      const p = project(edge[0], edge[1], cam, s);
      run.points.push([p.x, p.y]);
      run.closed = true;
      runs.push(run);
      run = null;
    }
  }
  if (run) {
    // The ring was still visible when the list ran out. If it was visible at
    // the very start too, this is the same stretch wrapped around the end —
    // one piece, not two.
    if (runs.length && !runs[0].opened) {
      runs[0].points = [...run.points, ...runs[0].points];
      runs[0].opened = run.opened;
    } else {
      runs.push(run);
    }
  }

  return runs.filter((r) => r.points.length >= 2).map((r) => r.points);
}

/** Is any part of this country on the half facing us? (A cheap first pass.) */
export function anyFacing(shape: CountryShape, cam: Camera): boolean {
  for (const ring of shape.rings) {
    for (let i = 0; i < ring.length; i += 4) {
      if (facing(ring[i][0], ring[i][1], cam)) return true;
    }
  }
  return false;
}

/** Turning the globe by a drag: pixels across → degrees around. The further
 *  in it is zoomed, the less a finger moves it. */
export function turn(cam: Camera, dx: number, dy: number, s: Screen): Camera {
  const perPixel = 90 / Math.max(1, s.r);
  return {
    ...cam,
    lng: wrapLng(cam.lng - dx * perPixel),
    // Stop short of the poles: past them the world turns upside down.
    lat: Math.max(-85, Math.min(85, cam.lat + dy * perPixel)),
  };
}

/** The meridians and parallels, as places to draw lines through. */
export function graticule(step = 30): Array<Array<[number, number]>> {
  const lines: Array<Array<[number, number]>> = [];
  for (let lng = -180; lng < 180; lng += step) {
    const line: Array<[number, number]> = [];
    for (let lat = -80; lat <= 80; lat += 4) line.push([lng, lat]);
    lines.push(line);
  }
  for (let lat = -60; lat <= 60; lat += step) {
    const line: Array<[number, number]> = [];
    for (let lng = -180; lng <= 180; lng += 4) line.push([lng, lat]);
    lines.push(line);
  }
  return lines;
}
