import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { loadPhoto } from '@/lib/calendar-photos';
import { capture } from '@/lib/gesture';
import {
  contactFade, hasBirthdaySoon, type Person, type RelationData, type RelationGroup,
} from '@/lib/relation';
import {
  MAX_ZOOM, ME_R, MIN_ZOOM, angleOf, layoutRelation, polarOf, xyOf, type Placed,
} from '@/lib/relation-layout';
import { driftAt } from '@/lib/relation-drift';
import { COLD, cool, stepWorld, tiesOf, type Body } from '@/lib/relation-force';
import { boundaryOf, drawBoundary } from '@/lib/relation-hull';
import { atRest, springAt, stepSpring, type Spring } from '@/lib/relation-spring';
import { NAME_SIZE, nameBox } from '@/lib/relation-name';

const TAU = Math.PI * 2;

/** How much of the way to where it belongs a group's name moves each frame. */
const LABEL_EASE = 0.12;

/** A press this long puts someone down where they are, or picks them up again. */
const HOLD_MS = 550;
/** How much of the map's own drag the far edge lags behind by. The middle is
 *  under the finger exactly; everything else is on the end of something. */
const TRAIL = 0.85;
/** The line is drawn, then the circle appears. */
const DRAW_MS = 300;
const FADE_MS = 200;
/** How hot the map gets again when somebody is picked up or put down. */
const REHEAT = 0.55;

export interface RelationCanvasProps {
  data: RelationData;
  colors: Record<RelationGroup, string>;
  today: string;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** Someone was put down somewhere; `at` undefined gives them back to the map. */
  onPlace: (id: string, at: Person['at']) => void;
  /** A double tap on empty space: somewhere to put a new person. */
  onAddAt?: (at: { a: number; r: number }) => void;
  /** The circle in the middle is me; pressing it is how I am edited. */
  onOpenMe?: () => void;
  /** Ids drawn as arriving, oldest first; empty once they have all appeared. */
  appearing?: readonly string[];
  /** Waiting to be linked to whoever is tapped next. */
  linking?: string | null;
  meLabel: string;
  /** What each group is called, written once on its own boundary. */
  groupLabel: Record<RelationGroup, string>;
  /** The words on the two buttons that take the map in and out. */
  zoomLabels: { in: string; out: string };
  /** Whatever the page wants in the bottom-right corner, above the zoom. */
  corner?: ReactNode;
}

interface View { scale: number; tx: number; ty: number }

/** The ink the page is drawn in, read once from the stylesheet. */
function inkOf(el: HTMLElement): string {
  const c = getComputedStyle(el).getPropertyValue('--relation-ink').trim();
  return c || getComputedStyle(el).color;
}

/**
 * The paper a circle is filled with, so no line shows through a face.
 *
 * The box itself usually has no background of its own — it inherits one — and
 * a canvas asked for that gets "rgba(0, 0, 0, 0)", which fills with nothing
 * at all. So the page is walked upward until something opaque is found, and
 * white (or the stated paper) is the last resort.
 */
function paperOf(el: HTMLElement): string {
  const stated = getComputedStyle(el).getPropertyValue('--relation-paper').trim();
  if (stated) return stated;
  let at: HTMLElement | null = el;
  while (at) {
    const c = getComputedStyle(at).backgroundColor;
    if (c && !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(c)) return c;
    at = at.parentElement;
  }
  return '#ffffff';
}

/**
 * The map itself.
 *
 * Everything is drawn by hand on a canvas — hollow circles, one-pixel lines —
 * over a small force simulation (lib/relation-force): everybody pushes
 * everybody else away, a tie between two people pulls them together, and
 * closeness still pulls toward a ring, so the map arranges itself around who
 * is actually bound to whom rather than around what their ids happened to
 * hash to. It cools to a stop and then stays where it is, with only the float
 * (lib/relation-drift) left moving.
 *
 * The starting positions are the old closed-form layout, so the same people
 * always settle into the same map: nothing random, and no positions stored
 * anywhere — the record is a list of people, not a diagram.
 */
