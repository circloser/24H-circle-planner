import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { loadPersisted, type PersistedCodec } from '@/hooks/usePersistedState';
import { persistLocal } from '@/lib/persistence';
import { deletePhoto } from '@/lib/calendar-photos';
import { todayKey } from '@/lib/calendar-grid';
import {
  RELATION_KEY, decodeRelation, emptyRelation, encodeRelation, isNewerRelation, relationPhotoIds,
  type Closeness, type Person, type RelationData, type RelationLink,
} from '@/lib/relation';

export const relationCodec: PersistedCodec<RelationData> = {
  decode: decodeRelation,
  encode: encodeRelation,
  fallback: emptyRelation,
};

/** How long a deleted person can still be brought back (as on the life line). */
export const RELATION_UNDO_MS = 20_000;

export type PersonDraft = Omit<Person, 'id' | 'createdAt'>;

/** A picture nobody points to any more leaves this device's store. */
function dropPhoto(before: string | undefined, after?: string): void {
  if (before && before !== after) void deletePhoto(before);
}

/** The stored record comes from a newer version of the app: show it, never
 *  save over it. */
function storedIsNewer(): boolean {
  try {
    const raw = localStorage.getItem(RELATION_KEY);
    return raw !== null && isNewerRelation(JSON.parse(raw));
  } catch {
    return false;
  }
}

/**
 * The relation record. Saves go through persistLocal, so the header's save
 * indicator, its retry and the emergency backup cover this map the way they
 * cover the timetable. Every edit stamps `updatedAt`.
 */
