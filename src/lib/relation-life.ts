/**
 * The bridge from the life line to the relation map.
 *
 * The life record already holds a mother and a father; asking for them a
 * second time would be rude. So the map offers to bring them across, once,
 * with a tap — and afterwards keeps their name and birthday in step, in one
 * direction only.
 *
 * One direction, because the two pages mean different things by a person. The
 * life line's parents are part of a life story and are edited there; the map's
 * people carry things the line knows nothing about (how close, when we last
 * spoke). Writing back would let a note about a birthday quietly rewrite the
 * story. Deleting is independent in both directions for the same reason.
 */
import { RELATION_KEY, type Person, type RelationData } from './relation';
import { LIFE_KEY, decodeLife, isFullDate, type FamilyMember, type LifeData } from './life';
import type { PersonDraft } from '@/hooks/useRelation';

/** The life record as it stands on this device, or null. */
export function readLife(): LifeData | null {
  try {
    const raw = localStorage.getItem(LIFE_KEY);
    return raw ? decodeLife(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** The relation record as it stands, for the life page to look at in turn. */
export function readRelation(): unknown {
  try {
    const raw = localStorage.getItem(RELATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** The parents the map has not been given yet. */
export function familyToImport(life: LifeData | null, data: RelationData): FamilyMember[] {
  if (!life) return [];
  const already = new Set(data.people.map((p) => p.lifeFamilyId).filter(Boolean));
  return life.family.filter((f) => !already.has(f.id));
}

/** One of the life record's family members, as someone on the map. */
export function personFromFamily(f: FamilyMember, labelOf: (relation: FamilyMember['relation']) => string): PersonDraft {
  return {
    name: f.name.trim() || labelOf(f.relation),
    group: 'family',
    relation: labelOf(f.relation),
    // Family come in at the closest ring: that is what the life line says.
    closeness: 5,
    ...(isFullDate(f.birthDate) ? { birthday: f.birthDate } : {}),
    lifeFamilyId: f.id,
  };
}

/**
 * Bring anyone whose details have changed on the life line up to date. Only
 * the two fields the life line owns — the name and the birthday — and only
 * when the line actually has something to say.
 */
export function syncFromLife(life: LifeData | null, people: readonly Person[]): Person[] {
  if (!life) return [...people];
  const byId = new Map(life.family.map((f) => [f.id, f]));
  return people.map((p) => {
    const f = p.lifeFamilyId ? byId.get(p.lifeFamilyId) : undefined;
    if (!f) return p;
    const name = f.name.trim() || p.name;
    const birthday = isFullDate(f.birthDate) ? f.birthDate : p.birthday;
    if (name === p.name && birthday === p.birthday) return p;
    return { ...p, name, ...(birthday ? { birthday } : {}) };
  });
}

/** Did anything actually change? (So a visit never writes for the sake of it.) */
export const samepeople = (a: readonly Person[], b: readonly Person[]): boolean =>
  a.length === b.length && a.every((p, i) => p === b[i]);

/**
 * The moments on the life line that say this person was there.
 *
 * Read from the life record as it stands, newest first — every line on the
 * board, mine included, because a wedding is on the line of whoever's page it
 * was written on. The tie is one-way, as always: the life line keeps the ids
 * and this only reads them.
 */
export function momentsWith(personId: string, life: LifeData | null = readLife()): { date: string; title: string }[] {
  if (!life || !personId) return [];
  const lines = [life.milestones, ...(life.others ?? []).map((o) => o.milestones)];
  return lines
    .flat()
    .filter((m) => m.who?.includes(personId))
    .map((m) => ({ date: m.date, title: m.title }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
