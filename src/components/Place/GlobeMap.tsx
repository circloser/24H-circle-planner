import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pointInRing, type CityVisit, type CountryShape, type CountryVisit } from '@/lib/place';
import {
  CITY_DOT_ZOOM, CITY_NAME_ZOOM, GLOBE_MAX_ZOOM, GLOBE_MIN_ZOOM, anyFacing, facing, graticule,
  project, screenOf, turn, unproject, visibleRuns, type Camera,
} from '@/lib/place-globe';
import { capture, listOf, moveBetween, type Pointer } from '@/lib/gesture';

export interface GlobeMapProps {
  shapes: readonly CountryShape[];
  countries: readonly CountryVisit[];
  cities: readonly CityVisit[];
  homeCityId?: string;
  visited: string;
  selected: string | null;
  camera: Camera;
  onCamera: (camera: Camera) => void;
  onSelect: (code: string | null) => void;
  nameOf: (code: string, fallback: string) => string;
}

/** The ink and paper of the page, as plain colours a canvas can use. */
function inks(el: HTMLElement) {
  const style = getComputedStyle(el);
  return {
    ink: style.getPropertyValue('--place-ink').trim() || style.color,
    paper: style.getPropertyValue('--place-paper').trim() || style.backgroundColor || '#ffffff',
  };
}

/**
 * The scratch map, as a globe.
 *
 * Turned with a finger, zoomed with a wheel or two fingers, and coloured in
 * by tapping a country. What it shows changes with how close it is: far out,
 * countries and nothing else; closer, the cities appear; closer still, their
 * names. There is nothing to load — the shapes ship with the app — so it
 * turns in aeroplane mode exactly as it does anywhere else.
 */
