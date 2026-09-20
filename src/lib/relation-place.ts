/**
 * The place map, seen from a person's card: where we went together.
 *
 * Read-only and one way, like every other tie between these pages. The place
 * record keeps the ids; this reads the names out of it when a card is drawn,
 * so a pin renamed there is renamed here, and a pin deleted there simply
 * stops being mentioned.
 */
import { PLACE_KEY, decodePlace } from './place';

/** The names of the pins that say this person was there. */
export function placesWith(personId: string): string[] {
  try {
    const raw = localStorage.getItem(PLACE_KEY);
    const data = raw ? decodePlace(JSON.parse(raw)) : null;
    if (!data) return [];
    return data.pins.filter((p) => p.personIds?.includes(personId)).map((p) => p.name);
  } catch {
    return [];
  }
}