export function RelationCanvas({
  data, colors, today, selected, onSelect, onPlace, onAddAt, onOpenMe, appearing = [], linking, meLabel,
  groupLabel, zoomLabels, corner,
}: RelationCanvasProps) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  /** Who is under the finger. State, so the lift is drawn; a ref as well, so
   *  the frame loop can read it without waiting for a render. */
  const [drag, setDrag] = useState<string | null>(null);
  const dragging = useRef<string | null>(null);
  /**
   * The wake behind a drag of the map itself: the middle is me, so I go where
   * the finger goes and everyone else is towed along on a spring.
   */
  const wake = useRef<Spring | null>(null);
  const panned = useRef<View>({ scale: 1, tx: 0, ty: 0 });
  useEffect(() => { panned.current = view; }, [view]);
  const lastFrame = useRef(0);
  /** Where the middle was last drawn, so a tap on it can be recognised. */
  const meAt = useRef<{ x: number; y: number; r: number } | null>(null);
  const [photos, setPhotos] = useState<ReadonlyMap<string, HTMLImageElement>>(() => new Map());
  const asked = useRef(new Set<string>());
  // When the current arrival began. Refs, not state: the clock is read while
  // drawing, and starting it must not cost a render of its own.
  const born = useRef(0);
  const arriving = useRef<readonly string[] | null>(null);

  /** Where everyone would stand with no forces at all: the seed, and where
   *  each circle's size and the name written in it come from. */
  const seed = useMemo(() => layoutRelation(data.people), [data.people]);

  // ── the world, and its heat ──────────────────────────────────────────────
  const world = useRef(new Map<string, Body>());
  const alpha = useRef(1);
  /** Bumped whenever the world is rebuilt, so the frames pick it up. */
  const [settling, setSettling] = useState(0);
  useEffect(() => {
    const kept = world.current;
    const next = new Map<string, Body>();
    for (const node of seed.nodes) {
      const was = kept.get(node.person.id);
      const home = xyOf(node);
      next.set(node.person.id, was && !node.fixed
        // Somebody already on the map stays where they are; only their size
        // and their ring are taken afresh, in case they were edited.
        ? { ...was, r: node.r, want: node.d, pinned: false }
        : { id: node.person.id, x: home.x, y: home.y, vx: 0, vy: 0, r: node.r, want: node.d, pinned: node.fixed });
    }
    world.current = next;
    // A map with somebody new on it has some settling to do.
    alpha.current = 1;
    // Rebuilding the world IS the change the frames have to hear about; there
    // is nothing else to hang it on.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettling((n) => n + 1);
  }, [seed]);

  /** Where a body is drawn: its own place, plus whatever float it is doing. */
  const spotOf = useCallback((id: string, clock: number, still: boolean) => {
    const body = world.current.get(id);
    if (!body) return { x: 0, y: 0 };
    if (still || dragging.current === id || body.pinned) return { x: body.x, y: body.y };
    const off = driftAt(angleOf(id), clock);
    return { x: body.x + off.dx, y: body.y + off.dy };
  }, []);

  // ── the box, and how much of the map fits in it ──────────────────────────
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  /**
   * How far the map reaches, and the scale that holds it.
   *
   * Both follow the simulation rather than jumping to it, so a map finding
   * its shape zooms gently instead of snapping about. Refs: they change every
   * frame, and a render each time would be a render too many.
   */
  const reach = useRef(seed.extent);
  /** Where each group's (and subgroup's) name was last written, so it can be
   *  eased to its next place rather than jump there. */
  const labels = useRef(new Map<string, { x: number; y: number }>());
  const fit = useRef(1);
  const fitNow = useCallback(() => {
    let far = ME_R;
    for (const body of world.current.values()) far = Math.max(far, Math.hypot(body.x, body.y) + body.r);
    reach.current += (far + 24 - reach.current) * 0.12;
    const room = Math.min(size.w, size.h) / 2 - 36;
    const want = size.w && size.h ? Math.min(1, room / Math.max(reach.current, 1)) : 1;
    fit.current += (want - fit.current) * 0.15;
    return fit.current;
  }, [size]);

  const toScreen = useCallback((x: number, y: number) => ({
    x: size.w / 2 + view.tx + x * fit.current * view.scale,
    y: size.h / 2 + view.ty + y * fit.current * view.scale,
  }), [size, view]);

  const toMap = useCallback((sx: number, sy: number) => ({
    x: (sx - size.w / 2 - view.tx) / (fit.current * view.scale),
    y: (sy - size.h / 2 - view.ty) / (fit.current * view.scale),
  }), [size, view]);

  /** The person under a point, in map units: the nearest whose circle holds it. */
  const nodeAt = useCallback((x: number, y: number, hit: number): Placed | null => {
    let best: Placed | null = null;
    let least = Infinity;
    for (const node of seed.nodes) {
      const body = world.current.get(node.person.id);
      if (!body) continue;
      const gap = Math.hypot(body.x - x, body.y - y) - node.r;
      if (gap <= hit && gap < least) {
        best = node;
        least = gap;
      }
    }
    return best;
  }, [seed]);

  // ── pictures, fetched once each and kept ─────────────────────────────────
  useEffect(() => {
    const wanted = [data.me.photo, ...data.people.map((p) => p.photo)].filter((x): x is string => !!x);
    let alive = true;
    for (const id of wanted) {
      if (asked.current.has(id)) continue;
      asked.current.add(id); // each picture is fetched once, whatever redraws
      void loadPhoto(id).then((url) => {
        if (!alive || !url) return;
        const img = new Image();
        img.onload = () => {
          if (alive) setPhotos((was) => new Map(was).set(id, img));
        };
        img.src = url;
      });
    }
    return () => { alive = false; };
  }, [data.me.photo, data.people]);

  // ── the drawing ──────────────────────────────────────────────────────────
  const paint = useCallback(() => {
    const el = canvas.current;
    const host = box.current;
    if (!el || !host || !size.w || !size.h) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    if (el.width !== Math.round(size.w * dpr) || el.height !== Math.round(size.h * dpr)) {
      el.width = Math.round(size.w * dpr);
      el.height = Math.round(size.h * dpr);
    }
    const ctx = el.getContext('2d');
    if (!ctx) return;
    // How hot the map still is, written on the element so a test can see it
    // settle and see a drag warm it up again. Set here rather than in a
    // render: it changes every frame, and nothing in the app reads it.
    el.dataset.relationAlpha = alpha.current.toFixed(3);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    const ink = inkOf(host);
    const paper = paperOf(host);
    const scale = fitNow();
    const zoom = scale * view.scale;
    // Positions shrink to fit the box; the circles themselves only shrink so
    // far, or a crowded map would be a spray of dots too small to aim at.
    const dots = Math.max(0.7, scale) * view.scale;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const clock = performance.now() / 1000;
    // A new set of arrivals starts its clock the first time it is drawn.
    if (arriving.current !== appearing) {
      arriving.current = appearing;
      born.current = appearing.length ? performance.now() : 0;
    }
    const since = born.current ? performance.now() - born.current : Infinity;

    /** 0 → 1 as an arriving node's line is drawn, then its circle fades in. */
    const arrival = (id: string) => {
      const i = appearing.indexOf(id);
      if (i < 0 || reduced) return { line: 1, node: 1 };
      const t = since - i * FADE_MS;
      return {
        line: Math.max(0, Math.min(1, t / DRAW_MS)),
        node: Math.max(0, Math.min(1, (t - DRAW_MS) / FADE_MS)),
      };
    };

    const fade = (p: Person) => contactFade(p, today);
    const dim = (id: string) => (selected && selected !== id ? 0.25 : 1);
    const middle = toScreen(0, 0);

    /** How far behind the map's own drag a point is: the middle not at all,
     *  the edge nearly all of it. */
    const trail = wake.current
      ? { x: wake.current.x - view.tx, y: wake.current.y - view.ty }
      : null;
    const follow = (p: { x: number; y: number }) => {
      const s = toScreen(p.x, p.y);
      if (!trail) return s;
      const share = TRAIL * Math.min(1, Math.hypot(p.x, p.y) / Math.max(1, reach.current));
      return { x: s.x + trail.x * share, y: s.y + trail.y * share };
    };

    const where = new Map<string, { x: number; y: number }>();
    for (const node of seed.nodes) where.set(node.person.id, spotOf(node.person.id, clock, reduced));

    const spotsOf = (members: readonly Person[]) => members.flatMap((p) => {
      const at = where.get(p.id);
      const body = world.current.get(p.id);
      return at && body ? [{ ...follow(at), r: body.r * dots + 4 }] : [];
    });
    /**
     * Where a shape's name is written: over the middle of its people, just
     * above the highest of them.
     *
     * It used to sit on the highest corner of the shape — and as the map
     * drifts, which corner is highest changes from one frame to the next, so
     * the name jumped from side to side and, when the shape went thin for a
     * moment, vanished and came back. Now it is placed from the people, not
     * the outline, and eased toward where it should be rather than sent there,
     * so a name moves as calmly as the people under it.
     */
    const nameAt = (key: string, spots: readonly { x: number; y: number; r: number }[], lift: number) => {
      const x = spots.reduce((s, p) => s + p.x, 0) / spots.length;
      const y = Math.min(...spots.map((p) => p.y - p.r)) - lift;
      const was = labels.current.get(key);
      const next = was && !reduced
        ? { x: was.x + (x - was.x) * LABEL_EASE, y: was.y + (y - was.y) * LABEL_EASE }
        : { x, y };
      labels.current.set(key, next);
      // Whole pixels: text drawn at a new fraction of a pixel every frame
      // shimmers even when it is not moving.
      return { x: Math.round(next.x), y: Math.round(next.y) };
    };

    /**
     * A group is a place on the map: the shape drawn round wherever its people
     * have ended up, rather than a band of the turn they were assigned. Drawn
     * behind everybody, and named once. A group inside it — the friends from
     * university, the old job — is a fainter shape inside that one, named in
     * smaller letters.
     */
    for (const group of new Set(data.people.map((p) => p.group))) {
      const members = data.people.filter((p) => p.group === group);
      const spots = spotsOf(members);
      if (!spots.length) continue;
      const shape = boundaryOf(spots, 14);
      if (shape.length >= 3) {
        drawBoundary(ctx, shape, 26);
        ctx.fillStyle = colors[group];
        ctx.globalAlpha = 0.06;
        ctx.fill();
        ctx.strokeStyle = colors[group];
        ctx.globalAlpha = 0.24;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (const sub of new Set(members.flatMap((p) => (p.sub ? [p.sub] : [])))) {
        const inner = spotsOf(members.filter((p) => p.sub === sub));
        if (inner.length < 2) continue;
        const ring = boundaryOf(inner, 7);
        if (ring.length < 3) continue;
        drawBoundary(ctx, ring, 16);
        ctx.fillStyle = colors[group];
        ctx.globalAlpha = 0.05;
        ctx.fill();
        ctx.strokeStyle = colors[group];
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([1.5, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        const at = nameAt(`${group}|${sub}`, inner, 10);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = colors[group];
        ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(sub, at.x, at.y);
      }

      const at = nameAt(group, spots, 20);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = colors[group];
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(groupLabel[group], at.x, at.y);
    }

    // Me to each person: the thread that says the middle is me.
    ctx.setLineDash([]);
    for (const node of seed.nodes) {
      const grow = arrival(node.person.id);
      if (grow.line <= 0) continue;
      const p = where.get(node.person.id)!;
      const end = follow({ x: p.x * grow.line, y: p.y * grow.line });
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.28 * fade(node.person) * (selected ? (selected === node.person.id ? 1 : 0.25) : 1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(middle.x, middle.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    // Person to person: the ties, each with whatever it was called.
    for (const link of data.links) {
      const a = where.get(link.source);
      const b = where.get(link.target);
      if (!a || !b) continue;
      const pa = follow(a);
      const pb = follow(b);
      const lit = !selected || selected === link.source || selected === link.target;
      // How close the two of them are is drawn as how heavy the line is: a
      // map of ties should show which ties are strong without being read.
      const close = link.closeness ?? 3;
      ctx.strokeStyle = ink;
      ctx.globalAlpha = (0.2 + 0.1 * close) * (lit ? 1 : 0.25);
      ctx.lineWidth = 0.75 + 0.45 * close;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      if (link.label && zoom > 0.3) {
        const mx = (pa.x + pb.x) / 2;
        const my = (pa.y + pb.y) / 2;
        ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
        const wide = ctx.measureText(link.label).width;
        ctx.globalAlpha = 0.92 * (lit ? 1 : 0.2);
        ctx.fillStyle = paper;
        ctx.beginPath();
        ctx.roundRect(mx - wide / 2 - 4, my - 8, wide + 8, 16, 8);
        ctx.fill();
        ctx.globalAlpha = 0.8 * (lit ? 1 : 0.2);
        ctx.fillStyle = ink;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(link.label, mx, my);
      }
    }

    /**
     * What is inside a circle: a photograph if there is one, and otherwise
     * the name itself, written across as many lines as it needs.
     */
    const face = (
      name: string, photo: string | undefined, cx: number, cy: number, r: number, a: number,
      /** The same circle in layout units, which is what the name was fitted to. */
      unit: number,
      lines?: readonly string[],
    ) => {
      const img = photo ? photos.get(photo) : undefined;
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r - 1, 0, TAU);
        ctx.clip();
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        ctx.globalAlpha = a;
        ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, cx - r, cy - r, r * 2, r * 2);
        ctx.restore();
        return;
      }
      const written = lines?.length ? { lines, radius: unit } : nameBox(name, unit);
      const rows = written.lines;
      if (!rows.length || unit <= 0) return;
      const letters = NAME_SIZE * (r / unit);
      if (letters < 6) return; // smaller than this is a smudge, not a name
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = ink;
      ctx.font = `${letters}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const step = letters * 1.15;
      const first = cy - ((rows.length - 1) * step) / 2;
      rows.forEach((row, i) => ctx.fillText(row, cx, first + i * step));
    };

    // Me, in the middle, always.
    ctx.beginPath();
    ctx.arc(middle.x, middle.y, ME_R * dots, 0, TAU);
    ctx.fillStyle = paper;
    ctx.globalAlpha = 1;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = ink;
    ctx.globalAlpha = selected ? 0.35 : 0.85;
    ctx.stroke();
    face(data.me.name || meLabel, data.me.photo, middle.x, middle.y, ME_R * dots, selected ? 0.35 : 1, ME_R);
    meAt.current = { x: middle.x, y: middle.y, r: ME_R * dots };

    // Everyone else, the distant ones first so the closest are drawn over
    // them rather than under.
    ctx.lineWidth = 1.5;
    const order = [...seed.nodes].sort((a, b) => a.person.closeness - b.person.closeness);
    for (const node of order) {
      const grow = arrival(node.person.id);
      if (grow.node <= 0) continue;
      const c = follow(where.get(node.person.id)!);
      // Picked up, someone is drawn a little larger, the way a card lifts off
      // a table.
      const lift = dragging.current === node.person.id ? 1.15 : 1;
      const r = Math.max(4, node.r * dots) * lift;
      const a = fade(node.person) * dim(node.person.id) * grow.node;
      // A birthday within the month gets a thin ring outside the circle.
      if (hasBirthdaySoon(node.person, today)) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, r + 3, 0, TAU);
        ctx.strokeStyle = getComputedStyle(host).getPropertyValue('--relation-accent').trim() || ink;
        ctx.lineWidth = 1;
        ctx.globalAlpha = a;
        ctx.stroke();
        ctx.lineWidth = 1.5;
      }
      // Filled solid, whatever the person's own fading: a line crossing a
      // face is what makes a crowded map unreadable.
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, TAU);
      ctx.fillStyle = paper;
      ctx.globalAlpha = 1;
      ctx.fill();
      ctx.strokeStyle = colors[node.person.group];
      // A close circle is drawn in a heavier line as well as a bigger one.
      ctx.lineWidth = selected === node.person.id || linking === node.person.id
        ? 3
        : 1 + node.person.closeness * 0.35;
      ctx.stroke();
      // Put down by hand: a second thin ring, so "held here" is visible.
      if (node.fixed) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, r + 2.5, 0, TAU);
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      face(node.person.name, node.person.photo, c.x, c.y, r, a, node.r, node.lines);
    }
    ctx.globalAlpha = 1;
  }, [size, view, seed, data, colors, groupLabel, today, selected, appearing, linking, meLabel,
    toScreen, photos, spotOf, fitNow]);

  /**
   * The frames.
   *
   * While the map is hot it is stepped and then drawn; once it is cold the
   * float keeps it alive, and `prefers-reduced-motion` stops even that. The
   * stepping happens here rather than in the pointer handler so that it runs
   * at the screen's own pace and carries on after the finger has gone.
   */
  useEffect(() => {
    let frame = 0;
    const list = [...world.current.values()];
    // What pulls on what, in the sizes they are now.
    const ties = tiesOf(data.links, data.people, world.current);
    const run = (now: number) => {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
      const dt = lastFrame.current ? (now - lastFrame.current) / 1000 : 0;
      lastFrame.current = now;

      if (alpha.current > COLD) {
        stepWorld(list, ties, alpha.current);
        alpha.current = cool(alpha.current);
      }

      // The map's own wake, when it is being dragged about.
      if (wake.current) {
        wake.current = reduced
          ? null
          : stepSpring(wake.current, panned.current.tx, panned.current.ty, dt);
        if (wake.current && atRest(wake.current, panned.current.tx, panned.current.ty)) wake.current = null;
      }

      paint();
      const arrivals = born.current > 0 && !reduced
        && performance.now() - born.current <= appearing.length * FADE_MS + DRAW_MS + FADE_MS;
      const moving = wake.current !== null || alpha.current > COLD;
      if ((appearing.length && arrivals) || moving || !reduced) frame = requestAnimationFrame(run);
      else lastFrame.current = 0;
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [paint, appearing, settling, data.links, data.people, drag]);

  // ── pointer ──────────────────────────────────────────────────────────────
  const gesture = useRef<{
    id: number; sx: number; sy: number; node: Placed | null; moved: boolean; hold: number; panned: View;
  } | null>(null);
  const lastTap = useRef(0);

  const pointOf = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return toMap(e.clientX - r.left, e.clientY - r.top);
  };

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const at = pointOf(e);
    const node = nodeAt(at.x, at.y, 8 / (fit.current * view.scale));
    capture(e.target as Element, e.pointerId);
    gesture.current = {
      id: e.pointerId, sx: e.clientX, sy: e.clientY, node, moved: false, panned: view,
      hold: node
        ? window.setTimeout(() => {
          // Held down: put them here for good, or give them back to the map.
          const g = gesture.current;
          if (!g || g.moved) return;
          const body = world.current.get(node.person.id);
          const polar = body ? polarOf(body.x, body.y) : { a: node.a, d: node.d };
          onPlace(node.person.id, node.fixed
            ? undefined
            : { a: polar.a, r: polar.d / Math.max(1, reach.current) });
          gesture.current = null;
        }, HOLD_MS)
        : 0,
    };
  };

  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const far = Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 4;
    if (far && !g.moved) {
      g.moved = true;
      window.clearTimeout(g.hold);
    }
    if (!g.moved) return;
    if (g.node) {
      // Somebody is being carried: they go exactly where the finger is, and
      // the map is warmed up so everyone else gets out of the way.
      const at = pointOf(e);
      const body = world.current.get(g.node.person.id);
      if (!body) return;
      if (dragging.current !== g.node.person.id) {
        dragging.current = g.node.person.id;
        setDrag(g.node.person.id);
      }
      body.pinned = true;
      body.x = at.x;
      body.y = at.y;
      body.vx = 0;
      body.vy = 0;
      alpha.current = Math.max(alpha.current, REHEAT);
    } else {
      // Dragging the map is dragging me: I go where the finger goes, and the
      // spring behind me is what everybody else is towed along on.
      wake.current ??= springAt(view.tx, view.ty);
      setView({ ...g.panned, tx: g.panned.tx + (e.clientX - g.sx), ty: g.panned.ty + (e.clientY - g.sy) });
    }
  };

  const up = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.id !== e.pointerId) return;
    window.clearTimeout(g.hold);
    if (g.moved && g.node) {
      const body = world.current.get(g.node.person.id);
      if (body) {
        if (g.node.fixed) {
          // Already put down by hand: they stay where the finger left them.
          const polar = polarOf(body.x, body.y);
          onPlace(g.node.person.id, { a: polar.a, r: polar.d / Math.max(1, reach.current) });
        } else {
          // Let go: the map takes them back, and moves to make room.
          body.pinned = false;
          alpha.current = Math.max(alpha.current, REHEAT);
        }
      }
      dragging.current = null;
      setDrag(null);
      return;
    }
    setDrag(null);
    if (g.moved) return;
    if (g.node) return onSelect(g.node.person.id);
    // The middle is me: pressing it opens my own card rather than clearing
    // the selection, which is what pressing anywhere else does.
    const me = meAt.current;
    if (me && onOpenMe) {
      const r = canvas.current!.getBoundingClientRect();
      if (Math.hypot(e.clientX - r.left - me.x, e.clientY - r.top - me.y) <= me.r) return onOpenMe();
    }
    // Empty space: a second tap in quick succession asks for someone new.
    const now = performance.now();
    if (onAddAt && now - lastTap.current < 400) {
      const at = pointOf(e);
      const polar = polarOf(at.x, at.y);
      lastTap.current = 0;
      onAddAt({ a: polar.a, r: Math.min(1.6, polar.d / Math.max(1, reach.current)) });
      return;
    }
    lastTap.current = now;
    onSelect(null);
  };

  /** In or out a step. A wheel does this too, and a phone has no wheel. */
  const zoomBy = (by: number) => setView((v) => (
    { ...v, scale: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.scale * (by > 0 ? 1.2 : 1 / 1.2))) }
  ));

  const wheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setView((v) => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      return { ...v, scale: next };
    });
  };

  /** Home again: the view put back, and the map given a shake. */
  const home = () => {
    setView({ scale: 1, tx: 0, ty: 0 });
    alpha.current = 1;
  };

  return (
    <div ref={box} data-relation-canvas className="relative w-full flex-1 touch-none select-none"
      style={{ minHeight: 'min(560px, 58dvh)' }}>
      {/* The canvas is laid over the box rather than sized by it, so its pixel
          buffer and its CSS box are always the same rectangle — a canvas that
          disagrees with itself draws everything off-centre. */}
      <canvas
        ref={canvas}
        data-relation-surface
        className="absolute inset-0"
        style={{ width: size.w, height: size.h }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={wheel}
        onDoubleClick={home}
      />
      {/* One corner for everything this page can do, which is the corner a
          thumb reaches. What the page puts here comes in above the zoom, so
          the buttons that move the map are always the nearest ones. */}
      <div data-relation-corner
        className="pointer-events-none absolute bottom-3 right-3 z-10 flex flex-col items-end gap-1.5">
        {corner}
        {/* Bigger and smaller, for a screen with no wheel — and for anybody
            who would rather press a button than learn a gesture. The names
            inside the circles grow with it, which is what it is mostly used
            for. */}
        <div data-relation-zoom={view.scale.toFixed(2)}
          className="pointer-events-auto flex flex-col overflow-hidden rounded-full border border-border bg-surface/90 shadow-sm backdrop-blur">
          <button type="button" data-relation-zoom-in aria-label={zoomLabels.in} title={zoomLabels.in}
            className="grid h-10 w-10 place-items-center text-muted-foreground hover:bg-accent/20"
            onClick={() => zoomBy(1)}>
            <Plus aria-hidden className="h-4 w-4" />
          </button>
          <button type="button" data-relation-zoom-out aria-label={zoomLabels.out} title={zoomLabels.out}
            className="grid h-10 w-10 place-items-center border-t border-border text-muted-foreground hover:bg-accent/20"
            onClick={() => zoomBy(-1)}>
            <Minus aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
