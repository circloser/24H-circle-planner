/**
 * The world as a ball.
 *
 * An orthographic projection — the view from very far away, which is what the
 * earth looks like from space and what a paper globe looks like on a desk.
 * No 3D library: a sphere seen this way is two lines of trigonometry per
 * point, and everything else is knowing which half is facing you.
 *
 * The hard part is the edge. A country that runs over the horizon has to be
 * cut there, or its coastline snaps across the middle of the globe; so each
 * ring is broken into the runs that face us, and each cut is walked to the
 * horizon itself rather than left at the last point that happened to be
 * visible.
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
/** Cities appear at this zoom, and are named at the next one. */
export const CITY_DOT_ZOOM = 1.5;
export const CITY_NAME_ZOOM = 2.4;

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

/** Walk along the great circle between two places to the horizon between them. */
function toHorizon(
  a: readonly [number, number],
  b: readonly [number, number],
  cam: Camera,
  steps = 12,
): [number, number] {
  let lo: [number, number] = [a[0], a[1]];
  let hi: [number, number] = [b[0], b[1]];
  const near = facing(a[0], a[1], cam);
  for (let i = 0; i < steps; i++) {
    // Halfway in plain coordinates is close enough at a degree of resolution.
    const mid: [number, number] = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
    if (facing(mid[0], mid[1], cam) === near) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * One ring, cut into the runs of it that face us, each already in pixels.
 * A ring entirely on the far side gives nothing back.
 */
export function visibleRuns(
  ring: ReadonlyArray<readonly [number, number]>,
  cam: Camera,
  s: Screen,
): Array<Array<[number, number]>> {
  const runs: Array<Array<[number, number]>> = [];
  let run: Array<[number, number]> | null = null;
  for (let i = 0; i < ring.length; i++) {
    const here = ring[i];
    const seen = facing(here[0], here[1], cam);
    if (seen) {
      if (!run) {
        run = [];
        // Start the run at the horizon rather than at the first point inland.
        const before = ring[(i - 1 + ring.length) % ring.length];
        if (!facing(before[0], before[1], cam)) {
          const edge = toHorizon(here, before, cam);
          const p = project(edge[0], edge[1], cam, s);
          run.push([p.x, p.y]);
        }
      }
      const p = project(here[0], here[1], cam, s);
      run.push([p.x, p.y]);
    } else if (run) {
      // Leave the run at the horizon too.
      const before = ring[(i - 1 + ring.length) % ring.length];
      const edge = toHorizon(before, here, cam);
      const p = project(edge[0], edge[1], cam, s);
      run.push([p.x, p.y]);
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);
  return runs.filter((r) => r.length >= 2);
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

/** The country under a place, or null out at sea. Shares the rule the flat
 *  map uses, so both agree about where a point is. */
export function countryAtPoint(
  shapes: readonly CountryShape[],
  lng: number,
  lat: number,
  inside: (lng: number, lat: number, ring: ReadonlyArray<readonly [number, number]>) => boolean,
): string | null {
  for (const s of shapes) {
    for (const ring of s.rings) {
      if (inside(lng, lat, ring)) return s.code;
    }
  }
  return null;
}

/** Turning the globe by a drag: pixels across → degrees around. The further
 *  in it is zoomed, the less a finger moves it. */
export function turn(cam: Camera, dx: number, dy: number, s: Screen): Camera {
  const perPixel = 90 / Math.max(1, s.r);
  return {
    ...cam,
    lng: ((cam.lng - dx * perPixel + 540) % 360) - 180,
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
