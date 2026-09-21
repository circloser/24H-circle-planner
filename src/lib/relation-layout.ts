/**
 * Where everyone stands on the map.
 *
 * The PRD asked for a force simulation that settles and then stops entirely.
 * This settles it in closed form instead, which is the same picture without
 * the machinery: no library, no frames spent converging, nothing left drifting,
 * and a layout that can be tested as a plain function.
 *
 * Two rules give it the calm the page needs:
 *
 *  · Each person's angle comes from their own id, so it never changes. Adding
 *    someone new does not rearrange the people already there — the map a person
 *    learned last week is the map they open today.
 *  · Each group sits on a ring, family nearest. Closeness pulls a little way
 *    inward inside the ring and makes the circle a little bigger.
 *  · Each group also keeps to its own quarter of the turn, so a group is a
 *    place on the map and not a scattering: everyone in it stands inside one
 *    boundary, which the canvas draws behind them.
 *
 * Only crowding moves anyone: nodes too close together on a ring are pushed
 * apart along it, and a ring that cannot hold its people grows until it can.
 */
import { RELATION_GROUPS, type Closeness, type Person, type RelationGroup } from './relation';
import { nameBox } from './relation-name';

/** Node radius by closeness (§3.2), over the five rungs. */
export const NODE_R: Record<Closeness, number> = { 1: 5, 2: 7, 3: 9, 4: 11, 5: 13 };
/** The middle node — me. */
export const ME_R = 20;
/** How far the innermost ring sits from me. Wide enough that a name written
 *  under a family node never lands on top of the middle. */
export const RING_MIN = 150;
/** Distance between one ring and the next. */
export const RING_GAP = 100;
/** How far each rung of closeness pulls someone in from their ring. Five
 *  rungs at this step stay well inside RING_GAP, so no ring reaches the one
 *  inside it however close everyone is. */
export const CLOSE_STEP = 9;
/** Clear space kept between two nodes on the same ring. */
export const NODE_PAD = 16;
/** How much a ring grows when it cannot hold everyone. */
const GROW = 26;
/** The least of the turn a group is given, however few people are in it. */
export const MIN_SECTOR = 0.16;
/** Clear turn left between one group's boundary and the next. */
export const SECTOR_GAP = 0.03;
/** Clear space between a boundary and the circles it holds. */
export const BOUND_PAD = 10;
/** How full a ring is allowed to get before it grows. The slack is what the
 *  spacing below has to give away. */
const RING_FULL = 0.92;

/** How far in and out the map may be zoomed (§3.2). */
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;
/** Above this every name is written; below it, only family and the pinned. */
export const LABEL_ZOOM = 1.4;

const TAU = Math.PI * 2;

/**
 * Up to two letters for a face without a picture. Korean and Chinese names
 * read better as the last characters — the given name — while a Latin name
 * reads as its initials.
 */
export function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  if (/^[ㄱ-힝一-鿿]/.test(trimmed)) return trimmed.slice(-2);
  return trimmed.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

/** The ring a group sits on, before anyone crowds it. */
export const ringBase = (group: RelationGroup): number =>
  RING_MIN + RING_GAP * RELATION_GROUPS.indexOf(group);

/**
 * A stable angle for an id, in turns: the same person is always in the same
 * direction from the middle.
 *
 * FNV-1a over the characters, then a final avalanche. The avalanche is not
 * decoration — without it, short ids like "p1" and "p2" come out pointing the
 * same way and everyone ends up in one quarter of the map.
 */
export function angleOf(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 0x100000000;
}

export interface Placed {
  person: Person;
  /** Turns around the middle, 0–1. */
  a: number;
  /** Distance from the middle, in layout units. */
  d: number;
  /** Node radius, in layout units — big enough to hold the name. */
  r: number;
  /** The name, broken into the lines it is drawn on. */
  lines: string[];
  /** Put here by hand rather than by the ring. */
  fixed: boolean;
}

/** The patch of map one group keeps to: a band of the turn, at one distance. */
export interface Bound {
  group: RelationGroup;
  /** Where the band starts, in turns. */
  from: number;
  /** How much of the turn it takes. 1 means the whole way round. */
  span: number;
  /** The near and far edges, in layout units. */
  inner: number;
  outer: number;
}

export interface Layout {
  nodes: Placed[];
  /** The faint guide circles: one per group that has anybody on it. */
  rings: Array<{ group: RelationGroup; d: number }>;
  /** One boundary per group that has anybody standing in it. */
  bounds: Bound[];
  /** How far the furthest edge reaches from the middle. */
  extent: number;
}

/** Cartesian position of a placed node, with the middle at (0, 0). */
export const xyOf = (p: { a: number; d: number }): { x: number; y: number } => ({
  // Start at the top and go clockwise, the way a clock face reads.
  x: Math.sin(p.a * TAU) * p.d,
  y: -Math.cos(p.a * TAU) * p.d,
});

