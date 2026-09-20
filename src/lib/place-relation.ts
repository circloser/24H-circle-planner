/**
 * The bridge from the relation map to the place map: who was there.
 *
 * Read-only and one way. A pin keeps the ids of the people it was shared
 * with; the names are looked up from the relation record when the card is
 * drawn, so renaming someone there renames them here, and deleting someone
 * there simply leaves a pin with one fewer name on it.
 */
import { RELATION_KEY, decodeRelation } from './relation';

export interface Someone { id: string; name: string }

/** The people on the relation map, as ids and names. Never throws. */
export function readRelationPeople(): Someone[] {
  try {
    const raw = localStorage.getItem(RELATION_KEY);
    const data = raw ? decodeRelation(JSON.parse(raw)) : null;
    return data ? data.people.map((p) => ({ id: p.id, name: p.name })) : [];
  } catch {
    return [];
  }
}
