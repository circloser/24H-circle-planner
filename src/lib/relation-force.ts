/**
 * The map, as something with weight.
 *
 * The map used to be worked out in closed form: an angle from each person's
 * id, a ring for their group, and one pass to stop anybody overlapping. It
 * never moved, which made it calm and made it dead — and it could not answer
 * the thing a relation map is for, which is "who is bound to whom". Two people
 * tied together sat wherever their ids put them.
 *
 * So this is a small force simulation, of the same family as d3-force and
 * written here because a graph library is a large thing to carry for one page:
 *
 *  · everybody pushes everybody else away, a little, falling off with distance;
 *  · a tie between two people pulls them together, like a spring;
 *  · closeness pulls toward a ring — near me for the near, further for the far —
 *    so the old meaning of distance survives the physics;
 *  · nobody may sit on top of anybody else, or on me;
 *  · and it all cools down, so the map settles and then stays settled.
 *
 * It is deterministic: the same people, seeded the same way, settle into the
 * same map every time. Nothing random, nothing stored, no library. Positions
 * are not saved anywhere — the map is rebuilt from the record each time, and
 * the record is a list of people, not a diagram.
 */

export interface Body {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** How big the circle is, so nothing overlaps. */
  r: number;
  /** Where the ring wants this body: distance from the middle. */
  want: number;
  /** Put here by hand (or held by a finger): forces do not move it. */
  pinned?: boolean;
}

export interface Tie {
  a: string;
  b: string;
  /** How far apart the two of them would rather be. */
  rest: number;
  /** How hard it pulls them there, as a share of the usual. */
  grip?: number;
}

/** How hard everybody pushes everybody else away. */
export const CHARGE = 2600;
/** How hard a tie pulls, as a share of the error each step. */
export const TIE = 0.06;
/** How hard the ring pulls somebody to their own distance from the middle. */
export const RING_PULL = 0.035;
/** What is left of a body's speed after a step. */
export const DRAG = 0.86;
/** Clear space kept between two circles. */
export const PAD = 12;
/** The middle is me, and nobody stands on me. */
export const ME_ROOM = 34;
/** How much of the heat is lost each step, and the point at which the map is
 *  called settled. */
export const COOLING = 0.035;
export const COLD = 0.02;
/** No body may move further than this in one step, whatever the arithmetic
 *  says: a crowd that starts on top of itself would otherwise explode. */
const MOST = 24;

/**
 * How far apart two bodies would rather be, given their sizes and how close
 * the two of them are to each other.
 *
 * Five rungs, and the middle one is the plain distance: an inseparable pair
 * end up shoulder to shoulder, and two people who merely know each other sit
 * within sight but no nearer.
 */
export const restFor = (a: Body, b: Body, closeness = 3): number =>
  (a.r + b.r + PAD * 3) * (1.9 - 0.3 * Math.max(1, Math.min(5, closeness)));

/** And how hard the tie pulls: the closer they are, the less give it has. */
export const gripFor = (closeness = 3): number =>
  0.6 + 0.2 * Math.max(1, Math.min(5, closeness));

/**
 * One step of the world, in place. `alpha` is how hot it still is (1 at the
 * start, 0 when settled); every force is scaled by it, so the map moves
 * decisively at first and barely at the end.
 */
