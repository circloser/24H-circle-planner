import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadPhoto } from '@/lib/calendar-photos';
import { capture } from '@/lib/gesture';
import {
  contactFade, hasBirthdaySoon, type Person, type RelationData, type RelationGroup,
} from '@/lib/relation';
import {
  MAX_ZOOM, ME_R, MIN_ZOOM, layoutRelation, nodeAt, polarOf, xyOf, type Placed,
} from '@/lib/relation-layout';
import { atRest, bowOf, sagOf, springAt, stepSpring, type Spring } from '@/lib/relation-spring';
import { NAME_SIZE, nameBox } from '@/lib/relation-name';

/** A press this long puts someone down where they are, or picks them up again. */
const HOLD_MS = 550;
/** The line is drawn, then the circle appears. */
const DRAW_MS = 300;
const FADE_MS = 200;

export interface RelationCanvasProps {
  data: RelationData;
  colors: Record<RelationGroup, string>;
  today: string;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** Someone was put down somewhere; `at` undefined gives them back to the ring. */
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
 * Everything is drawn by hand on a canvas: hollow circles, one-pixel lines,
 * and nothing else. There is no continuous simulation — lib/relation-layout
 * works the positions out in one pass — so the only time a frame is drawn is
 * when something has actually changed.
 */
export function RelationCanvas({
  data, colors, today, selected, onSelect, onPlace, onAddAt, onOpenMe, appearing = [], linking, meLabel,
}: RelationCanvasProps) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Who is being dragged, and where the finger is. The position they are
  // actually drawn at lags behind it — see the spring below.
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  /** The lagging position, in layout units, and how fast it is going. */
  const held = useRef<Spring | null>(null);
  /** Who is in the air, and where they are heading. Refs, not state: they are
   *  read and written a frame at a time, and a render each way would be a
   *  render too many. */
  const dragging = useRef<string | null>(null);
  const target = useRef<{ x: number; y: number } | null>(null);
  /** Set while a let-go node is on its way back to its own place. */
  const homing = useRef(false);
  const lastFrame = useRef(0);
  /** Where the middle was last drawn, so a tap on it can be recognised. */
  const meAt = useRef<{ x: number; y: number; r: number } | null>(null);
  const [photos, setPhotos] = useState<ReadonlyMap<string, HTMLImageElement>>(() => new Map());
  const asked = useRef(new Set<string>());
  // When the current arrival began. Refs, not state: the clock is read while
  // drawing, and starting it must not cost a render of its own. Both are set
  // inside paint(), which runs from an effect.
  const born = useRef(0);
  const arriving = useRef<readonly string[] | null>(null);

  const layout = useMemo(() => layoutRelation(data.people), [data.people]);

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

  /** Layout units → screen pixels, before the person's own zoom. */
  const fit = useMemo(() => {
    if (!size.w || !size.h) return 1;
    const room = Math.min(size.w, size.h) / 2 - 36;
    return Math.min(1, room / Math.max(layout.extent, 1));
  }, [size, layout.extent]);

  const toScreen = useCallback((x: number, y: number) => ({
    x: size.w / 2 + view.tx + x * fit * view.scale,
    y: size.h / 2 + view.ty + y * fit * view.scale,
  }), [size, view, fit]);

  const toMap = useCallback((sx: number, sy: number) => ({
    x: (sx - size.w / 2 - view.tx) / (fit * view.scale),
    y: (sy - size.h / 2 - view.ty) / (fit * view.scale),
  }), [size, view, fit]);

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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    const ink = inkOf(host);
    const paper = paperOf(host);
    const zoom = fit * view.scale;
    // Positions shrink to fit the box; the circles themselves only shrink so
    // far, or a crowded map would be a spray of dots too small to aim at.
    const dots = Math.max(0.7, fit) * view.scale;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    // A new set of arrivals starts its clock the first time it is drawn.
    if (arriving.current !== appearing) {
      arriving.current = appearing;
      born.current = appearing.length ? performance.now() : 0;
    }
    const since = born.current ? performance.now() - born.current : Infinity;

    /** 0 → 1 as an arriving node's line is drawn, then its circle fades in. */
    const arrival = (id: string) => {
      const i = appearing.indexOf(id);
      if (i < 0) return { line: 1, node: 1 };
      if (reduced) return { line: 1, node: 1 };
      const t = since - i * FADE_MS;
      return {
        line: Math.max(0, Math.min(1, t / DRAW_MS)),
        node: Math.max(0, Math.min(1, (t - DRAW_MS) / FADE_MS)),
      };
    };

    const alpha = (p: Person) => contactFade(p, today);
    const dim = (id: string) => (selected && selected !== id ? 0.25 : 1);

