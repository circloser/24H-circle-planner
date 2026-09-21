/**
 * The shape around a group.
 *
 * With the map worked out by forces, a group is no longer a band of the turn
 * that can be drawn as an arc — it is wherever its people have ended up. So
 * the boundary is drawn round them: the smallest ring of points that contains
 * the group (a convex hull), pushed outward far enough to clear the circles,
 * and then rounded off so it reads as a field rather than as a diagram.
 *
 * Arithmetic only, and tested as such.
 */

export interface Spot { x: number; y: number; r: number }
export type Point = readonly [number, number];

/**
 * The convex hull of a set of points, anticlockwise (Andrew's monotone chain).
 * Fewer than three points comes back as it went in.
 */
export function hullOf(points: readonly Point[]): Point[] {
  if (points.length < 3) return [...points];
  const sorted = [...points].sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  const cross = (o: Point, a: Point, b: Point) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: readonly Point[]): Point[] => {
    const out: Point[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/**
 * The boundary for one group: its people's circles, pushed out by `pad`.
 *
 * Each circle contributes a few points around itself rather than its centre,
 * so the hull clears the circle it is drawn around even where one person
 * stands at a corner of the group. One or two people therefore still make a
 * shape — a round one — which is what "a group of one" should look like.
 */
export function boundaryOf(spots: readonly Spot[], pad = 16): Point[] {
  if (!spots.length) return [];
  const around: Point[] = [];
  const steps = 10;
  for (const s of spots) {
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      around.push([s.x + Math.cos(a) * (s.r + pad), s.y + Math.sin(a) * (s.r + pad)]);
    }
  }
  return hullOf(around);
}

/**
 * A rounded path through the points, as a canvas path.
 *
 * Each corner is cut by `round` and joined with an arc, so the boundary has
 * no points in it — a hull drawn raw looks like a crystal, and a group of
 * people is not one.
 */
export function drawBoundary(
  ctx: { beginPath(): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void;
    arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void; closePath(): void },
  shape: readonly Point[],
  round = 22,
): void {
  if (shape.length < 3) return;
  ctx.beginPath();
  const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const first = mid(shape[shape.length - 1], shape[0]);
  ctx.moveTo(first[0], first[1]);
  for (let i = 0; i < shape.length; i++) {
    const corner = shape[i];
    const next = mid(corner, shape[(i + 1) % shape.length]);
    ctx.arcTo(corner[0], corner[1], next[0], next[1], round);
  }
  ctx.closePath();
}
