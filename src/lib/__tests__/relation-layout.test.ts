import { describe, expect, it } from 'vitest';
import { RELATION_GROUPS, type Person, type RelationGroup } from '../relation';
import {
  ME_R, MIN_SECTOR, NODE_PAD, NODE_R, angleOf, layoutRelation, nodeAt, polarOf, ringBase,
  sectorsOf, xyOf,
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
  it('is exactly where their id says, when their group has the map to itself', () => {
    const l = layoutRelation([p('a'), p('b'), p('c')]);
    for (const n of l.nodes) expect(n.a).toBe(angleOf(n.person.id));
  });

  it('is where their id says inside their own group\'s band', () => {
    const l = layoutRelation([p('a', 'family'), p('b', 'work'), p('c', 'other')]);
    const sectors = sectorsOf(new Map([['family', 1], ['work', 1], ['other', 1]]));
    for (const n of l.nodes) {
      const band = sectors.get(n.person.group)!;
      expect(n.a).toBeGreaterThanOrEqual(band.from);
      expect(n.a).toBeLessThanOrEqual(band.from + band.span);
      // Still their own id's turn, only read within the band rather than
      // around the whole map.
      const within = (n.a - band.from) / band.span;
      expect(within).toBeCloseTo(angleOf(n.person.id), 1);
    }
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

describe('a group keeps to one place', () => {
  it('shares the turn out between the groups that have anybody in them', () => {
    const sectors = sectorsOf(new Map([['family', 2], ['friend', 8]]));
    expect([...sectors.keys()]).toEqual(['family', 'friend']);
    const total = [...sectors.values()].reduce((s, v) => s + v.span, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(sectors.get('friend')!.span).toBeGreaterThan(sectors.get('family')!.span);
  });

  it('never squeezes a small group out of sight', () => {
    const sectors = sectorsOf(new Map([['family', 1], ['friend', 200]]));
    expect(sectors.get('family')!.span).toBeGreaterThanOrEqual(MIN_SECTOR);
  });

  it('gives the whole turn to a map with one group on it', () => {
    expect(sectorsOf(new Map([['friend', 5]])).get('friend')).toEqual({ from: 0, span: 1 });
    expect(sectorsOf(new Map())).toEqual(new Map());
  });

  it('draws a boundary round each group, with everyone inside it', () => {
    const l = layoutRelation([...many(6, 'family'), ...many(9, 'work')]);
    expect(l.bounds.map((b) => b.group)).toEqual(['family', 'work']);
    for (const b of l.bounds) {
      for (const n of l.nodes.filter((x) => x.person.group === b.group)) {
        expect(n.d - n.r).toBeGreaterThanOrEqual(b.inner);
        expect(n.d + n.r).toBeLessThanOrEqual(b.outer);
        expect(n.a).toBeGreaterThanOrEqual(b.from);
        expect(n.a).toBeLessThanOrEqual(b.from + b.span);
      }
    }
  });

  it('keeps one group\'s boundary clear of the next', () => {
    const l = layoutRelation([...many(6, 'family'), ...many(9, 'work'), ...many(4, 'other')]);
    const sorted = [...l.bounds].sort((a, b) => a.from - b.from);
    for (let i = 0; i + 1 < sorted.length; i++) {
      expect(sorted[i].from + sorted[i].span).toBeLessThan(sorted[i + 1].from);
    }
  });

  it('holds everyone apart inside a band as well as round a ring', () => {
    const l = layoutRelation([...many(30, 'family'), ...many(30, 'friend')]);
    for (const group of ['family', 'friend'] as const) {
      expect(tightest(l.nodes.filter((n) => n.person.group === group))).toBeGreaterThan(0);
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

  it('pull the closest people a little way inward', () => {
    const l = layoutRelation([p('near', 'family', 3), p('far', 'family', 1)]);
    const near = l.nodes.find((n) => n.person.id === 'near')!;
    const far = l.nodes.find((n) => n.person.id === 'far')!;
    expect(near.d).toBeLessThan(far.d);
  });

  it('give every circle room for at least what closeness asks', () => {
    // Closeness is the floor; a long name raises it, because the name is
    // written inside the circle and has to fit there.
    const l = layoutRelation([p('near', 'family', 3), p('far', 'family', 1)]);
    for (const n of l.nodes) expect(n.r).toBeGreaterThanOrEqual(NODE_R[n.person.closeness]);
  });

  it('makes the circle big enough to hold the name it will be given', () => {
    const l = layoutRelation([
      { id: 'a', name: '나', group: 'friend', closeness: 2, createdAt: '' },
      { id: 'b', name: '알렉산드라 콘스탄티노바', group: 'friend', closeness: 2, createdAt: '' },
    ]);
    const short = l.nodes.find((n) => n.person.id === 'a')!;
    const long = l.nodes.find((n) => n.person.id === 'b')!;
    expect(long.r).toBeGreaterThan(short.r);
    expect(long.lines.length).toBeGreaterThan(1);
    expect(short.lines).toEqual(['나']);
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
