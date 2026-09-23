/**
 * The relation map's people, as the rest of the app reads them.
 *
 * Ids and names, read-only, never written back — the one-way rule every tie
 * between these pages follows. A place pin and a moment on the life line both
 * keep ids alone, so somebody renamed on the map is renamed everywhere, and
 * somebody taken off it simply stops being mentioned.
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

/** The names behind a list of ids, in the order the ids were given. Ids that
 *  no longer belong to anybody are left out rather than shown as gaps. */
export function namesOf(ids: readonly string[] | undefined, people: readonly Someone[]): string[] {
  if (!ids?.length) return [];
  const by = new Map(people.map((p) => [p.id, p.name]));
  return ids.map((id) => by.get(id)).filter((n): n is string => !!n);
}
