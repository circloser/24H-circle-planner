/**
 * Looking a place up by its name, in the language it is called by.
 *
 * The city list that ships with the app is Natural Earth's: seven thousand
 * places, named in English, which is a map of the world but not a map of a
 * life. 창녕 is not in it, 서천 is not in it, and typing either into a list of
 * romanised names finds nothing at all.
 *
 * So there is a second way to look, and it is the one OpenStreetMap already
 * gives us: Nominatim, which knows the small places and knows their names in
 * their own language. It is asked only when a person presses the button that
 * asks it — never as they type. Nominatim's usage policy forbids
 * autocomplete, and a search that fires on every keystroke would be exactly
 * that; it is also the polite way to treat a service nobody is paying for.
 *
 * What leaves this device is the words typed and the language they should be
 * answered in. That is said in the privacy policy, because it is the one
 * place on this map where something is sent anywhere.
 */
import { cityId, type CityRow } from './place-world';

/** One search, at most, in this long — the service asks for no more. */
export const LOOKUP_GAP_MS = 1200;
/** How many answers are worth showing. */
export const LOOKUP_LIMIT = 8;

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

export interface FoundPlace extends CityRow {
  /** Where it is, said the long way: "경상남도, 대한민국". */
  detail: string;
}

/** The address a search would go to, kept in one place so a test can read it. */
export function lookupUrl(query: string, lang: string): string {
  const url = new URL(ENDPOINT);
  url.searchParams.set('q', query.trim());
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(LOOKUP_LIMIT));
  // Towns, villages and counties — the places somebody lives. Without this a
  // search for 창녕 answers with a road, a school and a police station.
  url.searchParams.set('featureType', 'settlement');
  // The answer comes back in the reader's own language where there is one.
  url.searchParams.set('accept-language', lang);
  return url.toString();
}

interface WirePlace {
  name?: unknown;
  display_name?: unknown;
  lat?: unknown;
  lon?: unknown;
  osm_type?: unknown;
  osm_id?: unknown;
  place_id?: unknown;
  address?: { country_code?: unknown } | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * What of an answer is worth keeping.
 *
 * Kept apart from the fetching so it can be tested without a network: given
 * what Nominatim says, this is what the app would show and store.
 */
export function parsePlaces(payload: unknown): FoundPlace[] {
  const rows = Array.isArray(payload) ? payload : [];
  const out: FoundPlace[] = [];
  const seen = new Set<string>();
  for (const row of rows as WirePlace[]) {
    const lat = num(row?.lat);
    const lng = num(row?.lon);
    if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const whole = typeof row.display_name === 'string' ? row.display_name : '';
    const name = (typeof row.name === 'string' && row.name.trim())
      || whole.split(',')[0]?.trim()
      || '';
    if (!name) continue;
    const cc = row.address?.country_code;
    const code = typeof cc === 'string' && /^[a-z]{2}$/i.test(cc) ? cc.toUpperCase() : '';
    if (!code) continue; // a place with no country is nowhere this map can put it
    // Its own id, so it never collides with one from the bundled list, and so
    // the same place looked up twice is the same place.
    const kind = typeof row.osm_type === 'string' ? row.osm_type[0] : 'p';
    const ref = row.osm_id ?? row.place_id;
    const id = ref === undefined || ref === null
      ? cityId(code, `${name}-${lat.toFixed(3)}-${lng.toFixed(3)}`)
      : `u_${kind}${ref}`;
    if (seen.has(id)) continue;
    seen.add(id);
    // The first part of the long name is the place itself; the rest says
    // which of the several places with that name it is.
    const detail = whole.split(',').slice(1).join(',').trim() || whole;
    out.push({
      id: id.slice(0, 64),
      name: name.slice(0, 60),
      code,
      lat: Math.round(lat * 1e4) / 1e4,
      lng: Math.round(lng * 1e4) / 1e4,
      // Everything found this way is treated as a major place: it was asked
      // for by name, so it is worth a dot wherever dots are drawn.
      rank: 2,
      detail: detail.slice(0, 120),
    });
    if (out.length >= LOOKUP_LIMIT) break;
  }
  return out;
}

/**
 * Ask, once. Never throws: a search that cannot be made comes back empty,
 * which the caller says out loud rather than swallowing.
 */
export async function lookupPlace(
  query: string,
  lang: string,
  signal?: AbortSignal,
): Promise<FoundPlace[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(lookupUrl(q, lang), {
      signal: signal ?? null,
      headers: { Accept: 'application/json' },
      referrerPolicy: 'strict-origin-when-cross-origin',
    });
    if (!res.ok) return [];
    return parsePlaces(await res.json());
  } catch {
    return [];
  }
}