export function stepWorld(bodies: Body[], ties: readonly Tie[], alpha: number): void {
  const at = new Map(bodies.map((b) => [b.id, b]));

  // Everybody pushes everybody else away. This is the n² part, and the reason
  // there is a limit on how many people a map may hold.
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let far = Math.hypot(dx, dy);
      if (far < 0.01) {
        // Exactly on top of each other: push along a line of their own, so
        // the pair still separates rather than sitting there for ever.
        dx = ((i % 7) - 3) || 1;
        dy = ((j % 5) - 2) || 1;
        far = Math.hypot(dx, dy);
      }
      const push = (CHARGE * alpha) / (far * far);
      const ux = dx / far;
      const uy = dy / far;
      a.vx -= ux * push;
      a.vy -= uy * push;
      b.vx += ux * push;
      b.vy += uy * push;
    }
  }

  // A tie pulls, the way a spring does.
  for (const tie of ties) {
    const a = at.get(tie.a);
    const b = at.get(tie.b);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const far = Math.hypot(dx, dy) || 0.01;
    const pull = ((far - tie.rest) / far) * TIE * (tie.grip ?? 1) * alpha;
    a.vx += dx * pull;
    a.vy += dy * pull;
    b.vx -= dx * pull;
    b.vy -= dy * pull;
  }

  // The ring: closeness is a distance from the middle, and it still is.
  for (const body of bodies) {
    const far = Math.hypot(body.x, body.y) || 0.01;
    const pull = (body.want - far) * RING_PULL * alpha;
    body.vx += (body.x / far) * pull;
    body.vy += (body.y / far) * pull;
  }

  // Move, with what is left of the speed.
  for (const body of bodies) {
    if (body.pinned) {
      body.vx = 0;
      body.vy = 0;
      continue;
    }
    body.vx *= DRAG;
    body.vy *= DRAG;
    const speed = Math.hypot(body.vx, body.vy);
    if (speed > MOST) {
      body.vx = (body.vx / speed) * MOST;
      body.vy = (body.vy / speed) * MOST;
    }
    body.x += body.vx;
    body.y += body.vy;
  }

  // And then nobody overlaps anybody: said last, as a place rather than a
  // force, because "not on top of each other" is not a preference.
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const far = Math.hypot(dx, dy) || 0.01;
      const room = a.r + b.r + PAD;
      if (far >= room) continue;
      const push = (room - far) / 2;
      const ux = dx / far;
      const uy = dy / far;
      if (!a.pinned) { a.x -= ux * push; a.y -= uy * push; }
      if (!b.pinned) { b.x += ux * push; b.y += uy * push; }
    }
  }
  for (const body of bodies) {
    const far = Math.hypot(body.x, body.y);
    const room = ME_ROOM + body.r;
    if (far >= room || body.pinned) continue;
    const ux = (body.x || 1) / (far || 1);
    const uy = (body.y || 0) / (far || 1);
    body.x = ux * room;
    body.y = uy * room;
  }
}

/** The heat after one step. */
export const cool = (alpha: number): number => Math.max(0, alpha - alpha * COOLING);

/** How hard a subgroup holds its people together, as a share of a tie's pull:
 *  enough to keep them in one patch of their group, too little to squash it. */
export const KIN_GRIP = 0.35;

/**
 * Everything that pulls on anything: the ties that were drawn, and the looser
 * hold of a subgroup on its own people.
 *
 * A subgroup is held as a chain through its members in id order — one spring
 * each, not one for every pair, so a subgroup of forty is forty springs and
 * not seven hundred and eighty — and it is the same chain every time, so the
 * map still settles into the same shape for the same record.
 */
export function tiesOf(
  links: readonly { source: string; target: string; closeness?: number }[],
  people: readonly { id: string; group: string; sub?: string }[],
  world: ReadonlyMap<string, Body>,
): Tie[] {
  const out: Tie[] = [];
  for (const link of links) {
    const a = world.get(link.source);
    const b = world.get(link.target);
    if (!a || !b) continue;
    const close = link.closeness ?? 3;
    out.push({ a: link.source, b: link.target, rest: restFor(a, b, close), grip: gripFor(close) });
  }
  const kin = new Map<string, string[]>();
  for (const p of people) {
    if (!p.sub || !world.has(p.id)) continue;
    const key = `${p.group}|${p.sub}`;
    kin.set(key, [...(kin.get(key) ?? []), p.id]);
  }
  for (const ids of kin.values()) {
    ids.sort();
    for (let i = 1; i < ids.length; i++) {
      const a = world.get(ids[i - 1])!;
      const b = world.get(ids[i])!;
      out.push({ a: a.id, b: b.id, rest: restFor(a, b, 2), grip: KIN_GRIP });
    }
  }
  return out;
}

/** Run it to a stop, for a picture that has no frames to run in. */
export function settle(bodies: Body[], ties: readonly Tie[], steps = 260): Body[] {
  let alpha = 1;
  for (let i = 0; i < steps && alpha > COLD; i++) {
    stepWorld(bodies, ties, alpha);
    alpha = cool(alpha);
  }
  return bodies;
}
