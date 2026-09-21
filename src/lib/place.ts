/**
 * Place — the fifth tab, and the axis of where.
 *
 * A day, a month, a life, the people; and now the countries, cities and
 * particular spots a person has actually been to. Two layers: a world map to
 * colour in (which works with no network at all) and a pin map over real
 * tiles for the places worth remembering exactly.
 *
 * Everything here is put in by hand. There is no location tracking, no
 * background GPS, no reading coordinates out of photographs — the one thing
 * that touches the device's location is a button that has to be pressed, and
 * it reads the position once.
 *
 * This module is the data layer: the stored envelope and its strict decode
 * (the value also travels in the Pro sync blob, so load → save must be
 * byte-stable), and the small sums the page shows.
 */
import { todayKey } from './calendar-grid';

export const PLACE_KEY = '24h-circle-planner.place';

/** What a pin is. Drawn as an icon, never as a colour — the map keeps to one. */
export const PIN_CATEGORIES = ['home', 'stay', 'food', 'nature', 'culture', 'work', 'meet', 'other'] as const;
export type PinCategory = (typeof PIN_CATEGORIES)[number];

/**
 * The colours the map is drawn in, where they are not the theme's own.
 *
 * Two for the countries — been, and meaning to — and one a kind of pin. Stored
 * as `#rrggbb` and nothing else: what a sync or a restored backup hands over
 * is drawn straight onto a canvas and into a stylesheet, so anything that is
 * not exactly a colour is dropped rather than trusted.
 */
export interface PlacePalette {
  visited?: string;
  wished?: string;
  pins?: Partial<Record<PinCategory, string>>;
}

export const isPlaceColor = (v: unknown): v is string =>
  typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

export function cleanPalette(v: unknown): PlacePalette | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const raw = v as Record<string, unknown>;
  const out: PlacePalette = {};
  if (isPlaceColor(raw['visited'])) out.visited = raw['visited'].toLowerCase();
  if (isPlaceColor(raw['wished'])) out.wished = raw['wished'].toLowerCase();
  const pins = raw['pins'];
  if (pins && typeof pins === 'object') {
    const kept: Partial<Record<PinCategory, string>> = {};
    for (const category of PIN_CATEGORIES) {
      const colour = (pins as Record<string, unknown>)[category];
      if (isPlaceColor(colour)) kept[category] = colour.toLowerCase();
    }
    if (Object.keys(kept).length) out.pins = kept;
  }
  return Object.keys(out).length ? out : undefined;
}

export interface CountryVisit {
  /** ISO 3166-1 alpha-2, upper case. */
  code: string;
  firstYear?: number;
  lived?: boolean;
  /** Not been — WANT to go. The two are exclusive: a country is one or the
   *  other, and colouring it in either way clears the other. */
  wish?: boolean;
  note?: string;
}

/** Been there (as against only wanting to go). */
export const isBeen = (visit: CountryVisit | undefined): boolean => !!visit && visit.wish !== true;
/** On the list of somewhere to go. */
export const isWished = (visit: CountryVisit | undefined): boolean => visit?.wish === true;

export interface CityVisit {
  /** An id from the bundled list, or one of our own with a `u_` in front. */
  id: string;
  name: string;
  countryCode: string;
  lat: number;
  lng: number;
  firstYear?: number;
  lived?: boolean;
}

export interface Pin {
  id: string;
  name: string;
  category: PinCategory;
  lat: number;
  lng: number;
  /** Worked out from the shapes when the pin is dropped. */
  countryCode?: string;
  /** 'YYYY-MM-DD' or 'YYYY'. */
  date?: string;
  endDate?: string;
  note?: string;
  /** A photo id in this device's picture store (Pro). */
  photo?: string;
  /** People from the relation map who were there. */
  personIds?: string[];
  /** A shortcut: on the little rail in the corner of the pin map. */
  star?: boolean;
  /** A moment on the life line this pin belongs to. */
  lifeMilestoneId?: string;
  createdAt: string;
}

