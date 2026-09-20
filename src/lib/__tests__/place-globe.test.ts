import { describe, expect, it } from 'vitest';
import {
  CITY_DOT_ZOOM, CITY_NAME_ZOOM, GLOBE_MAX_ZOOM, GLOBE_MIN_ZOOM, LAST_CITY_RANK, MAX_STEP_DEG,
  WORLD_CITY_ZOOM, anyFacing, cityNamedAt, cityRankAt, densify, densifyShape, facing, graticule,
  project, ringFill, screenOf, turn, unproject, visibleRuns,
} from '../place-globe';
import { capture, listOf, moveBetween, type Pointer } from '../gesture';
import type { CountryShape } from '../place';

const cam = (lng = 0, lat = 0, zoom = 1) => ({ lng, lat, zoom });
const S = screenOf(800, 800, 1);

describe('the world as a ball', () => {
  it('puts what is facing you in the middle, and the far side out of sight', () => {
    const middle = project(0, 0, cam(), S);
    expect(middle.x).toBeCloseTo(S.cx, 6);
    expect(middle.y).toBeCloseTo(S.cy, 6);
    expect(middle.front).toBe(true);
    // Straight through the earth from there.
    expect(project(180, 0, cam(), S).front).toBe(false);
    expect(facing(180, 0, cam())).toBe(false);
    expect(facing(89, 0, cam())).toBe(true);
  });

  it('turns a point on screen back into a place, and nothing off the edge', () => {
    for (const [lng, lat] of [[0, 0], [30, 20], [-45, -35], [10, 70]]) {
      const p = project(lng, lat, cam(), S);
      const back = unproject(p.x, p.y, cam(), S)!;
      expect(back.lng).toBeCloseTo(lng, 4);
      expect(back.lat).toBeCloseTo(lat, 4);
    }
    // Well outside the circle is not a place at all.
    expect(unproject(S.cx + S.r * 2, S.cy, cam(), S)).toBeNull();
  });

  it('is the same size whatever is facing you, and bigger when zoomed', () => {
    expect(screenOf(800, 600, 1).r).toBeCloseTo(276, 0);
    expect(screenOf(800, 600, 2).r).toBeCloseTo(552, 0);
    expect(GLOBE_MIN_ZOOM).toBeLessThan(1);
    expect(GLOBE_MAX_ZOOM).toBeGreaterThan(CITY_NAME_ZOOM);
    expect(CITY_DOT_ZOOM).toBeLessThan(CITY_NAME_ZOOM);
  });
});

describe('cutting a country at the horizon', () => {
  /** A ring that runs right around the equator, so half of it is always hidden. */
  const belt = Array.from({ length: 72 }, (_, i): [number, number] => [-180 + i * 5, 0]);

  it('gives back only the part facing you', () => {
    const runs = visibleRuns(belt, cam(), S);
    expect(runs.length).toBeGreaterThan(0);
    // Every point of every run is on the visible half.
    for (const run of runs) {
      for (const [x] of run) expect(Math.abs(x - S.cx)).toBeLessThanOrEqual(S.r + 0.001);
    }
  });

  it('walks each cut out to the edge, so a coast does not snap across the globe', () => {
    const runs = visibleRuns(belt, cam(), S);
    const ends = runs.flatMap((r) => [r[0], r[r.length - 1]]);
    // The ends of a cut sit on the rim, not somewhere inland.
    for (const [x, y] of ends) {
      expect(Math.hypot(x - S.cx, y - S.cy)).toBeGreaterThan(S.r * 0.98);
    }
  });

  it('says nothing at all for a ring entirely on the far side', () => {
    const far: Array<[number, number]> = [[175, 0], [180, 0], [-175, 0], [-175, 5], [175, 0]];
    expect(visibleRuns(far, cam(), S)).toEqual([]);
  });

  it('knows in one cheap pass whether a country is worth drawing', () => {
    const near: CountryShape = { code: 'AA', name: 'a', continent: 'Asia', rings: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
    const away: CountryShape = { code: 'BB', name: 'b', continent: 'Asia', rings: [[[179, 0], [178, 0], [178, 1], [179, 0]]] };
    expect(anyFacing(near, cam())).toBe(true);
    expect(anyFacing(away, cam())).toBe(false);
  });

  it('draws meridians and parallels to turn with it', () => {
    const lines = graticule(30);
    expect(lines.length).toBe(12 + 5);
    expect(lines.every((l) => l.length > 2)).toBe(true);
  });
});

describe('filling in a long coastline', () => {
  it('breaks any step too long to be drawn as a straight line', () => {
    const out = densify([[0, 0], [40, 0], [40, 30]]);
    expect(out.length).toBeGreaterThan(3);
    for (let i = 1; i < out.length; i++) {
      const dl = Math.abs(((out[i][0] - out[i - 1][0] + 540) % 360) - 180);
      expect(Math.max(dl, Math.abs(out[i][1] - out[i - 1][1]))).toBeLessThanOrEqual(MAX_STEP_DEG + 1e-9);
    }
  });

  it('goes the short way over the date line, not the long way round the world', () => {
    const out = densify([[175, 0], [-175, 0]]);
    // Every step in between is out by the date line, never back past zero.
    for (const [lng] of out) expect(Math.abs(lng)).toBeGreaterThan(170);
  });

  it('leaves a ring alone when every step is already short', () => {
    const ring: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 0]];
    expect(densify(ring)).toEqual(ring);
    expect(densifyShape({ code: 'AA', name: 'a', continent: 'Asia', rings: [ring] }).rings[0]).toEqual(ring);
  });
});

