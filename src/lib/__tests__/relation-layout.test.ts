import { describe, expect, it } from 'vitest';
import { RELATION_GROUPS, type Person, type RelationGroup } from '../relation';
import {
  ME_R, NODE_PAD, NODE_R, angleOf, layoutRelation, nodeAt, polarOf, ringBase, xyOf,
} from '../relation-layout';

const p = (id: string, group: RelationGroup = 'friend', closeness: 1 | 2 | 3 = 2): Person =>
  ({ id, name: id, group, closeness, createdAt: '' });

const many = (n: number, group: RelationGroup = 'friend') =>
  Array.from({ length: n }, (_, i) => p(`${group}-${i}`, group));

/** The smallest gap between any two node edges on the map. */
function tightest(nodes: ReturnType<typeof layoutRelation>['nodes']): number {
  let min = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = xyOf(nodes[i]);
      const b = xyOf(nodes[j]);
      min = Math.min(min, Math.hypot(a.x - b.x, a.y - b.y) - nodes[i].r - nodes[j].r);
    }
  }
  return min;
}

describe('where a person stands', () => {
  it('is exactly where their id says, when nobody is crowding them', () => {
    const l = layoutRelation([p('a', 'family'), p('b', 'work'), p('c', 'other')]);
    for (const n of l.nodes) expect(n.a).toBe(angleOf(n.person.id));
  });

  it('barely shifts when someone else arrives', () => {
    const before = layoutRelation(many(6));
    const after = layoutRelation([...many(6), p('newcomer')]);
    const at = (l: typeof before, id: string) => l.nodes.find((n) => n.person.id === id)!;
    for (const n of before.nodes) {
      const moved = Math.abs(at(after, n.person.id).a - n.a);
      expect(Math.min(moved, 1 - moved)).toBeLessThan(0.05);
    }
  });

  it('is the same every time, whatever order the people arrive in', () => {
    const one = layoutRelation([p('a'), p('b'), p('c')]);
    const two = layoutRelation([p('c'), p('a'), p('b')]);
    const key = (l: typeof one) => l.nodes.map((n) => [n.person.id, n.a.toFixed(6), n.d.toFixed(3)]).sort();
    expect(key(two)).toEqual(key(one));
  });

  it('gives an angle in one turn, and the same one twice', () => {
    for (const id of ['a', 'zzz', '01234567-89ab-cdef']) {
      expect(angleOf(id)).toBeGreaterThanOrEqual(0);
      expect(angleOf(id)).toBeLessThan(1);
      expect(angleOf(id)).toBe(angleOf(id));
    }
  });
});

describe('the rings', () => {
  it('put family nearest and the rest further out, in order', () => {
    const bases = RELATION_GROUPS.map(ringBase);
    expect([...bases].sort((x, y) => x - y)).toEqual(bases);
  });

  it('are drawn only where somebody stands', () => {
    const l = layoutRelation([p('a', 'family'), p('b', 'work')]);
    expect(l.rings.map((r) => r.group)).toEqual(['family', 'work']);
    expect(layoutRelation([]).rings).toEqual([]);
  });

  it('pull the closest people a little way inward, and draw them bigger', () => {
    const l = layoutRelation([p('near', 'family', 3), p('far', 'family', 1)]);
    const near = l.nodes.find((n) => n.person.id === 'near')!;
    const far = l.nodes.find((n) => n.person.id === 'far')!;
    expect(near.d).toBeLessThan(far.d);
    expect(near.r).toBe(NODE_R[3]);
    expect(far.r).toBe(NODE_R[1]);
  });

  it('grow rather than let anyone overlap', () => {
    const crowded = layoutRelation(many(40, 'family'));
    expect(crowded.rings[0].d).toBeGreaterThan(ringBase('family'));
    expect(tightest(crowded.nodes)).toBeGreaterThan(0);
  });
});

describe('crowding', () => {
  it('leaves room between every pair, even at three hundred people', () => {
    const crowd = RELATION_GROUPS.flatMap((g) => many(75, g));
    const l = layoutRelation(crowd);
    expect(l.nodes).toHaveLength(300);
    // Rings are far apart, so the test that matters is inside each one.
    for (const group of RELATION_GROUPS) {
      const band = l.nodes.filter((n) => n.person.group === group);
      expect(tightest(band)).toBeGreaterThan(NODE_PAD * 0.4);
    }
  });

  it('is fast enough to be worth doing on every render', () => {
    const crowd = RELATION_GROUPS.flatMap((g) => many(75, g));
    const started = performance.now();
    for (let i = 0; i < 20; i++) layoutRelation(crowd);
    expect(performance.now() - started).toBeLessThan(2000);
  });
});

describe('somebody put somewhere by hand', () => {
  it('stays exactly there, and does not push the ring about', () => {
    const l = layoutRelation([p('fixed'), p('free')]);
    const moved = layoutRelation([{ ...p('fixed'), at: { a: 0.25, r: 0.5 } }, p('free')]);
    const at = (x: typeof l, id: string) => x.nodes.find((n) => n.person.id === id)!;
    expect(at(moved, 'fixed').a).toBe(0.25);
    expect(at(moved, 'fixed').fixed).toBe(true);
    expect(at(moved, 'free').a).toBeCloseTo(at(l, 'free').a, 6);
  });
});

describe('the map on screen', () => {
  it('reads like a clock: a quarter turn is to the right of the middle', () => {
    const { x, y } = xyOf({ a: 0.25, d: 100 });
    expect(x).toBeCloseTo(100, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(xyOf({ a: 0, d: 100 }).y).toBeCloseTo(-100, 6);
  });

  it('turns a point back into a turn and a distance', () => {
    for (const a of [0, 0.1, 0.25, 0.6, 0.99]) {
      const back = polarOf(xyOf({ a, d: 140 }).x, xyOf({ a, d: 140 }).y);
      expect(back.a).toBeCloseTo(a, 6);
      expect(back.d).toBeCloseTo(140, 6);
    }
  });

  it('reaches far enough out to hold everyone and me', () => {
    expect(layoutRelation([]).extent).toBe(ME_R);
    const l = layoutRelation([p('a', 'other')]);
    expect(l.extent).toBeGreaterThanOrEqual(ringBase('other'));
  });

  it('finds the person under a finger, and nobody under empty space', () => {
    const l = layoutRelation([p('a'), p('b')]);
    const a = l.nodes.find((n) => n.person.id === 'a')!;
    const at = xyOf(a);
    expect(nodeAt(l, at.x, at.y)?.person.id).toBe('a');
    // A little off is still a tap on them; the far side of the map is not.
    expect(nodeAt(l, at.x + a.r + 3, at.y)?.person.id).toBe('a');
    expect(nodeAt(l, 0, 0)).toBeNull();
  });
});
