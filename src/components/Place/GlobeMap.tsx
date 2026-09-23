import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isWished, pointInRing, type CityVisit, type CountryShape, type CountryVisit, type Pin, type PinCategory,
} from '@/lib/place';
import {
  CITY_DOT_ZOOM, CITY_NAME_ZOOM, GLOBE_MIN_ZOOM, anyFacing, cityNamedAt, cityRankAt,
  densifyShape, facing, graticule, project, ringFill, screenOf, tileZoomOfGlobe, turn, unproject,
  visibleRuns, type Camera,
} from '@/lib/place-globe';
import type { CityRow } from '@/lib/place-world';
import { capture, listOf, moveBetween, type Pointer } from '@/lib/gesture';
import { hexAlpha } from './palette';

export interface GlobeMapProps {
  shapes: readonly CountryShape[];
  countries: readonly CountryVisit[];
  cities: readonly CityVisit[];
  /** Every city there is, for the dots that appear as the globe is zoomed in.
   *  Ranked, so the capitals arrive first and the villages last. */
  places: readonly CityRow[];
  /** The particular spots, so the globe shows them too. */
  pins: readonly Pin[];
  homeCityId?: string;
  visited: string;
  wished: string;
  selected: string | null;
  selectedPin: string | null;
  /** Show where the pins are gathered rather than which countries are
   *  coloured in: the same record read as warmth instead of as borders. */
  heat: boolean;
  /** As close as the globe goes before the tile map is the better picture.
   *  A finger may ask for one step past it — that step is the handover. */
  maxZoom: number;
  /** One colour a kind of pin (lib/place-colors). */
  pinColors: Record<PinCategory, string>;
  /** Where the person is right now, if they have asked to be found. */
  here?: { lng: number; lat: number } | null;
  /** The camera is being moved from outside: do not turn on our own. */
  still?: boolean;
  /** Whether the globe turns by itself at all — the reader's own choice,
   *  from the button in the corner. On unless it has been switched off. */
  spinning?: boolean;
  camera: Camera;
  onCamera: (camera: Camera) => void;
  onSelect: (code: string | null) => void;
  onSelectPin: (id: string | null) => void;
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

/** How near a finger has to land for a pin to have been the thing meant. */
const PIN_HIT = 14;
/** How far above its place a pin's head sits, in pixels. */
const PIN_RISE = 9;
/** How long the globe waits, untouched, before it starts to turn. */
const IDLE_MS = 3000;
/** Degrees of longitude a second, once it does. A globe on a desk, given a
 *  push, turns about this fast — fast enough to see, slow enough to read. */
const SPIN_DEG = 3.5;
/** The least time between two steps of it: thirty frames a second is plenty
 *  for something nobody is touching. */
const SPIN_MS = 33;

/**
 * The scratch map, as a globe.
 *
 * Turned with a finger, zoomed with a wheel or two fingers, and coloured in by
 * tapping a country — one colour for having been, another for wanting to go.
 * What it shows changes with how close it is: far out, countries and nothing
 * else; closer, the cities and the pins appear; closer still, their names.
 * There is nothing to load — the shapes ship with the app — so it turns in
 * aeroplane mode exactly as it does anywhere else.
 */
export function GlobeMap({
  shapes, countries, cities, places, pins, homeCityId, visited, wished, selected, selectedPin,
  heat, maxZoom, pinColors, here, still, spinning = true, camera, onCamera, onSelect, onSelectPin, nameOf,
}: GlobeMapProps) {
  /** One step past the stop, which the view above reads as "now the tiles". */
  const reach = maxZoom * 1.4;
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<string | null>(null);
  /** Where the pointer is, for the name that follows it. A ref: it changes
   *  with every mouse move, and a render each time would be a render too many
   *  — the drawing is asked for directly instead. */
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const been = useMemo(() => new Map(countries.map((c) => [c.code, c])), [countries]);
  const lines = useMemo(() => graticule(), []);
  // The long steps of a coastline are filled in once, not on every frame —
  // without this a border is drawn as a chord straight through the globe.
  const drawn = useMemo(() => shapes.map(densifyShape), [shapes]);
  // Sorted by how major a place is, so a frame can stop at the first city
  // past the cut rather than walk all seven thousand of them.
  const ranked = useMemo(() => [...places].sort((a, b) => a.rank - b.rank), [places]);
  // How much ground a pixel covers, said as the tile zoom that covers the
  // same: that, not the globe's own number, is what decides which cities are
  // worth a dot.
  const cut = size.w ? cityRankAt(tileZoomOfGlobe(camera.zoom, size.w, size.h)) : -1;
  /** Cities of one's own are drawn by the loop below; these are not drawn twice. */
  const mine = useMemo(() => new Set(cities.map((c) => c.id)), [cities]);

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

    // The countries. Only the half facing us is drawn at all, and nothing is
    // allowed outside the ball however a shape closes itself.
    const near = camera.zoom >= CITY_DOT_ZOOM;
    ctx.save();
    ctx.beginPath();
    ctx.arc(screen.cx, screen.cy, screen.r, 0, Math.PI * 2);
    ctx.clip();
    for (const shape of drawn) {
      if (!anyFacing(shape, camera)) continue;
      // With the heat showing, every country is drawn the same faint way:
      // two readings of the same record would only fight each other.
      const visit = heat ? undefined : been.get(shape.code);
      const want = isWished(visit);
      const lit = hover === shape.code || selected === shape.code;
      const colour = visit ? (want ? wished : visited) : ink;

      // Filled whole, with whatever is round the back lying along the rim.
      let any = false;
      ctx.beginPath();
      for (const ring of shape.rings) {
        const pts = ringFill(ring, camera, screen);
        if (!pts) continue;
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        any = true;
      }
      if (!any) continue;
      ctx.fillStyle = colour;
      ctx.globalAlpha = visit
        ? (want ? 0.4 : visit.lived ? 0.72 : 0.46) + (lit ? 0.1 : 0)
        : 0.07 + (lit ? 0.07 : 0);
      ctx.fill();

      // Outlined along the coast alone — the rim is the globe's line, not the
      // country's, and drawing it as a border is what looked like a crack.
      ctx.beginPath();
      for (const ring of shape.rings) {
        for (const run of visibleRuns(ring, camera, screen)) {
          ctx.moveTo(run[0][0], run[0][1]);
          for (let i = 1; i < run.length; i++) ctx.lineTo(run[i][0], run[i][1]);
        }
      }
      ctx.strokeStyle = colour;
      ctx.globalAlpha = visit ? 0.95 : 0.22;
      // Zoomed in, a border is worth a little more ink.
      ctx.lineWidth = (visit ? 0.9 : 0.6) * (near ? 1.6 : 1);
      ctx.stroke();
    }
    ctx.restore();

    /*
     * The heat: one soft blob a place, added together.
     *
     * A place is a pin, and it is also a city one has been to — most of a
     * life is lived in cities that were never given a pin, and a heat map of
     * pins alone showed a traveller's world as a few dots. A city lived in
     * weighs more than one passed through.
     *
     * Where places stand on their own the blob is faint; where several are
     * close their blobs add up, and the colour runs from a wash to something
     * that reads as "here, often". Drawn with 'lighter' so the adding is the
     * picture rather than something computed into a grid, and clipped to the
     * ball so nothing spills off the edge of the world.
     */
    const warm = heat
      ? [
        ...pins.map((p) => ({ lng: p.lng, lat: p.lat, weight: 1 })),
        ...cities.map((c) => ({ lng: c.lng, lat: c.lat, weight: c.lived ? 1.6 : 1 })),
      ]
      : [];
    if (warm.length) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(screen.cx, screen.cy, screen.r, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      // Wide enough to blend at a distance, tight enough to mean a place
      // when the globe is brought close.
      const spread = Math.max(16, Math.min(90, screen.r * 0.07));
      for (const spot of warm) {
        if (!facing(spot.lng, spot.lat, camera)) continue;
        const p = project(spot.lng, spot.lat, camera, screen);
        const reach = spread * Math.sqrt(spot.weight);
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, reach);
        glow.addColorStop(0, hexAlpha(visited, Math.min(0.8, 0.5 * spot.weight)));
        glow.addColorStop(0.5, hexAlpha(visited, 0.16 * spot.weight));
        glow.addColorStop(1, hexAlpha(visited, 0));
        ctx.fillStyle = glow;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, reach, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // The world's own cities, once the globe is close enough to hold them.
    // Ranked, so what appears first is the capitals and what appears last is
    // everywhere else.
    if (cut >= 0) {
      ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      for (const city of ranked) {
        if (city.rank > cut) break; // sorted: nothing further can pass either
        if (mine.has(city.id)) continue;
        if (!facing(city.lng, city.lat, camera)) continue;
        const p = project(city.lng, city.lat, camera, screen);
        const big = city.rank === 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, big ? 2.4 : 1.6, 0, Math.PI * 2);
        ctx.fillStyle = ink;
        ctx.globalAlpha = big ? 0.75 : 0.5;
        ctx.fill();
        if (cityNamedAt(city.rank, cut)) {
          ctx.globalAlpha = big ? 0.7 : 0.5;
          ctx.fillText(city.name, p.x, p.y - 4);
        }
      }
    }

    // Cities and pins, once there is room for them.
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
      // A pin stands up off the ball on a little stem, so it is never read as
      // one more city dot.
      for (const pin of pins) {
        if (!facing(pin.lng, pin.lat, camera)) continue;
        const p = project(pin.lng, pin.lat, camera, screen);
        const on = selectedPin === pin.id;
        const ink2 = pinColors[pin.category] ?? visited;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y - PIN_RISE);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = ink2;
        ctx.stroke();
        // Filled with its own colour, ringed in paper so it stands off the
        // ball whatever colour the country under it is.
        ctx.beginPath();
        ctx.arc(p.x, p.y - PIN_RISE, on ? 5.5 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = ink2;
        ctx.fill();
        ctx.lineWidth = on ? 2 : 1.5;
        ctx.strokeStyle = on ? ink : paper;
        ctx.stroke();
        if (named) {
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = ink;
          ctx.fillText(pin.name, p.x, p.y - PIN_RISE - 7);
        }
      }
    }
    // The name of whatever the pointer is over, beside the pointer. Countries
    // have no labels on this globe — there is no room at this size — so this
    // is the only way to be sure which one is about to be coloured in.
    const over = hover ? shapes.find((s) => s.code === hover) : null;
    if (over && pointer.current) {
      const name = nameOf(over.code, over.name);
      ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
      const wide = ctx.measureText(name).width;
      const pad = 6;
      const x = Math.min(size.w - wide - pad * 2 - 4, pointer.current.x + 14);
      const y = Math.max(4, pointer.current.y - 28);
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = paper;
      ctx.beginPath();
      ctx.roundRect(x, y, wide + pad * 2, 22, 11);
      ctx.fill();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = ink;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, x + pad, y + 11);
    }

    // Where the person is, when they have asked to be found.
    if (here && facing(here.lng, here.lat, camera)) {
      const p = project(here.lng, here.lat, camera, screen);
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = visited;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = visited;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = paper;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, [size, screen, camera, drawn, been, cities, ranked, cut, mine, pins, homeCityId, visited, wished,
    heat, here, pinColors, selected, selectedPin, hover, lines, shapes, nameOf]);

  useEffect(() => {
    const frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [paint]);

  // ── turning, zooming, and colouring in ───────────────────────────────────
  const down = useRef(new Map<number, Pointer>());
  const moved = useRef(false);
  /** When the globe was last interfered with, for the idle turn below. */
  const touched = useRef(0);
  const mark = useCallback(() => { touched.current = performance.now(); }, []);
  // A globe that has just arrived — from the tile map, or with the page —
  // waits its three seconds like any other, rather than starting mid-pinch.
  useEffect(() => { mark(); }, [mark]);

  /**
   * Left alone, the globe turns on its own axis.
   *
   * Three seconds after the last touch, and only while nothing is open on top
   * of it — a country's card, a pin's — it turns west to east, the way the
   * earth does. Anything at all stops it, and three seconds later it starts
   * again. `prefers-reduced-motion` turns it off entirely, and a tab in the
   * background is served no frames, so it never spins where nobody is looking.
   */
  const latest = useRef({ camera, onCamera });
  useEffect(() => { latest.current = { camera, onCamera }; });
  const held = selected !== null || selectedPin !== null || !!still || !spinning;
  // Switched back on by hand: that press is the reason to turn, so it turns
  // now rather than waiting out three seconds of the press itself.
  useEffect(() => { if (spinning) touched.current = 0; }, [spinning]);
  useEffect(() => {
    if (held) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    let frame = 0;
    let prev = 0;
    const run = (now: number) => {
      frame = requestAnimationFrame(run);
      if (now - touched.current < IDLE_MS) { prev = now; return; }
      // Half the frames, twice the step: a globe turning by itself is the
      // background of the page, not worth a redraw sixty times a second.
      if (prev && now - prev < SPIN_MS) return;
      const dt = prev ? Math.min(0.2, (now - prev) / 1000) : 0;
      prev = now;
      const { camera: cam, onCamera: move } = latest.current;
      const lng = ((cam.lng + SPIN_DEG * dt + 180) % 360 + 360) % 360 - 180;
      move({ ...cam, lng });
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [held]);

  const at = (e: React.PointerEvent): Pointer => {
    const r = box.current!.getBoundingClientRect();
    return { id: e.pointerId, x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /** The pin a tap meant, when one was near enough to have been meant. */
  const pinAt = (x: number, y: number): Pin | null => {
    if (camera.zoom < CITY_DOT_ZOOM) return null;
    let best: Pin | null = null;
    let near = PIN_HIT;
    for (const pin of pins) {
      if (!facing(pin.lng, pin.lat, camera)) continue;
      const p = project(pin.lng, pin.lat, camera, screen);
      const gap = Math.hypot(p.x - x, p.y - PIN_RISE - y);
      if (gap < near) {
        near = gap;
        best = pin;
      }
    }
    return best;
  };

  const onDown = (e: React.PointerEvent) => {
    mark();
    capture(e.currentTarget as Element, e.pointerId);
    down.current.set(e.pointerId, at(e));
    if (down.current.size === 1) moved.current = false;
  };

  const onMove = (e: React.PointerEvent) => {
    const before = listOf(down.current);
    if (down.current.size) mark();
    if (!down.current.has(e.pointerId)) {
      // Not a drag: just the pointer passing over a country.
      const p = at(e);
      pointer.current = p;
      const where = unproject(p.x, p.y, camera, screen);
      const code = where ? countryUnder(shapes, where.lng, where.lat) : null;
      if (code === hover) paint(); // the name follows the pointer
      else setHover(code);
      return;
    }
    down.current.set(e.pointerId, at(e));
    const move = moveBetween(before, listOf(down.current));
    if (Math.hypot(move.dx, move.dy) > 2 || move.scale !== 1) moved.current = true;
    let next = turn(camera, move.dx, move.dy, screen);
    if (move.scale !== 1) {
      next = { ...next, zoom: Math.max(GLOBE_MIN_ZOOM, Math.min(reach, camera.zoom * move.scale)) };
    }
    onCamera(next);
  };

  const onUp = (e: React.PointerEvent) => {
    mark();
    const had = down.current.delete(e.pointerId);
    if (!had || down.current.size > 0 || moved.current) return;
    const p = at(e);
    // A pin is the smaller target, so it is asked about first.
    const pin = pinAt(p.x, p.y);
    if (pin) {
      onSelectPin(selectedPin === pin.id ? null : pin.id);
      return;
    }
    const where = unproject(p.x, p.y, camera, screen);
    onSelect(where ? countryUnder(shapes, where.lng, where.lat) : null);
  };

  const wheel = (e: React.WheelEvent) => {
    e.preventDefault();
    mark();
    onCamera({
      ...camera,
      zoom: Math.max(GLOBE_MIN_ZOOM, Math.min(reach, camera.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))),
    });
  };

  return (
    /* The zoom is published on the element so a test can see what a pinch
       did; nothing in the app reads it. */
    /* data-place-cities is how many of the world's cities this zoom is
       willing to show; a test reads it, nothing in the app does. */
    <div ref={box} data-place-globe data-place-zoom={camera.zoom.toFixed(2)}
      data-place-lng={camera.lng.toFixed(2)}
      data-place-cities={cut < 0 ? 0 : ranked.filter((c) => c.rank <= cut).length}
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
        onPointerLeave={() => { pointer.current = null; setHover(null); }}
        onWheel={wheel}
        onDoubleClick={() => onCamera({ ...camera, zoom: 1 })}
      />
      {/* The globe cannot be tabbed into, so every country on earth is also a
          button here — hidden from sight, and the only way to colour one in
          with a keyboard alone. The pins follow, for the same reason. */}
      <ul className="sr-only" data-place-countries>
        {shapes.map((s) => {
          const visit = been.get(s.code);
          return (
            <li key={s.code}>
              <button type="button" data-place-country={s.code}
                data-place-visited={visit ? (isWished(visit) ? 'wish' : visit.lived ? 'lived' : 'yes') : undefined}
                onClick={() => onSelect(s.code)}>
                {nameOf(s.code, s.name)}
              </button>
            </li>
          );
        })}
      </ul>
      <ul className="sr-only" data-place-globe-pins>
        {pins.map((pin) => (
          <li key={pin.id}>
            <button type="button" data-place-globe-pin={pin.id}
              onClick={() => onSelectPin(selectedPin === pin.id ? null : pin.id)}>
              {pin.name}
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
