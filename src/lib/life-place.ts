/**
 * The bridge between the life line and the place map.
 *
 * Two directions, both of them asked for by hand:
 *
 *  · A moment on the line can say where it happened. Choosing a city there
 *    colours that country in here, because having been somewhere is the same
 *    fact told twice.
 *  · The map can offer to read the line's travels and moves. It only ever
 *    OFFERS: a title is matched against the city list and put forward as a
 *    guess, and nothing is written until the guess has been agreed to. A map
 *    that colours itself in is a map that lies.
 */
import { LIFE_KEY, decodeLife, type LifeData, type Milestone } from './life';
import type { CityRow } from './place-world';
import type { PlaceData } from './place';

/** The life record as it stands on this device, or null. */
export function readLifeRecord(): LifeData | null {
  try {
    const raw = localStorage.getItem(LIFE_KEY);
    return raw ? decodeLife(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** The categories that are about going somewhere. */
const TRAVELLING = new Set(['travel', 'home']);

export interface PlaceGuess {
  milestone: Milestone;
  city: CityRow;
}

/**
 * Moments that look like they happened somewhere, with the city their title
 * seems to name. A title has to CONTAIN the city's name for it to count, and
 * the longest name wins, so "뉴욕 여행" finds New York and not York.
 */
export function placeGuesses(
  life: LifeData | null,
  cities: readonly CityRow[],
  already: PlaceData,
  limit = 20,
): PlaceGuess[] {
  if (!life) return [];
  const have = new Set(already.cities.map((c) => c.id));
  const byName = [...cities].sort((a, b) => b.name.length - a.name.length);
  const out: PlaceGuess[] = [];
  for (const m of life.milestones) {
    if (!TRAVELLING.has(m.category)) continue;
    if (m.placeRef?.cityId && have.has(m.placeRef.cityId)) continue;
    const haystack = `${m.title} ${m.description ?? ''}`.toLowerCase();
    const city = byName.find((c) => c.name.length >= 3 && haystack.includes(c.name.toLowerCase()));
    if (!city || have.has(city.id)) continue;
    if (out.some((g) => g.city.id === city.id)) continue;
    out.push({ milestone: m, city });
    if (out.length >= limit) break;
  }
  return out;
}

/** The year a moment happened, for the city's "first visit". */
export const guessYear = (m: Milestone): number | undefined => {
  const y = Number(m.date.slice(0, 4));
  return Number.isInteger(y) ? y : undefined;
};