describe('filling a country that runs over the edge', () => {
  /** A belt around the equator, listed from a point that faces us. */
  const belt = Array.from({ length: 72 }, (_, i): [number, number] => [((i * 5 + 540) % 360) - 180, 0]);

  it('is one stretch when the visible part wraps past the end of the list', () => {
    // The list starts and ends facing us and dips behind in the middle: that
    // is ONE stretch of coast, not two.
    expect(facing(belt[0][0], belt[0][1], cam())).toBe(true);
    expect(facing(belt[belt.length - 1][0], belt[belt.length - 1][1], cam())).toBe(true);
    expect(visibleRuns(belt, cam(), S).length).toBe(1);
  });

  it('keeps every point, and lays the far side along the rim', () => {
    const out = ringFill(belt, cam(), S)!;
    expect(out.length).toBe(belt.length);
    // Nothing is outside the ball, and the hidden half sits exactly on it.
    let onRim = 0;
    for (const [x, y] of out) {
      const d = Math.hypot(x - S.cx, y - S.cy);
      expect(d).toBeLessThanOrEqual(S.r + 1e-6);
      if (d > S.r - 1e-6) onRim++;
    }
    expect(onRim).toBeGreaterThan(belt.length / 3);
  });

  it('leaves a country wholly in view exactly where it is', () => {
    const small: Array<[number, number]> = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]];
    const out = ringFill(small, cam(), S)!;
    expect(out).toEqual(small.map((p) => { const q = project(p[0], p[1], cam(), S); return [q.x, q.y]; }));
  });

  it('has nothing to fill for a country entirely round the back', () => {
    expect(ringFill([[175, 0], [180, 0], [-175, 0], [-175, 5], [175, 0]], cam(), S)).toBeNull();
  });
});

describe('the cities that appear as the globe is brought closer', () => {
  it('shows none at all until it is well zoomed in', () => {
    expect(cityRankAt(1)).toBe(-1);
    expect(cityRankAt(CITY_NAME_ZOOM)).toBe(-1);
    expect(cityRankAt(WORLD_CITY_ZOOM - 0.01)).toBe(-1);
  });

  it('starts with the capitals, and opens up from there', () => {
    // Rank 0 is a capital; the first thing the globe is willing to draw.
    expect(cityRankAt(WORLD_CITY_ZOOM)).toBe(0);
    expect(cityRankAt(3)).toBe(1);
    expect(cityRankAt(4)).toBe(3);
    expect(cityRankAt(6)).toBe(7);
  });

  it('never asks for a rank that is not in the file', () => {
    expect(cityRankAt(GLOBE_MAX_ZOOM)).toBe(LAST_CITY_RANK);
    expect(cityRankAt(1000)).toBe(LAST_CITY_RANK);
  });

  it('only opens up: closer never shows less', () => {
    let last = -Infinity;
    for (let z = GLOBE_MIN_ZOOM; z <= GLOBE_MAX_ZOOM; z += 0.1) {
      const cut = cityRankAt(z);
      expect(cut).toBeGreaterThanOrEqual(last);
      last = cut;
    }
  });

  it('writes a name only once the place is well inside the cut', () => {
    // A city that has only just arrived is a dot; three ranks later it has
    // room for its name.
    expect(cityNamedAt(0, 0)).toBe(false);
    expect(cityNamedAt(0, 2)).toBe(false);
    expect(cityNamedAt(0, 3)).toBe(true);
    expect(cityNamedAt(5, 8)).toBe(true);
    expect(cityNamedAt(8, 8)).toBe(false);
  });
});