export interface PlaceData {
  version: 1;
  /** Where the person lives now. */
  home?: { countryCode: string; cityId?: string };
  countries: CountryVisit[];
  cities: CityVisit[];
  pins: Pin[];
  /** The colours the map is drawn in, where they are not the theme's own
   *  (lib/place-colors). */
  palette?: PlacePalette;
  updatedAt: string;
}

export const MAX_PLACE_NAME = 60;
export const MAX_PLACE_NOTE = 400;
const MIN_YEAR = 1800;
const MAX_YEAR = 2200;

export const emptyPlace = (): PlaceData => ({
  version: 1,
  countries: [],
  cities: [],
  pins: [],
  updatedAt: '',
});

// ── Coordinates ──────────────────────────────────────────────────────────────

export const isLat = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;
export const isLng = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;
export const isCountryCode = (v: unknown): v is string => typeof v === 'string' && /^[A-Z]{2}$/.test(v);

/** 'YYYY-MM-DD' or 'YYYY' — a trip remembered to the day, or to the year. */
export function isPlaceDate(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  if (/^\d{4}$/.test(v)) {
    const y = Number(v);
    return y >= MIN_YEAR && y <= MAX_YEAR;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const y = Number(v.slice(0, 4));
  return y >= MIN_YEAR && y <= MAX_YEAR && !Number.isNaN(Date.parse(v));
}

/**
 * Is this point inside that ring? The ray-casting rule, which is all a
 * coastline rounded to a kilometre deserves.
 */
export function pointInRing(lng: number, lat: number, ring: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface CountryShape { code: string; name: string; continent: string; rings: Array<Array<[number, number]>> }

/** Which country a point falls in, or null out at sea. */
export function countryAt(shapes: readonly CountryShape[], lng: number, lat: number): string | null {
  for (const s of shapes) {
    for (const ring of s.rings) {
      if (pointInRing(lng, lat, ring)) return s.code;
    }
  }
  return null;
}

// ── Stored envelope ──────────────────────────────────────────────────────────

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const cut = v.slice(0, max);
  return cut.trim() ? cut : undefined;
};
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;
const year = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isInteger(v) && v >= MIN_YEAR && v <= MAX_YEAR ? v : undefined;
/** Six decimals is about ten centimetres; nothing here needs more. */
const coord = (v: number): number => Math.round(v * 1e6) / 1e6;

function cleanCountry(v: unknown): CountryVisit | null {
  const o = v as Record<string, unknown> | null;
  if (!o || !isCountryCode(o['code'])) return null;
  const first = year(o['firstYear']);
  const note = str(o['note'], MAX_PLACE_NOTE);
  // Wanting to go somewhere and having been there cannot both be true; the
  // wish is what is dropped, because a memory outranks a plan.
  const wish = o['wish'] === true && o['lived'] !== true && first === undefined;
  return {
    code: o['code'],
    ...(first !== undefined ? { firstYear: first } : {}),
    ...(o['lived'] === true ? { lived: true } : {}),
    ...(wish ? { wish: true } : {}),
    ...(note ? { note } : {}),
  };
}

function cleanCity(v: unknown): CityVisit | null {
  const o = v as Record<string, unknown> | null;
  if (!o || !isId(o['id']) || !isCountryCode(o['countryCode'])) return null;
  const name = str(o['name'], MAX_PLACE_NAME);
  if (!name || !isLat(o['lat']) || !isLng(o['lng'])) return null;
  const first = year(o['firstYear']);
  return {
    id: o['id'],
    name,
    countryCode: o['countryCode'],
    lat: coord(o['lat']),
    lng: coord(o['lng']),
    ...(first !== undefined ? { firstYear: first } : {}),
    ...(o['lived'] === true ? { lived: true } : {}),
  };
}

function cleanPin(v: unknown): Pin | null {
  const o = v as Record<string, unknown> | null;
  if (!o || !isId(o['id'])) return null;
  const name = str(o['name'], MAX_PLACE_NAME);
  if (!name || !isLat(o['lat']) || !isLng(o['lng'])) return null;
  const c = o['category'];
  const category: PinCategory = typeof c === 'string' && (PIN_CATEGORIES as readonly string[]).includes(c)
    ? (c as PinCategory) : 'other';
  const note = str(o['note'], MAX_PLACE_NOTE);
  const people = (Array.isArray(o['personIds']) ? o['personIds'] : []).filter(isId).slice(0, 40);
  return {
    id: o['id'],
    name,
    category,
    lat: coord(o['lat']),
    lng: coord(o['lng']),
    ...(isCountryCode(o['countryCode']) ? { countryCode: o['countryCode'] } : {}),
    ...(isPlaceDate(o['date']) ? { date: o['date'] } : {}),
    ...(isPlaceDate(o['endDate']) ? { endDate: o['endDate'] } : {}),
    ...(note ? { note } : {}),
    ...(isId(o['photo']) ? { photo: o['photo'] } : {}),
    ...(people.length ? { personIds: people } : {}),
    ...(o['star'] === true ? { star: true } : {}),
    ...(isId(o['lifeMilestoneId']) ? { lifeMilestoneId: o['lifeMilestoneId'] } : {}),
    createdAt: typeof o['createdAt'] === 'string' ? o['createdAt'] : '',
  };
}

/** Bring an older stored version up to the current shape. */
export function migratePlace(parsed: unknown): Record<string, unknown> | null {
  const p = parsed as Record<string, unknown> | null;
  if (!p || typeof p !== 'object') return null;
  if (p['version'] === 1) return p;
  return null;
}

/** Written by a newer version of the app than this one. */
export function isNewerPlace(parsed: unknown): boolean {
  const v = (parsed as Record<string, unknown> | null)?.['version'];
  return typeof v === 'number' && v > 1;
}

/** Strict decode: anything unknown or broken is dropped, never thrown on. */
export function decodePlace(parsed: unknown): PlaceData | null {
  const p = migratePlace(parsed);
  if (!p) return null;
  const codes = new Set<string>();
  const countries = (Array.isArray(p['countries']) ? p['countries'] : [])
    .map(cleanCountry)
    .filter((c): c is CountryVisit => !!c && !codes.has(c.code) && !!codes.add(c.code));
  const cityIds = new Set<string>();
  const cities = (Array.isArray(p['cities']) ? p['cities'] : [])
    .map(cleanCity)
    .filter((c): c is CityVisit => !!c && !cityIds.has(c.id) && !!cityIds.add(c.id));
  const pinIds = new Set<string>();
  const pins = (Array.isArray(p['pins']) ? p['pins'] : [])
    .map(cleanPin)
    .filter((x): x is Pin => !!x && !pinIds.has(x.id) && !!pinIds.add(x.id));
  const palette = cleanPalette(p['palette']);
  const home = p['home'] as Record<string, unknown> | undefined;
  const homeCode = home && isCountryCode(home['countryCode']) ? home['countryCode'] : null;
  return {
    version: 1,
    ...(homeCode
      ? { home: { countryCode: homeCode, ...(isId(home!['cityId']) ? { cityId: home!['cityId'] } : {}) } }
      : {}),
    countries,
    cities,
    pins,
    ...(palette ? { palette } : {}),
    updatedAt: typeof p['updatedAt'] === 'string' ? p['updatedAt'] : '',
  };
}

/** What is stored (and synced): the same cleaning as a load, so every save has
 *  one canonical shape whatever order an edit built its fields in. */
export const encodePlace = (data: PlaceData): PlaceData => decodePlace(data) ?? emptyPlace();

/** How many shortcuts fit on the rail. More than this and it is a list, not
 *  a row of buttons that can be hit without looking. */
export const MAX_PLACE_SHORTCUTS = 10;

/** The pins on the shortcut rail, oldest first, and never more than fit. */
export const shortcutPins = (d: PlaceData): Pin[] =>
  d.pins.filter((p) => p.star === true).slice(0, MAX_PLACE_SHORTCUTS);

// ── Free plan ────────────────────────────────────────────────────────────────

/** Countries and cities are free without limit — colouring in a map is the
 *  whole point. Pins hold photographs and notes, so those are counted. */
export const FREE_PLACE_PINS = 50;

export const canAddPin = (d: PlaceData, pro: boolean): boolean => pro || d.pins.length < FREE_PLACE_PINS;

// ── The line above the map ───────────────────────────────────────────────────

export interface PlaceSummary {
  countries: number;
  /** Of every country there is, as a whole percent. */
  percent: number;
  continents: number;
  cities: number;
  pins: number;
  /** Countries on the list of somewhere to go. */
  wished: number;
}

export function placeSummary(d: PlaceData, shapes: readonly CountryShape[]): PlaceSummary {
  const visited = new Set(d.countries.filter(isBeen).map((c) => c.code));
  const wished = new Set(d.countries.filter(isWished).map((c) => c.code));
  const byCode = new Map(shapes.map((s) => [s.code, s]));
  const continents = new Set<string>();
  for (const code of visited) {
    const s = byCode.get(code);
    if (s) continents.add(s.continent);
  }
  const total = shapes.length || 1;
  return {
    countries: visited.size,
    percent: Math.round((visited.size / total) * 100),
    continents: continents.size,
    cities: d.cities.length,
    pins: d.pins.length,
    wished: wished.size,
  };
}

/** Countries a person has been to, grouped by continent, each list by name. */
export function byContinent(
  d: PlaceData,
  shapes: readonly CountryShape[],
  nameOf: (code: string, fallback: string) => string,
): Array<{ continent: string; countries: Array<{ code: string; name: string; lived: boolean; wish: boolean }> }> {
  const byCode = new Map(shapes.map((s) => [s.code, s]));
  const out = new Map<string, Array<{ code: string; name: string; lived: boolean; wish: boolean }>>();
  for (const visit of d.countries) {
    const s = byCode.get(visit.code);
    if (!s) continue;
    const list = out.get(s.continent) ?? [];
    list.push({
      code: visit.code,
      name: nameOf(visit.code, s.name),
      lived: visit.lived === true,
      wish: isWished(visit),
    });
    out.set(s.continent, list);
  }
  return [...out.entries()]
    .map(([continent, countries]) => ({
      continent,
      countries: countries.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.continent.localeCompare(b.continent));
}

// ── Backup file ──────────────────────────────────────────────────────────────

export interface PlaceFile {
  app: '24h-circle-planner';
  kind: 'place';
  version: 1;
  exportedAt: string;
  place: PlaceData;
  /** Photo id → data URL, so a restore brings the pictures back too. */
  photos: Record<string, string>;
}

export function placeFile(place: PlaceData, photos: Record<string, string>, now = new Date()): PlaceFile {
  return { app: '24h-circle-planner', kind: 'place', version: 1, exportedAt: now.toISOString(), place, photos };
}

export const placePhotoIds = (d: PlaceData): string[] =>
  d.pins.map((p) => p.photo).filter((p): p is string => !!p);

/** Read a place backup — ours, or the whole-app backup. Throws on anything else. */
export function readPlaceFile(text: string): { place: PlaceData; photos: Record<string, string> } {
  const parsed = JSON.parse(text) as Record<string, unknown> | null;
  if (!parsed || parsed['app'] !== '24h-circle-planner') throw new Error('not a 24Houring file');
  let raw: unknown = null;
  if (parsed['kind'] === 'place') raw = parsed['place'];
  else if (parsed['data'] && typeof parsed['data'] === 'object') {
    const stored = (parsed['data'] as Record<string, unknown>)[PLACE_KEY];
    raw = typeof stored === 'string' ? JSON.parse(stored) : null;
  }
  const place = decodePlace(raw);
  if (!place) throw new Error('no place data');
  const photos: Record<string, string> = {};
  const given = parsed['photos'];
  if (given && typeof given === 'object') {
    for (const [id, url] of Object.entries(given as Record<string, unknown>)) {
      if (isId(id) && typeof url === 'string' && url.startsWith('data:image/')) photos[id] = url;
    }
  }
  return { place, photos };
}

/** A new id for a place the person typed in themselves. */
export const newCityId = (): string => `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
export const newPinId = (): string => `pin_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** The year a pin belongs to, for the year filter. */
export const pinYear = (p: Pin): number | null => (p.date ? Number(p.date.slice(0, 4)) : null);

/** Today, for a pin that is being dropped now. */
export const todayForPin = (): string => todayKey();
