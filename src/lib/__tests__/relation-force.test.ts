import { describe, expect, it } from 'vitest';
import {
  COLD, ME_ROOM, PAD, cool, gripFor, restFor, settle, stepWorld, type Body, type Tie,
} from '../relation-force';
import { angleOf } from '../relation-layout';

/** People seeded the way the canvas seeds them: their own angle, their ring. */
const crowd = (n: number, want = 150): Body[] =>
  Array.from({ length: n }, (_, i) => {
    const a = angleOf(`p${i}`) * Math.PI * 2;
    return { id: `p${i}`, x: Math.sin(a) * want, y: -Math.cos(a) * want, vx: 0, vy: 0, r: 10, want };
  });

const gap = (bodies: Body[]): number => {
  let least = Infinity;
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      least = Math.min(least, Math.hypot(bodies[i].x - bodies[j].x, bodies[i].y - bodies[j].y)
        - bodies[i].r - bodies[j].r);
    }
  }
  return least;
};

describe('the map with weight in it', () => {
  it('settles, and stays settled', () => {
    const bodies = settle(crowd(12), []);
    const before = bodies.map((b) => ({ x: b.x, y: b.y }));
    stepWorld(bodies, [], COLD);
    const moved = Math.max(...bodies.map((b, i) => Math.hypot(b.x - before[i].x, b.y - before[i].y)));
    expect(moved).toBeLessThan(1.5);
  });

  it('is the same map every time, for the same people', () => {
    const one = settle(crowd(20), []).map((b) => `${b.id}:${b.x.toFixed(4)}:${b.y.toFixed(4)}`);
    const two = settle(crowd(20), []).map((b) => `${b.id}:${b.x.toFixed(4)}:${b.y.toFixed(4)}`);
    expect(two).toEqual(one);
  });

  it('leaves nobody standing on anybody', () => {
    expect(gap(settle(crowd(40), []))).toBeGreaterThan(0);
    // Even when they all start in exactly the same spot.
    const heap: Body[] = Array.from({ length: 12 }, (_, i) => (
      { id: `h${i}`, x: 0, y: 0, vx: 0, vy: 0, r: 9, want: 150 }
    ));
    expect(gap(settle(heap, []))).toBeGreaterThan(0);
  });

  it('keeps everybody off the middle, which is me', () => {
    const bodies = settle(crowd(15, 40), []);
    for (const b of bodies) expect(Math.hypot(b.x, b.y)).toBeGreaterThanOrEqual(ME_ROOM + b.r - 0.5);
  });

  it('holds the near near and the far far', () => {
    const bodies = settle([
      { id: 'near', x: 0, y: -150, vx: 0, vy: 0, r: 10, want: 120 },
      { id: 'far', x: 150, y: 0, vx: 0, vy: 0, r: 10, want: 320 },
    ], []);
    const [near, far] = bodies;
    expect(Math.hypot(near.x, near.y)).toBeLessThan(Math.hypot(far.x, far.y));
    expect(Math.hypot(near.x, near.y)).toBeGreaterThan(60);
  });

  it('pulls two people who are tied to each other together', () => {
    const apart = () => [
      { id: 'a', x: -300, y: 0, vx: 0, vy: 0, r: 10, want: 300 },
      { id: 'b', x: 300, y: 0, vx: 0, vy: 0, r: 10, want: 300 },
    ] as Body[];
    const loose = settle(apart(), []);
    const tie: Tie[] = [{ a: 'a', b: 'b', rest: restFor(apart()[0], apart()[1]) }];
    const tied = settle(apart(), tie);
    const far = (b: Body[]) => Math.hypot(b[0].x - b[1].x, b[0].y - b[1].y);
    expect(far(tied)).toBeLessThan(far(loose));
  });

  it('does not move a body that is being held', () => {
    const bodies: Body[] = [
      { id: 'held', x: 10, y: 10, vx: 0, vy: 0, r: 10, want: 150, pinned: true },
      ...crowd(6),
    ];
    settle(bodies, []);
    expect(bodies[0].x).toBe(10);
    expect(bodies[0].y).toBe(10);
  });

  it('cools to nothing and no further', () => {
    let alpha = 1;
    for (let i = 0; i < 400; i++) alpha = cool(alpha);
    expect(alpha).toBeLessThan(COLD);
    expect(alpha).toBeGreaterThanOrEqual(0);
  });

  it('is quick enough for a frame, with a crowd on it', () => {
    const bodies = crowd(120);
    const started = performance.now();
    for (let i = 0; i < 10; i++) stepWorld(bodies, [], 0.5);
    expect(performance.now() - started).toBeLessThan(400);
  });

  it('keeps the clear space it promises', () => {
    expect(gap(settle(crowd(25), []))).toBeGreaterThan(PAD * 0.5);
  });
});

describe('a tie of its own strength', () => {
  const pair = (): Body[] => [
    { id: 'a', x: -300, y: 0, vx: 0, vy: 0, r: 10, want: 320 },
    { id: 'b', x: 300, y: 0, vx: 0, vy: 0, r: 10, want: 320 },
  ];
  const apart = (closeness: number): number => {
    const bodies = pair();
    settle(bodies, [{ a: 'a', b: 'b', rest: restFor(bodies[0], bodies[1], closeness), grip: gripFor(closeness) }]);
    return Math.hypot(bodies[0].x - bodies[1].x, bodies[0].y - bodies[1].y);
  };

  it('holds a close pair closer than a distant one', () => {
    expect(apart(5)).toBeLessThan(apart(3));
    expect(apart(3)).toBeLessThan(apart(1));
  });

  it('leaves the middle rung where an unsaid tie has always been', () => {
    const bodies = pair();
    expect(restFor(bodies[0], bodies[1])).toBe(restFor(bodies[0], bodies[1], 3));
    expect(gripFor()).toBe(gripFor(3));
  });

  it('never pulls two people into each other', () => {
    const bodies = pair();
    settle(bodies, [{ a: 'a', b: 'b', rest: 0, grip: gripFor(5) }]);
    expect(Math.hypot(bodies[0].x - bodies[1].x, bodies[0].y - bodies[1].y))
      .toBeGreaterThanOrEqual(bodies[0].r + bodies[1].r);
  });

  it('takes a rung that is not one as the middle', () => {
    const bodies = pair();
    expect(restFor(bodies[0], bodies[1], 99)).toBe(restFor(bodies[0], bodies[1], 5));
    expect(gripFor(-4)).toBe(gripFor(1));
  });
});