export function useRelation() {
  const [data, setData] = useState<RelationData>(() => loadPersisted(RELATION_KEY, relationCodec));
  const [readOnly, setReadOnly] = useState(storedIsNewer);
  /** Bumped by a restore, so views holding a draft start afresh. */
  const [generation, setGeneration] = useState(0);
  const loaded = useRef(data);
  useEffect(() => {
    if (data === loaded.current || readOnly) return;
    persistLocal(RELATION_KEY, encodeRelation(data));
  }, [data, readOnly]);

  const current = useRef(data);
  useEffect(() => { current.current = data; }, [data]);

  const edit = useCallback((fn: (d: RelationData) => RelationData) => {
    setData((prev) => ({ ...fn(prev), updatedAt: new Date().toISOString() }));
  }, []);

  const setMe = useCallback((patch: Partial<RelationData['me']>) => {
    dropPhoto(current.current.me.photo, patch.photo ?? current.current.me.photo);
    edit((d) => ({ ...d, me: { ...d.me, ...patch } }));
  }, [edit]);

  const addPerson = useCallback((draft: PersonDraft): string => {
    const id = uuid();
    edit((d) => ({ ...d, people: [...d.people, { ...draft, id, createdAt: new Date().toISOString() }] }));
    return id;
  }, [edit]);

  /** Several at once (importing the family from the life record). */
  const addPeople = useCallback((drafts: readonly PersonDraft[]): string[] => {
    const now = new Date().toISOString();
    const made = drafts.map((draft) => ({ ...draft, id: uuid(), createdAt: now }));
    edit((d) => ({ ...d, people: [...d.people, ...made] }));
    return made.map((p) => p.id);
  }, [edit]);

  const updatePerson = useCallback((id: string, draft: PersonDraft) => {
    dropPhoto(current.current.people.find((p) => p.id === id)?.photo, draft.photo);
    edit((d) => ({
      ...d,
      people: d.people.map((p) => (p.id === id ? { ...draft, id, createdAt: p.createdAt } : p)),
    }));
  }, [edit]);

  /** Move someone by hand, or (with `at` undefined) let their ring have them back. */
  const placePerson = useCallback((id: string, at: Person['at']) => {
    edit((d) => ({
      ...d,
      people: d.people.map((p) => (p.id === id ? (at ? { ...p, at } : stripAt(p)) : p)),
    }));
  }, [edit]);

  /** One tap: it was today. The faded node comes straight back. */
  const markContacted = useCallback((id: string, today: string = todayKey()) => {
    edit((d) => ({ ...d, people: d.people.map((p) => (p.id === id ? { ...p, lastContact: today } : p)) }));
  }, [edit]);

  /** Remove them, and hand back what it takes to put them back where they were. */
  const removePerson = useCallback((id: string): { person: Person; at: number; links: RelationLink[] } | null => {
    const at = current.current.people.findIndex((p) => p.id === id);
    const person = at < 0 ? null : current.current.people[at];
    const links = current.current.links.filter((l) => l.source === id || l.target === id);
    edit((d) => ({
      ...d,
      people: d.people.filter((p) => p.id !== id),
      links: d.links.filter((l) => l.source !== id && l.target !== id),
    }));
    if (person?.photo) {
      const photo = person.photo;
      window.setTimeout(() => {
        if (!current.current.people.some((p) => p.photo === photo)) void deletePhoto(photo);
      }, RELATION_UNDO_MS);
    }
    return person ? { person, at, links } : null;
  }, [edit]);

  const restorePerson = useCallback((person: Person, at: number, links: readonly RelationLink[]) => {
    edit((d) => {
      if (d.people.some((p) => p.id === person.id)) return d;
      const people = [...d.people];
      people.splice(Math.max(0, Math.min(at, people.length)), 0, person);
      return { ...d, people, links: [...d.links, ...links] };
    });
  }, [edit]);

  const addLink = useCallback((source: string, target: string, label?: string) => {
    edit((d) => ({ ...d, links: [...d.links, { source, target, ...(label ? { label } : {}) }] }));
  }, [edit]);

  /** Name the tie between two people; an empty name takes the name away. */
  /** How close those two are to each other. Three is the middle and is not
   *  stored, so setting it back to three takes it off the record. */
  const holdLink = useCallback((source: string, target: string, closeness: Closeness) => {
    const same = (l: RelationLink) =>
      (l.source === source && l.target === target) || (l.source === target && l.target === source);
    edit((d) => ({
      ...d,
      links: d.links.map((l) => {
        if (!same(l)) return l;
        const next: RelationLink = { source: l.source, target: l.target };
        if (l.label) next.label = l.label;
        if (closeness !== 3) next.closeness = closeness;
        return next;
      }),
    }));
  }, [edit]);

  const nameLink = useCallback((source: string, target: string, label: string) => {
    const same = (l: RelationLink) =>
      (l.source === source && l.target === target) || (l.source === target && l.target === source);
    edit((d) => ({
      ...d,
      links: d.links.map((l) => {
        if (!same(l)) return l;
        const next: RelationLink = { source: l.source, target: l.target };
        if (label.trim()) next.label = label.trim();
        if (l.closeness) next.closeness = l.closeness;
        return next;
      }),
    }));
  }, [edit]);

  const removeLink = useCallback((source: string, target: string) => {
    edit((d) => ({
      ...d,
      links: d.links.filter((l) => !((l.source === source && l.target === target) || (l.source === target && l.target === source))),
    }));
  }, [edit]);

  /** A restored backup replaces the whole record; only pictures the old one
   *  used leave the device's store. */
  const replace = useCallback((next: RelationData) => {
    const keep = new Set(relationPhotoIds(next));
    relationPhotoIds(current.current).filter((id) => !keep.has(id)).forEach((id) => void deletePhoto(id));
    setData(next);
    setReadOnly(false); // a restore is the person's own choice to replace it
    setGeneration((g) => g + 1);
  }, []);

  return {
    data, readOnly, generation, setMe, addPerson, addPeople, updatePerson, placePerson,
    markContacted, removePerson, restorePerson, addLink, nameLink, holdLink, removeLink, replace,
  };
}

/** The same person, no longer pinned to a spot: their ring has them back. */
function stripAt(p: Person): Person {
  const rest = { ...p };
  delete rest.at;
  return rest;
}

export type RelationApi = ReturnType<typeof useRelation>;