export function GlobeMap({
  shapes, countries, cities, homeCityId, visited, selected, camera, onCamera, onSelect, nameOf,
}: GlobeMapProps) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const been = useMemo(() => new Map(countries.map((c) => [c.code, c])), [countries]);
  const lines = useMemo(() => graticule(), []);

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

  const screen = useMemo(() => screenOf(size.w, size.h, camera.zoom), [size, camera.zoom]);

  const paint = useCallback(() => {
    const el = canvas.current;
    const host = box.current;
    if (!el || !host || !size.w || !size.h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (el.width !== Math.round(size.w * dpr) || el.height !== Math.round(size.h * dpr)) {
      el.width = Math.round(size.w * dpr);
      el.height = Math.round(size.h * dpr);
    }
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const { ink, paper } = inks(host);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // The ball itself: the sea, and a rim so it reads as a sphere.
    ctx.beginPath();
    ctx.arc(screen.cx, screen.cy, screen.r, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.045;
    ctx.fill();
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink;
    ctx.stroke();

    // Meridians and parallels, as faint as they can be and still be there.
    ctx.globalAlpha = 0.05;
    ctx.lineWidth = 1;
    for (const line of lines) {
      for (const run of visibleRuns(line, camera, screen)) {
        ctx.beginPath();
        ctx.moveTo(run[0][0], run[0][1]);
        for (let i = 1; i < run.length; i++) ctx.lineTo(run[i][0], run[i][1]);
        ctx.stroke();
      }
    }

    // The countries. Only the half facing us is drawn at all.
    const near = camera.zoom >= CITY_DOT_ZOOM;
    for (const shape of shapes) {
      if (!anyFacing(shape, camera)) continue;
      const visit = been.get(shape.code);
      const lit = hover === shape.code || selected === shape.code;
      const runs = shape.rings.flatMap((ring) => visibleRuns(ring, camera, screen));
      if (!runs.length) continue;
      ctx.beginPath();
      for (const run of runs) {
        ctx.moveTo(run[0][0], run[0][1]);
        for (let i = 1; i < run.length; i++) ctx.lineTo(run[i][0], run[i][1]);
        ctx.closePath();
      }
      ctx.fillStyle = visit ? visited : ink;
      ctx.globalAlpha = visit ? (visit.lived ? 0.72 : 0.46) + (lit ? 0.1 : 0) : 0.07 + (lit ? 0.07 : 0);
      ctx.fill();
      ctx.strokeStyle = visit ? visited : ink;
      ctx.globalAlpha = visit ? 0.95 : 0.22;
      // Zoomed in, a border is worth a little more ink.
      ctx.lineWidth = (visit ? 0.9 : 0.6) * (near ? 1.6 : 1);
      ctx.stroke();
    }

    // Cities, once there is room for them.
    if (near) {
      const named = camera.zoom >= CITY_NAME_ZOOM;
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      for (const city of cities) {
        if (!facing(city.lng, city.lat, camera)) continue;
        const p = project(city.lng, city.lat, camera, screen);
        const home = city.id === homeCityId;
        ctx.beginPath();
        ctx.arc(p.x, p.y, home ? 4 : 3, 0, Math.PI * 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = home ? visited : paper;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = home ? visited : ink;
        ctx.globalAlpha = home ? 1 : 0.75;
        ctx.stroke();
        if (named) {
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = ink;
          ctx.fillText(city.name, p.x, p.y - 6);
        }
      }
    }
    ctx.globalAlpha = 1;
  }, [size, screen, camera, shapes, been, cities, homeCityId, visited, selected, hover, lines]);

  useEffect(() => {
    const frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [paint]);

  // ── turning, zooming, and colouring in ───────────────────────────────────
  const down = useRef(new Map<number, Pointer>());
  const moved = useRef(false);

  const at = (e: React.PointerEvent): Pointer => {
    const r = box.current!.getBoundingClientRect();
    return { id: e.pointerId, x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent) => {
    capture(e.currentTarget as Element, e.pointerId);
    down.current.set(e.pointerId, at(e));
    if (down.current.size === 1) moved.current = false;
  };

  const onMove = (e: React.PointerEvent) => {
    const before = listOf(down.current);
    if (!down.current.has(e.pointerId)) {
      // Not a drag: just the pointer passing over a country.
      const p = at(e);
      const where = unproject(p.x, p.y, camera, screen);
      setHover(where ? countryUnder(shapes, where.lng, where.lat) : null);
      return;
    }
    down.current.set(e.pointerId, at(e));
    const move = moveBetween(before, listOf(down.current));
    if (Math.hypot(move.dx, move.dy) > 2 || move.scale !== 1) moved.current = true;
    let next = turn(camera, move.dx, move.dy, screen);
    if (move.scale !== 1) {
      next = { ...next, zoom: Math.max(GLOBE_MIN_ZOOM, Math.min(GLOBE_MAX_ZOOM, camera.zoom * move.scale)) };
    }
    onCamera(next);
  };

  const onUp = (e: React.PointerEvent) => {
    const had = down.current.delete(e.pointerId);
    if (!had || down.current.size > 0 || moved.current) return;
    const p = at(e);
    const where = unproject(p.x, p.y, camera, screen);
    onSelect(where ? countryUnder(shapes, where.lng, where.lat) : null);
  };

  const wheel = (e: React.WheelEvent) => {
    e.preventDefault();
    onCamera({
      ...camera,
      zoom: Math.max(GLOBE_MIN_ZOOM, Math.min(GLOBE_MAX_ZOOM, camera.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))),
    });
  };

  return (
    /* The zoom is published on the element so a test can see what a pinch
       did; nothing in the app reads it. */
    <div ref={box} data-place-globe data-place-zoom={camera.zoom.toFixed(2)}
      className="absolute inset-0 touch-none select-none text-foreground">
      <canvas
        ref={canvas}
        data-place-world
        className="absolute inset-0"
        style={{ width: size.w, height: size.h }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => setHover(null)}
        onWheel={wheel}
        onDoubleClick={() => onCamera({ ...camera, zoom: 1 })}
      />
      {/* The globe cannot be tabbed into, so every country on earth is also a
          button here — hidden from sight, and the only way to colour one in
          with a keyboard alone. */}
      <ul className="sr-only" data-place-countries>
        {shapes.map((s) => (
          <li key={s.code}>
            <button type="button" data-place-country={s.code}
              data-place-visited={been.get(s.code) ? (been.get(s.code)!.lived ? 'lived' : 'yes') : undefined}
              onClick={() => onSelect(s.code)}>
              {nameOf(s.code, s.name)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The country a place falls in, by the same rule the rest of the app uses. */
function countryUnder(shapes: readonly CountryShape[], lng: number, lat: number): string | null {
  for (const s of shapes) {
    for (const ring of s.rings) {
      if (pointInRing(lng, lat, ring)) return s.code;
    }
  }
  return null;
}
