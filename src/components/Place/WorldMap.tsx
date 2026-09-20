import { useMemo, useRef, useState } from 'react';
import type { CityVisit, CountryShape, CountryVisit } from '@/lib/place';
import { MAP_RATIO, countryPath, project } from '@/lib/place-world';

/** How far in the scratch map may be zoomed. */
export const WORLD_MIN_ZOOM = 1;
export const WORLD_MAX_ZOOM = 6;
/** Above this, city names are written beside their dots. */
export const CITY_LABEL_ZOOM = 1.6;

/** The picture's own coordinates; the SVG scales from here. */
const W = 1000;
const H = Math.round(W / MAP_RATIO);

export interface WorldMapProps {
  shapes: readonly CountryShape[];
  countries: readonly CountryVisit[];
  cities: readonly CityVisit[];
  /** Where the person lives now: their city is the one filled in. */
  homeCityId?: string;
  visited: string;
  selected: string | null;
  onSelect: (code: string | null) => void;
  nameOf: (code: string, fallback: string) => string;
}

interface View { k: number; x: number; y: number }

/**
 * The scratch map: every country on earth, and the ones that have been walked
 * on coloured in.
 *
 * SVG rather than a canvas, because 175 shapes is nothing for a browser and
 * an SVG is already the picture that gets exported. It works with no network
 * at all — the shapes ship with the app.
 */
export function WorldMap({
  shapes, countries, cities, homeCityId, visited, selected, onSelect, nameOf,
}: WorldMapProps) {
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; from: View; moved: boolean } | null>(null);

  const paths = useMemo(
    () => shapes.map((s) => ({ shape: s, d: countryPath(s, W, H) })),
    [shapes],
  );
  const been = useMemo(() => new Map(countries.map((c) => [c.code, c])), [countries]);

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, from: view, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    setView({ ...d.from, x: d.from.x + dx, y: d.from.y + dy });
  };
  const up = () => { drag.current = null; };
  const moved = () => drag.current?.moved ?? false;

  const wheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    // Zoom about the pointer, so the country under it stays under it.
    const px = e.clientX - box.left;
    const py = e.clientY - box.top;
    setView((v) => {
      const k = Math.max(WORLD_MIN_ZOOM, Math.min(WORLD_MAX_ZOOM, v.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      const f = k / v.k;
      return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f };
    });
  };

  const home = cities.find((c) => c.id === homeCityId);

  return (
    <svg
      ref={svg}
      data-place-world
      viewBox={`0 0 ${W} ${H}`}
      className="w-full touch-none select-none"
      style={{ aspectRatio: `${W} / ${H}` }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onWheel={wheel}
      onDoubleClick={() => setView({ k: 1, x: 0, y: 0 })}
    >
      {/* The pan and zoom live on one group; nothing below knows about them. */}
      <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
        {paths.map(({ shape, d }) => {
          const visit = been.get(shape.code);
          const on = !!visit;
          const lived = visit?.lived === true;
          const lit = hover === shape.code || selected === shape.code;
          return (
            <path
              key={shape.code}
              d={d}
              data-place-country={shape.code}
              data-place-visited={on ? (lived ? 'lived' : 'yes') : undefined}
              fill={on ? visited : 'currentColor'}
              fillOpacity={on ? (lived ? 0.7 : 0.45) + (lit ? 0.1 : 0) : 0.06 + (lit ? 0.06 : 0)}
              stroke={on ? visited : 'currentColor'}
              strokeOpacity={on ? 1 : 0.2}
              strokeWidth={(on ? 0.75 : 0.5) / view.k}
              strokeLinejoin="round"
              className="cursor-pointer text-foreground"
              onPointerEnter={() => setHover(shape.code)}
              onPointerLeave={() => setHover((h) => (h === shape.code ? null : h))}
              onClick={() => { if (!moved()) onSelect(selected === shape.code ? null : shape.code); }}
            >
              <title>{nameOf(shape.code, shape.name)}</title>
            </path>
          );
        })}

        {cities.map((city) => {
          const p = project(city.lng, city.lat);
          const isHome = city.id === home?.id;
          return (
            <g key={city.id} data-place-city={city.id}>
              <circle
                cx={p.x * W}
                cy={p.y * H}
                r={(isHome ? 4 : 3) / view.k}
                fill={isHome ? visited : 'var(--place-paper)'}
                stroke={isHome ? visited : 'currentColor'}
                strokeOpacity={isHome ? 1 : 0.7}
                strokeWidth={1 / view.k}
                className="text-foreground"
              />
              {view.k >= CITY_LABEL_ZOOM && (
                <text
                  x={p.x * W}
                  y={p.y * H - 6 / view.k}
                  textAnchor="middle"
                  fontSize={10 / view.k}
                  fill="currentColor"
                  fillOpacity={0.7}
                  className="pointer-events-none text-foreground"
                >
                  {city.name}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