/** The turn and distance a point corresponds to — the inverse of xyOf. */
export function polarOf(x: number, y: number): { a: number; d: number } {
  const a = Math.atan2(x, -y) / TAU;
  return { a: (a % 1 + 1) % 1, d: Math.hypot(x, y) };
}

/** The turn two neighbours need between them so their circles do not touch. */
const needed = (a: Placed, b: Placed, d: number): number => (a.r + b.r + NODE_PAD) / (TAU * d);

/**
 * Give everyone on a ring the room they need, in one pass and in the order
 * their ids put them.
 *
 * Every neighbouring pair is given at least the gap their two circles need.
 * Whatever is left of the turn is then shared out in proportion to how far
 * apart the pair already were, so two people who were nowhere near each other
 * keep the distance their ids chose. When nobody is crowded that share works
 * out to exactly where they already stood, and the ring does not move at all —
 * which is the ordinary case, and why the map looks the same every morning.
 */
function spread(band: Placed[], d: number): void {
  const n = band.length;
  if (n < 2) return;
  band.sort((p, q) => p.a - q.a);
  // gap[i] is what the pair (i, i+1) needs; natural[i] is what they have.
  const gap: number[] = [];
  const natural: number[] = [];
  for (let i = 0; i < n; i++) {
    const next = i + 1 === n ? band[0].a + 1 : band[i + 1].a;
    gap.push(needed(band[i], band[(i + 1) % n], d));
    natural.push(next - band[i].a);
  }
  if (natural.every((have, i) => have >= gap[i])) return; // nobody is crowded
  const spare = natural.map((have, i) => Math.max(0, have - gap[i]));
  const spareTotal = spare.reduce((s, v) => s + v, 0);
  // fits() has already grown the ring until this is positive.
  const surplus = Math.max(0, 1 - gap.reduce((s, v) => s + v, 0));
  let at = band[0].a;
  for (let i = 0; i < n; i++) {
    band[i].a = ((at % 1) + 1) % 1;
    at += gap[i] + (spareTotal > 0 ? (surplus * spare[i]) / spareTotal : surplus / n);
  }
}

/** Half of the turn a circle takes up at this distance. */
const halfTurn = (n: Placed, d: number): number => n.r / (TAU * d);

/**
 * The share of the turn each group gets.
 *
 * In proportion to how many people are in it, but never less than MIN_SECTOR:
 * a family of two beside forty colleagues still reads as a group rather than
 * as a dot. One group on its own gets the whole turn, which is the old
 * behaviour exactly — so a map that has only ever had friends on it does not
 * move the day this arrives.
 */
export function sectorsOf(counts: ReadonlyMap<RelationGroup, number>): Map<RelationGroup, { from: number; span: number }> {
  const present = RELATION_GROUPS.filter((g) => (counts.get(g) ?? 0) > 0);
  const out = new Map<RelationGroup, { from: number; span: number }>();
  if (present.length === 0) return out;
  if (present.length === 1) {
    out.set(present[0], { from: 0, span: 1 });
    return out;
  }
  // Groups that would come out under the floor are set to it and taken out of
  // the sum; what is left is shared among the rest. Done as a loop rather than
  // one pass, so a group given the floor keeps the floor — scaling everything
  // afterwards is what quietly took it back.
  const span = new Map<RelationGroup, number>();
  const floorFits = MIN_SECTOR * present.length <= 1;
  for (let pass = 0; pass <= present.length; pass++) {
    const rest = present.filter((g) => !span.has(g));
    const left = 1 - [...span.values()].reduce((s, v) => s + v, 0);
    const heads = rest.reduce((s, g) => s + (counts.get(g) ?? 0), 0) || 1;
    const short = floorFits
      ? rest.filter((g) => (left * (counts.get(g) ?? 0)) / heads < MIN_SECTOR)
      : [];
    if (!short.length) {
      for (const g of rest) span.set(g, (left * (counts.get(g) ?? 0)) / heads);
      break;
    }
    for (const g of short) span.set(g, MIN_SECTOR);
  }
  let at = 0;
  for (const g of present) {
    const width = span.get(g) ?? 1 / present.length;
    out.set(g, { from: at, span: width });
    at += width;
  }
  return out;
}

/**
 * Give everyone room inside one group's band — the same idea as spread(), but
 * along an arc that does not come back round to itself, so nobody is pushed
 * out of their own group's boundary.
 */
function spreadArc(band: Placed[], d: number, from: number, span: number): void {
  const n = band.length;
  if (n < 1) return;
  band.sort((p, q) => p.a - q.a);
  const lo = from + halfTurn(band[0], d);
  const hi = from + span - halfTurn(band[n - 1], d);
  if (n === 1) {
    band[0].a = Math.min(hi, Math.max(lo, band[0].a));
    return;
  }
  const gap: number[] = [];
  for (let i = 0; i + 1 < n; i++) gap.push(needed(band[i], band[i + 1], d));
  const crowded = band[0].a < lo || band[n - 1].a > hi
    || gap.some((need, i) => band[i + 1].a - band[i].a < need);
  if (!crowded) return; // nobody is short of room: leave the map alone
  const spare = gap.map((need, i) => Math.max(0, band[i + 1].a - band[i].a - need));
  const spareTotal = spare.reduce((s, v) => s + v, 0);
  // fits() has already grown the ring until this is not negative.
  const surplus = Math.max(0, (hi - lo) - gap.reduce((s, v) => s + v, 0));
  let at = lo;
  for (let i = 0; i < n; i++) {
    if (i > 0) at += gap[i - 1] + (spareTotal > 0 ? (surplus * spare[i - 1]) / spareTotal : surplus / (n - 1));
    band[i].a = at;
  }
}