    // Guide rings, faintest of all.
    ctx.lineWidth = 1;
    for (const ring of layout.rings) {
      const c = toScreen(0, 0);
      ctx.beginPath();
      ctx.arc(c.x, c.y, ring.d * zoom, 0, Math.PI * 2);
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.06;
      ctx.stroke();
    }

    const at = new Map(layout.nodes.map((n) => [n.person.id, n]));
    // Where a node is drawn: its own place, or the spring's, while it is in
    // the air or on its way back.
    const moving = held.current;
    const live = (n: Placed): { x: number; y: number } => (
      moving && dragging.current === n.person.id ? { x: moving.x, y: moving.y } : xyOf(n)
    );

    /**
     * A line between two places, bowed while it is being stretched. Its
     * resting length is how far apart the two of them sit when nobody is
     * pulling, so only the line to whoever is in the air ever bends.
     */
    const thread = (
      ax: number, ay: number, bx: number, by: number, rest: number,
    ) => {
      const a = toScreen(ax, ay);
      const b = toScreen(bx, by);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      const sag = sagOf(Math.hypot(bx - ax, by - ay), rest);
      if (sag === 0) {
        ctx.lineTo(b.x, b.y);
      } else {
        const c = bowOf(a.x, a.y, b.x, b.y, sag * zoom);
        ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
      }
      ctx.stroke();
    };

    // Me to each person.
    const middle = toScreen(0, 0);
    for (const n of layout.nodes) {
      const grow = arrival(n.person.id);
      if (grow.line <= 0) continue;
      const p = live(n);
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.4 * alpha(n.person) * (selected ? (selected === n.person.id ? 1 : 0.25) : 1);
      ctx.setLineDash([]);
      thread(0, 0, p.x * grow.line, p.y * grow.line, n.d);
    }

    // Person to person, dashed.
    ctx.setLineDash([4, 4]);
    for (const link of data.links) {
      const a = at.get(link.source);
      const b = at.get(link.target);
      if (!a || !b) continue;
      const pa = live(a);
      const pb = live(b);
      const home = xyOf(a);
      const away = xyOf(b);
      ctx.strokeStyle = ink;
      const lit = !selected || selected === link.source || selected === link.target;
      ctx.globalAlpha = 0.25 * (lit ? 1 : 0.25);
      thread(pa.x, pa.y, pb.x, pb.y, Math.hypot(away.x - home.x, away.y - home.y));
    }
    ctx.setLineDash([]);

