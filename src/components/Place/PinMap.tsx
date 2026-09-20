import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/hooks/usePreferences';
import type { Pin } from '@/lib/place';
import { fromTile, toTile } from '@/lib/place-world';
import {
  PIN_MAX_ZOOM, PIN_MIN_ZOOM, TILE_SIZE, clusterPins, tileUrl, tileZoom, tilesFor, type Camera,
} from '@/lib/place-tiles';
import { capture, listOf, moveBetween, type Pointer } from '@/lib/gesture';
import { PIN_ICON } from './palette';

export interface PinMapProps {
  pins: readonly Pin[];
  camera: Camera;
  onCamera: (camera: Camera) => void;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** A tap on the map itself: a pin goes there. */
  onDropAt: (lng: number, lat: number) => void;
  /** Where the person is right now, if they have asked to be found. */
  here?: { lng: number; lat: number } | null;
}

/**
 * The pin map: real tiles, and the particular spots worth remembering.
 *
 * The tiles are painted on a canvas; the markers are ordinary elements laid
 * over it, so each one is a real button with a real icon that a keyboard can
 * reach. Offline the tiles simply do not arrive, a faint grid stands in for
 * them, and pins go on working.
 *
 * A tap on the map puts a pin there. Two fingers pinch; one finger drags.
 */
