/**
 * The world itself: the shapes to colour in, the cities to look up, and the
 * arithmetic that turns a longitude and a latitude into a spot on the page.
 *
 * Both files ship with the app (public/world/, built by
 * scripts/place/build-world.mjs from Natural Earth, public domain) and are
 * fetched from our own origin, once, and then kept by the service worker. No
 * geocoding service is called, here or anywhere: a map of where someone has
 * been is not a thing to hand to a stranger.
 *
 * Country names are not in the file. Intl.DisplayNames knows them in every
 * language the app speaks; the English name that ships is the fallback and
 * something to match a search against.
 */
import type { CountryShape } from './place';

export interface CityRow {
  /** `${code}-${slug}`: stable, so a city chosen today is the same one in a year. */
  id: string;
  name: string;
  code: string;
  lng: number;
  lat: number;
}

const WORLD_URL = '/world/countries.json';
const CITIES_URL = '/world/cities.json';

interface WireCountry { c: string; n: string; k: string; g: Array<Array<[number, number]>> }

let world: Promise<CountryShape[]> | null = null;
let cities: Promise<CityRow[]> | null = null;

/** The countries, fetched once per page. Never throws: an empty world draws
 *  an empty map rather than a broken page. */
export function loadWorld(): Promise<CountryShape[]> {
  world ??= fetch(WORLD_URL)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
    .then((data: { countries: WireCountry[] }) => data.countries.map((c) => ({
      code: c.c, name: c.n, continent: c.k, rings: c.g,
    })))
    .catch(() => []);
  return world;
}

/** A city's id, from the two things about it that never change. */
export const cityId = (code: string, name: string): string =>
  `${code}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

export function loadCities(): Promise<CityRow[]> {
  cities ??= fetch(CITIES_URL)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
    .then((data: { cities: Array<[string, string, number, number]> }) => data.cities.map(([name, code, lng, lat]) => ({
      id: cityId(code, name), name, code, lng, lat,
    })))
    .catch(() => []);
  return cities;
}

/** Forget what was loaded (tests only). */
export function forgetWorld(): void {
  world = null;
  cities = null;
}

// ── Names ────────────────────────────────────────────────────────────────────

const namers = new Map<string, Intl.DisplayNames | null>();

/** The country's name in the reader's own language, or the English one. */
export function countryName(code: string, fallback: string, lang: string): string {
  if (!namers.has(lang)) {
    try {
      namers.set(lang, new Intl.DisplayNames([lang], { type: 'region' }));
    } catch {
      namers.set(lang, null);
    }
  }
  try {
    return namers.get(lang)?.of(code) || fallback;
  } catch {
    return fallback;
  }
}

/** Countries whose name matches, in the reader's language or in English. */
export function searchCountries(
  shapes: readonly CountryShape[],
  query: string,
  lang: string,
  limit = 8,
): CountryShape[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: CountryShape[] = [];
  for (const s of shapes) {
    if (s.name.toLowerCase().includes(q)
      || countryName(s.code, s.name, lang).toLowerCase().includes(q)
      || s.code.toLowerCase() === q) out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** Cities whose name starts with, or contains, what has been typed. Starts-with
 *  first, because that is what someone typing a name means. */
export function searchCities(rows: readonly CityRow[], query: string, limit = 8, code?: string): CityRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: CityRow[] = [];
  const has: CityRow[] = [];
  for (const row of rows) {
    if (code && row.code !== code) continue;
    const name = row.name.toLowerCase();
    if (name.startsWith(q)) starts.push(row);
    else if (name.includes(q)) has.push(row);
    if (starts.length >= limit) break;
  }
  return [...starts, ...has].slice(0, limit);
}

// ── Where a place lands on the page ──────────────────────────────────────────

/**
 * A plain equirectangular projection, cut off above the Arctic and below the
 * southern ocean. Antarctica is left out on purpose: drawn this way it takes a
 * third of the picture and nobody has been there.
 */
export const MAP_NORTH = 84;
export const MAP_SOUTH = -58;
/** The picture's shape, as width ÷ height. */
export const MAP_RATIO = 360 / (MAP_NORTH - MAP_SOUTH);

/** Longitude and latitude → a point in the unit square (0–1, y downward). */
export const project = (lng: number, lat: number): { x: number; y: number } => ({
  x: (lng + 180) / 360,
  y: (MAP_NORTH - lat) / (MAP_NORTH - MAP_SOUTH),
});

/** The inverse: a point in the unit square → longitude and latitude. */
export const unproject = (x: number, y: number): { lng: number; lat: number } => ({
  lng: x * 360 - 180,
  lat: MAP_NORTH - y * (MAP_NORTH - MAP_SOUTH),
});

/** One country as an SVG path, in the unit square scaled by `size`. */
export function countryPath(shape: CountryShape, w: number, h: number): string {
  let d = '';
  for (const ring of shape.rings) {
    for (let i = 0; i < ring.length; i++) {
      const p = project(ring[i][0], ring[i][1]);
      d += `${i === 0 ? 'M' : 'L'}${(p.x * w).toFixed(1)} ${(p.y * h).toFixed(1)}`;
    }
    d += 'Z';
  }
  return d;
}

// ── Web Mercator, for the tile map ───────────────────────────────────────────

/** Longitude and latitude → tile coordinates at `zoom` (fractional). */
export function toTile(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const rad = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
}

/** The inverse of toTile. */
export function fromTile(x: number, y: number, zoom: number): { lng: number; lat: number } {
  const n = 2 ** zoom;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { lng: (x / n) * 360 - 180, lat };
}