/** Does one group's band have room for everyone in it? */
function fitsArc(band: readonly Placed[], d: number, span: number): boolean {
  if (band.length < 2) return true;
  let need = halfTurn(band[0], d) + halfTurn(band[band.length - 1], d);
  for (let i = 0; i + 1 < band.length; i++) need += needed(band[i], band[i + 1], d);
  return need <= span * RING_FULL;
}

/** Does this ring have room for everyone on it at all? */
function fits(band: readonly Placed[], d: number): boolean {
  if (band.length < 2) return true;
  let need = 0;
  for (let i = 0; i < band.length; i++) need += needed(band[i], band[(i + 1) % band.length], d);
  return need <= RING_FULL;
}

/**
 * Lay the whole map out. The result is the same every time for the same
 * people, whatever order they arrive in.
 */
export function layoutRelation(people: readonly Person[]): Layout {
  const nodes: Placed[] = [];
  const rings: Array<{ group: RelationGroup; d: number }> = [];
  const bounds: Bound[] = [];
  // The outermost ring so far, so a hand-placed node has something to measure
  // its distance against.
  const outermost = ringBase(RELATION_GROUPS[RELATION_GROUPS.length - 1]);
  // Somebody put down by hand is wherever they were put; only the people still
  // on their ring are given a share of the turn.
  const counts = new Map<RelationGroup, number>();
  for (const p of people) {
    if (!p.at) counts.set(p.group, (counts.get(p.group) ?? 0) + 1);
  }
  const sectors = sectorsOf(counts);

  for (const group of RELATION_GROUPS) {
    const mine = people.filter((p) => p.group === group);
    if (!mine.length) continue;
    const sector = sectors.get(group);
    // The whole turn is the one case that wraps; anything less is an arc with
    // two ends, and the people in it are kept between them.
    const whole = !sector || sector.span >= 1;
    const from = whole ? 0 : sector.from;
    const span = whole ? 1 : Math.max(0.02, sector.span - SECTOR_GAP);
    const band: Placed[] = [];
    for (const person of mine) {
      // Closeness still says how big a circle someone gets; their name says
      // how big it has to be. The bigger of the two wins, so a name is never
      // written outside the circle it belongs to.
      const { lines, radius } = nameBox(person.name, NODE_R[person.closeness]);
      const r = radius;
      if (person.at) {
        nodes.push({ person, a: person.at.a, d: person.at.r * outermost, r, lines, fixed: true });
      } else {
        band.push({ person, a: from + span * angleOf(person.id), d: 0, r, lines, fixed: false });
      }
    }
    if (!band.length) {
      rings.push({ group, d: ringBase(group) });
      continue;
    }
    let d = ringBase(group);
    // A ring holds only so many; grow it rather than overlap anyone.
    if (whole) {
      for (let guard = 0; guard < 200 && !fits(band, d); guard++) d += GROW;
      spread(band, d);
    } else {
      for (let guard = 0; guard < 400 && !fitsArc(band, d, span); guard++) d += GROW;
      spreadArc(band, d, from, span);
    }
    let inner = Infinity;
    let outer = 0;
    for (const node of band) {
      node.d = d - (node.person.closeness - 1) * CLOSE_STEP;
      inner = Math.min(inner, node.d - node.r);
      outer = Math.max(outer, node.d + node.r);
      nodes.push(node);
    }
    rings.push({ group, d });
    bounds.push({
      group,
      from,
      span: whole ? 1 : span,
      inner: Math.max(0, inner - BOUND_PAD),
      outer: outer + BOUND_PAD,
    });
  }

  // Far enough out to hold every node, every boundary, and me.
  const extent = nodes.reduce(
    (max, n) => Math.max(max, n.d + n.r),
    Math.max(ME_R, ...rings.map((r) => r.d), ...bounds.map((b) => b.outer)),
  );
  return { nodes, rings, bounds, extent };
}

/** The node under a point, if any — the nearest whose circle contains it.
 *  `hit` widens every node so a fingertip does not have to be exact. */
export function nodeAt(layout: Layout, x: number, y: number, hit = 6): Placed | null {
  let best: Placed | null = null;
  let bestGap = Infinity;
  for (const n of layout.nodes) {
    const p = xyOf(n);
    const gap = Math.hypot(p.x - x, p.y - y) - n.r;
    if (gap <= hit && gap < bestGap) {
      best = n;
      bestGap = gap;
    }
  }
  return best;
}