export function PinMap({ pins, camera, onCamera, selected, onSelect, onDropAt, here }: PinMapProps) {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [offline, setOffline] = useState(false);
  const images = useRef(new Map<string, HTMLImageElement>());
  const [painted, setPainted] = useState(0);

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

  /** A screen point for a longitude and latitude, at the current camera. */
  const place = useCallback((lng: number, lat: number) => {
    const z = tileZoom(camera.zoom);
    const centre = toTile(camera.lng, camera.lat, z);
    const p = toTile(lng, lat, z);
    return {
      x: size.w / 2 + (p.x - centre.x) * TILE_SIZE,
      y: size.h / 2 + (p.y - centre.y) * TILE_SIZE,
    };
  }, [camera, size]);

  const unplace = useCallback((x: number, y: number) => {
    const z = tileZoom(camera.zoom);
    const centre = toTile(camera.lng, camera.lat, z);
    return fromTile(centre.x + (x - size.w / 2) / TILE_SIZE, centre.y + (y - size.h / 2) / TILE_SIZE, z);
  }, [camera, size]);

  // ── the tiles ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = canvas.current;
    if (!el || !size.w || !size.h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = Math.round(size.w * dpr);
    el.height = Math.round(size.h * dpr);
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const { tiles } = tilesFor(camera, size.w, size.h);
    let missing = 0;
    for (const tile of tiles) {
      const key = `${tile.z}/${tile.x}/${tile.y}`;
      let img = images.current.get(key);
      if (!img) {
        img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => setPainted((n) => n + 1);
        img.onerror = () => setPainted((n) => n + 1);
        img.src = tileUrl(tile.z, tile.x, tile.y);
        images.current.set(key, img);
      }
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, tile.left, tile.top, TILE_SIZE, TILE_SIZE);
      } else {
        missing += 1;
        // A faint grid stands in until (or instead of) the tile.
        ctx.strokeStyle = 'currentColor';
        ctx.globalAlpha = 0.08;
        ctx.strokeRect(tile.left, tile.top, TILE_SIZE, TILE_SIZE);
        ctx.globalAlpha = 1;
      }
    }
    setOffline(missing === tiles.length && tiles.length > 0
      && [...images.current.values()].every((i) => !i.complete || i.naturalWidth === 0));
  }, [camera, size, painted]);

  const clusters = useMemo(() => {
    if (!size.w) return [];
    return clusterPins(pins.map((pin) => ({ pin, ...place(pin.lng, pin.lat) }))
      .filter((p) => p.x > -60 && p.y > -60 && p.x < size.w + 60 && p.y < size.h + 60));
  }, [pins, place, size]);

  // ── moving about ─────────────────────────────────────────────────────────
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
    if (!down.current.has(e.pointerId)) return;
    const before = listOf(down.current);
    down.current.set(e.pointerId, at(e));
    const move = moveBetween(before, listOf(down.current));
    if (Math.hypot(move.dx, move.dy) > 3 || move.scale !== 1) moved.current = true;
    const z = tileZoom(camera.zoom);
    const centre = toTile(camera.lng, camera.lat, z);
    const panned = fromTile(centre.x - move.dx / TILE_SIZE, centre.y - move.dy / TILE_SIZE, z);
    // A pinch is a whole zoom step at a time: the tiles only come in steps.
    const zoom = move.scale === 1
      ? camera.zoom
      : Math.max(PIN_MIN_ZOOM, Math.min(PIN_MAX_ZOOM, camera.zoom + Math.log2(move.scale)));
    onCamera({ lng: panned.lng, lat: panned.lat, zoom });
  };

  const onUp = (e: React.PointerEvent) => {
    const had = down.current.delete(e.pointerId);
    if (!had || down.current.size > 0) return;
    if (moved.current) return;
    // A tap on the map, and nothing else: a pin goes there.
    const p = at(e);
    const where = unplace(p.x, p.y);
    onDropAt(where.lng, where.lat);
  };

  const wheel = (e: React.WheelEvent) => {
    e.preventDefault();
    onCamera({
      ...camera,
      zoom: Math.max(PIN_MIN_ZOOM, Math.min(PIN_MAX_ZOOM, camera.zoom + (e.deltaY < 0 ? 1 : -1))),
    });
  };

  const spot = here ? place(here.lng, here.lat) : null;

  return (
    /* The zoom is published on the element so a test can see what a pinch
       did; nothing in the app reads it. */
    <div ref={box} data-place-pins data-place-zoom={camera.zoom.toFixed(2)}
      className="absolute inset-0 touch-none select-none text-foreground">
      <canvas ref={canvas} data-place-tiles className="absolute inset-0"
        style={{ width: size.w, height: size.h, filter: 'saturate(0.6) contrast(0.95)' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onWheel={wheel} />

      {/* Where the person is, when they have asked to be found. */}
      {spot && spot.x > -20 && spot.y > -20 && spot.x < size.w + 20 && spot.y < size.h + 20 && (
        <span aria-hidden data-place-here
          className="pointer-events-none absolute h-3 w-3 rounded-full border-2 border-primary bg-surface"
          style={{ left: spot.x, top: spot.y, transform: 'translate(-50%, -50%)' }} />
      )}

      {clusters.map((c) => {
        const only = c.pins.length === 1 ? c.pins[0] : null;
        const Icon = only ? PIN_ICON[only.category] : null;
        const on = !!only && selected === only.id;
        return (
          <button
            key={c.key}
            type="button"
            data-place-pin={only ? only.id : undefined}
            data-place-cluster={only ? undefined : c.pins.length}
            aria-label={only ? only.name : String(c.pins.length)}
            className={`absolute grid place-items-center rounded-full border bg-surface text-foreground transition-transform ${
              on ? 'scale-110 border-primary' : 'border-foreground/70'}`}
            style={{
              left: c.x,
              top: c.y,
              width: only ? 26 : 32,
              height: only ? 26 : 32,
              transform: 'translate(-50%, -100%)',
              borderWidth: on ? 2 : 1.5,
            }}
            onClick={() => {
              if (only) return onSelect(on ? null : only.id);
              const at2 = unplace(c.x, c.y);
              onCamera({ lng: at2.lng, lat: at2.lat, zoom: Math.min(PIN_MAX_ZOOM, camera.zoom + 2) });
            }}
          >
            {Icon ? <Icon aria-hidden className="h-3.5 w-3.5" /> : <span className="text-[11px] tabular-nums">{c.pins.length}</span>}
          </button>
        );
      })}

      {offline && (
        <p role="status" data-place-offline
          className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full border border-border bg-surface/90 px-3 py-1 text-[12px] text-muted-foreground">
          {t('place.offline.tiles')}
        </p>
      )}

      {/* OpenStreetMap asks for this, and it is theirs to ask. */}
      <p className="pointer-events-none absolute bottom-1 right-2 text-[10px] text-muted-foreground" data-place-attribution>
        © OpenStreetMap contributors
      </p>
    </div>
  );
}