    /**
     * What is inside a circle: a photograph if there is one, and otherwise
     * the name itself, written across as many lines as it needs.
     *
     * The name used to hang underneath, which reads as a caption on a dot;
     * inside, the circle IS the person. Where the name is longer than the
     * circle the layout has already made the circle bigger — see nameBox,
     * which both this and lib/relation-layout ask.
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
        ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
        ctx.clip();
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        ctx.globalAlpha = a;
        ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, cx - r, cy - r, r * 2, r * 2);
        ctx.restore();
        return;
      }
      // The layout worked the circle out in its own units and the screen is
      // those units scaled; the writing is scaled by exactly the same amount,
      // so a name that fitted in the layout fits on the screen.
      const box = lines?.length ? { lines, radius: unit } : nameBox(name, unit);
      const rows = box.lines;
      if (!rows.length || unit <= 0) return;
      const size = NAME_SIZE * (r / unit);
      if (size < 6) return; // smaller than this is a smudge, not a name
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = ink;
      ctx.font = `${size}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const step = size * 1.15;
      const top = cy - ((rows.length - 1) * step) / 2;
      rows.forEach((row, i) => ctx.fillText(row, cx, top + i * step));
    };

    // Me, in the middle, always.
    ctx.beginPath();
    ctx.arc(middle.x, middle.y, ME_R * dots, 0, Math.PI * 2);
    ctx.fillStyle = paper;
    ctx.globalAlpha = 1;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = ink;
    ctx.globalAlpha = selected ? 0.35 : 0.85;
    ctx.stroke();
    face(data.me.name || meLabel, data.me.photo, middle.x, middle.y, ME_R * dots, selected ? 0.35 : 1, ME_R);
    meAt.current = { x: middle.x, y: middle.y, r: ME_R * dots };

    // Everyone else.
    ctx.lineWidth = 1.5;
    for (const n of layout.nodes) {
      const grow = arrival(n.person.id);
      if (grow.node <= 0) continue;
      const p = live(n);
      const c = toScreen(p.x, p.y);
      // Picked up, someone is drawn a little larger, the way a card lifts off
      // a table.
      const lift = dragging.current === n.person.id ? 1.15 : 1;
      const r = Math.max(4, n.r * dots) * lift;
      const a = alpha(n.person) * dim(n.person.id) * grow.node;
      // A birthday within the month gets a thin ring outside the circle.
      if (hasBirthdaySoon(n.person, today)) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = getComputedStyle(host).getPropertyValue('--relation-accent').trim() || ink;
        ctx.lineWidth = 1;
        ctx.globalAlpha = a;
        ctx.stroke();
        ctx.lineWidth = 1.5;
      }
      // Filled solid, whatever the person's own fading: a line crossing a
      // face is what makes a crowded map unreadable.
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fillStyle = paper;
      ctx.globalAlpha = 1;
      ctx.fill();
      ctx.strokeStyle = colors[n.person.group];
      ctx.lineWidth = selected === n.person.id || linking === n.person.id ? 2.5 : 1.5;
      ctx.stroke();
      face(n.person.name, n.person.photo, c.x, c.y, r, a, n.r, n.lines);
    }
    ctx.globalAlpha = 1;
  }, [size, view, fit, layout, data, colors, today, selected, appearing, linking, meLabel, toScreen, photos]);

  /**
   * Draw when something changed, and keep drawing while anything is moving —
   * people arriving, or someone in the air on the end of a spring.
   *
   * The spring is stepped here rather than in the pointer handler, so it
   * settles at the screen's own pace and carries on after the finger has gone.
   */
  useEffect(() => {
    let frame = 0;
    const run = (now: number) => {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
      const dt = lastFrame.current ? (now - lastFrame.current) / 1000 : 0;
      lastFrame.current = now;

      const to = target.current;
      const spring = held.current;
      if (spring && to) {
        held.current = reduced ? { ...spring, x: to.x, y: to.y, vx: 0, vy: 0 } : stepSpring(spring, to.x, to.y, dt);
        // Home at last: the node goes back to being drawn where it belongs.
        if (homing.current && atRest(held.current, to.x, to.y)) {
          held.current = null;
          target.current = null;
          homing.current = false;
          dragging.current = null;
        }
      }

      paint();
      const arrivals = born.current > 0 && !reduced
        && performance.now() - born.current <= appearing.length * FADE_MS + DRAW_MS + FADE_MS;
      const moving = held.current !== null;
      if ((appearing.length && arrivals) || moving) frame = requestAnimationFrame(run);
      else lastFrame.current = 0;
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [paint, appearing, drag]);

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
    const node = nodeAt(layout, at.x, at.y, 8 / (fit * view.scale));
    capture(e.target as Element, e.pointerId);
    gesture.current = {
      id: e.pointerId, sx: e.clientX, sy: e.clientY, node, moved: false, panned: view,
      hold: node
        ? window.setTimeout(() => {
          // Held down: put them here for good, or give them back to the ring.
          const g = gesture.current;
          if (!g || g.moved) return;
          onPlace(node.person.id, node.fixed ? undefined : { a: node.a, r: node.d / Math.max(1, layout.extent) });
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
      const at = pointOf(e);
      // The finger may go anywhere; the person it is pulling stays within
      // reach of the map.
      const polar = polarOf(at.x, at.y);
      const reach = Math.min(polar.d, layout.extent * 1.6);
      const to = xyOf({ a: polar.a, d: reach });
      if (dragging.current !== g.node.person.id) {
        const from = xyOf(g.node);
        dragging.current = g.node.person.id;
        held.current = springAt(from.x, from.y);
      }
      homing.current = false;
      target.current = to;
      // One render to start the frames; the spring itself runs on refs.
      setDrag({ id: g.node.person.id, x: to.x, y: to.y });
    } else {
      setView({ ...g.panned, tx: g.panned.tx + (e.clientX - g.sx), ty: g.panned.ty + (e.clientY - g.sy) });
    }
  };

  const up = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.id !== e.pointerId) return;
    window.clearTimeout(g.hold);
    if (g.moved && g.node && drag) {
      const polar = polarOf(drag.x, drag.y);
      // Let go. Someone already put down by hand stays where the finger left
      // them; everyone else swings back to their own place on the ring, which
      // is what the spring is given as its new target.
      if (g.node.fixed) {
        onPlace(g.node.person.id, { a: polar.a, r: polar.d / Math.max(1, layout.extent) });
        held.current = null;
        target.current = null;
        dragging.current = null;
      } else {
        target.current = xyOf(g.node);
        homing.current = true;
      }
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
      onAddAt({ a: polar.a, r: Math.min(1.6, polar.d / Math.max(1, layout.extent)) });
      return;
    }
    lastTap.current = now;
    onSelect(null);
  };

  const wheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setView((v) => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      return { ...v, scale: next };
    });
  };

  const home = () => setView({ scale: 1, tx: 0, ty: 0 });

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
    </div>
  );
}
