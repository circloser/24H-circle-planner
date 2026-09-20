import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadPhoto } from '@/lib/calendar-photos';
import { capture } from '@/lib/gesture';
import {
  contactFade, hasBirthdaySoon, type Person, type RelationData, type RelationGroup,
} from '@/lib/relation';
import {
  LABEL_ZOOM, MAX_ZOOM, ME_R, MIN_ZOOM, initialsOf, layoutRelation, nodeAt, polarOf, xyOf, type Placed,
} from '@/lib/relation-layout';

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
 * The map itself.
 *
 * Everything is drawn by hand on a canvas: hollow circles, one-pixel lines,
 * and nothing else. There is no continuous simulation — lib/relation-layout
 * works the positions out in one pass — so the only time a frame is drawn is
 * when something has actually changed.
 */
export function RelationCanvas({
  data, colors, today, selected, onSelect, onPlace, onAddAt, appearing = [], linking, meLabel,
}: RelationCanvasProps) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState<{ id: string; a: number; r: number } | null>(null);
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
    const live = (n: Placed) => (drag && drag.id === n.person.id ? { a: drag.a, d: drag.r } : n);

    // Me to each person.
    const middle = toScreen(0, 0);
    for (const n of layout.nodes) {
      const grow = arrival(n.person.id);
      if (grow.line <= 0) continue;
      const p = xyOf(live(n));
      const end = toScreen(p.x * grow.line, p.y * grow.line);
      ctx.beginPath();
      ctx.moveTo(middle.x, middle.y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.4 * alpha(n.person) * (selected ? (selected === n.person.id ? 1 : 0.25) : 1);
      ctx.setLineDash([]);
      ctx.stroke();
    }

    // Person to person, dashed.
    ctx.setLineDash([4, 4]);
    for (const link of data.links) {
      const a = at.get(link.source);
      const b = at.get(link.target);
      if (!a || !b) continue;
      const pa = toScreen(xyOf(live(a)).x, xyOf(live(a)).y);
      const pb = toScreen(xyOf(live(b)).x, xyOf(live(b)).y);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = ink;
      const lit = !selected || selected === link.source || selected === link.target;
      ctx.globalAlpha = 0.25 * (lit ? 1 : 0.25);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    /** A face: a photograph clipped to the circle, or initials. */
    const face = (name: string, photo: string | undefined, cx: number, cy: number, r: number, a: number) => {
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
      const letters = initialsOf(name);
      if (!letters || r < 12) return;
      ctx.globalAlpha = a * 0.75;
      ctx.fillStyle = ink;
      ctx.font = `${Math.round(r * 0.8)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letters, cx, cy + 1);
    };

    // Me, in the middle, always.
    ctx.beginPath();
    ctx.arc(middle.x, middle.y, ME_R * dots, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(host).backgroundColor || '#ffffff';
    ctx.globalAlpha = 1;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = ink;
    ctx.globalAlpha = selected ? 0.35 : 0.85;
    ctx.stroke();
    face(data.me.name || meLabel, data.me.photo, middle.x, middle.y, ME_R * dots, selected ? 0.35 : 1);

    // Everyone else.
    ctx.lineWidth = 1.5;
    for (const n of layout.nodes) {
      const grow = arrival(n.person.id);
      if (grow.node <= 0) continue;
      const p = xyOf(live(n));
      const c = toScreen(p.x, p.y);
      const r = Math.max(4, n.r * dots);
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
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fillStyle = getComputedStyle(host).backgroundColor || '#ffffff';
      ctx.globalAlpha = a;
      ctx.fill();
      ctx.strokeStyle = colors[n.person.group];
      ctx.lineWidth = selected === n.person.id || linking === n.person.id ? 2.5 : 1.5;
      ctx.stroke();
      if (r >= 14) face(n.person.name, n.person.photo, c.x, c.y, r, a);
      // The name: family and the pinned always, everyone once zoomed in.
      const named = n.person.group === 'family' || n.person.pinned || view.scale >= LABEL_ZOOM || selected === n.person.id;
      if (named) {
        ctx.globalAlpha = a * 0.7;
        ctx.fillStyle = ink;
        ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(n.person.name, c.x, c.y + r + 6);
      }
    }
    ctx.globalAlpha = 1;
  }, [size, view, fit, layout, data, colors, today, selected, drag, appearing, linking, meLabel, toScreen, photos]);

  // Draw when something changed, and keep drawing while people are arriving.
  useEffect(() => {
    let frame = 0;
    const run = () => {
      paint();
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
      const done = !appearing.length || reduced
        || (born.current > 0 && performance.now() - born.current > appearing.length * FADE_MS + DRAW_MS + FADE_MS);
      if (!done) frame = requestAnimationFrame(run);
    };
    run();
    return () => cancelAnimationFrame(frame);
  }, [paint, appearing]);

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
      const polar = polarOf(at.x, at.y);
      setDrag({ id: g.node.person.id, a: polar.a, r: Math.min(polar.d, layout.extent * 1.6) });
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
      // Let go: their ring has them back, unless they were already put down.
      if (g.node.fixed) onPlace(g.node.person.id, { a: drag.a, r: drag.r / Math.max(1, layout.extent) });
      setDrag(null);
      return;
    }
    setDrag(null);
    if (g.moved) return;
    if (g.node) return onSelect(g.node.person.id);
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