describe('turning the globe', () => {
  it('follows the finger, and less so the closer it is', () => {
    const far = turn(cam(0, 0, 1), -100, 0, screenOf(800, 800, 1));
    const near = turn(cam(0, 0, 4), -100, 0, screenOf(800, 800, 4));
    expect(far.lng).toBeGreaterThan(0);
    expect(near.lng).toBeGreaterThan(0);
    expect(near.lng).toBeLessThan(far.lng);
  });

  it('stops short of the poles, where the world would turn over', () => {
    expect(turn(cam(0, 80), 0, 9999, S).lat).toBe(85);
    expect(turn(cam(0, -80), 0, -9999, S).lat).toBe(-85);
  });

  it('carries the longitude round the back rather than off the end', () => {
    expect(turn(cam(179, 0), -2000, 0, S).lng).toBeGreaterThanOrEqual(-180);
    expect(turn(cam(179, 0), -2000, 0, S).lng).toBeLessThanOrEqual(180);
  });
});

describe('two fingers on a map', () => {
  const p = (id: number, x: number, y: number): Pointer => ({ id, x, y });

  it('is a drag with one finger, and no zoom at all', () => {
    const move = moveBetween([p(1, 100, 100)], [p(1, 130, 90)]);
    expect(move).toMatchObject({ dx: 30, dy: -10, scale: 1 });
  });

  it('is a pinch with two: further apart is further in', () => {
    const out = moveBetween([p(1, 100, 100), p(2, 200, 100)], [p(1, 50, 100), p(2, 250, 100)]);
    expect(out.scale).toBeCloseTo(2, 6);
    expect(out.dx).toBeCloseTo(0, 6);
    const back = moveBetween([p(1, 50, 100), p(2, 250, 100)], [p(1, 100, 100), p(2, 200, 100)]);
    expect(back.scale).toBeCloseTo(0.5, 6);
  });

  it('pans and pinches at once', () => {
    const move = moveBetween([p(1, 100, 100), p(2, 200, 100)], [p(1, 150, 150), p(2, 350, 150)]);
    expect(move.scale).toBeCloseTo(2, 6);
    expect(move.dx).toBeCloseTo(100, 6);
    expect(move.dy).toBeCloseTo(50, 6);
  });

  it('ignores a finger that was not already down, so the map never jumps', () => {
    const move = moveBetween([p(1, 100, 100)], [p(1, 110, 100), p(2, 400, 400)]);
    expect(move).toMatchObject({ dx: 10, dy: 0, scale: 1 });
  });

  it('treats two fingers almost touching as no pinch at all', () => {
    expect(moveBetween([p(1, 100, 100), p(2, 102, 100)], [p(1, 100, 100), p(2, 106, 100)]).scale).toBe(1);
  });

  it('says nothing happened when every finger has left', () => {
    expect(moveBetween([p(1, 100, 100)], [])).toEqual({ dx: 0, dy: 0, scale: 1, cx: 0, cy: 0 });
  });

  it('keeps the pointers in the order they went down', () => {
    const map = new Map([[2, p(2, 1, 1)], [1, p(1, 0, 0)]]);
    expect(listOf(map).map((x) => x.id)).toEqual([2, 1]);
  });

  it('never lets a refused pointer capture stop the gesture', () => {
    const thrower = { setPointerCapture: () => { throw new Error('InvalidPointerId'); } } as unknown as Element;
    expect(() => capture(thrower, 7)).not.toThrow();
    expect(() => capture({} as Element, 7)).not.toThrow();
  });
});
