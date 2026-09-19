import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { loadPersisted, type PersistedCodec } from '@/hooks/usePersistedState';
import { persistLocal } from '@/lib/persistence';
import { deletePhoto } from '@/lib/calendar-photos';
import {
  LIFE_KEY, decodeLife, emptyLife, encodeLife, isNewerLife, photoIds,
  type FamilyMember, type LifeData, type LifeProfile, type Milestone,
} from '@/lib/life';

export const lifeCodec: PersistedCodec<LifeData> = { decode: decodeLife, encode: encodeLife, fallback: emptyLife };

/** A picture no entry points to any more leaves this device's store. */
function dropPhoto(before: string | undefined, after?: string): void {
  if (before && before !== after) void deletePhoto(before);
}

/** The stored record comes from a newer version of the app (an old copy still
 *  cached by the service worker): show nothing we might save over it. */
function storedIsNewer(): boolean {
  try {
    const raw = localStorage.getItem(LIFE_KEY);
    return raw !== null && isNewerLife(JSON.parse(raw));
  } catch {
    return false;
  }
}

export type MilestoneDraft = Omit<Milestone, 'id'>;
export type MemberDraft = Omit<FamilyMember, 'id'>;

/**
 * The life record. Saves go through persistLocal, so the header's save
 * indicator, its retry and the emergency backup cover this page like the
 * timetable. Every edit stamps `updatedAt`.
 */
export function useLife() {
  const [life, setLife] = useState<LifeData>(() => loadPersisted(LIFE_KEY, lifeCodec));
  const [readOnly, setReadOnly] = useState(storedIsNewer);
  // Bumped by a restore, so views holding a draft of their own start afresh.
  const [generation, setGeneration] = useState(0);
  // What was just loaded is already stored: only real edits are written back.
  const loaded = useRef(life);
  useEffect(() => {
    if (life === loaded.current || readOnly) return;
    persistLocal(LIFE_KEY, encodeLife(life));
  }, [life, readOnly]);

  // The record as last rendered, for the photo clean-up below (kept out of
  // the state updaters, which must stay pure) and for immediate saves.
  const current = useRef(life);
  useEffect(() => { current.current = life; }, [life]);

  const edit = useCallback((fn: (l: LifeData) => LifeData) => {
    setLife((prev) => ({ ...fn(prev), updatedAt: new Date().toISOString() }));
  }, []);

  const setProfile = useCallback((patch: Partial<LifeProfile>) => {
    edit((l) => ({ ...l, profile: { ...l.profile, ...patch } }));
  }, [edit]);

  const addMilestone = useCallback((draft: MilestoneDraft): string => {
    const id = uuid();
    edit((l) => ({ ...l, milestones: [...l.milestones, { ...draft, id }] }));
    return id;
  }, [edit]);

  const updateMilestone = useCallback((id: string, draft: MilestoneDraft) => {
    dropPhoto(current.current.milestones.find((m) => m.id === id)?.photo, draft.photo);
    edit((l) => ({ ...l, milestones: l.milestones.map((m) => (m.id === id ? { ...draft, id } : m)) }));
  }, [edit]);

  const removeMilestone = useCallback((id: string) => {
    dropPhoto(current.current.milestones.find((m) => m.id === id)?.photo);
    edit((l) => ({ ...l, milestones: l.milestones.filter((m) => m.id !== id) }));
  }, [edit]);

  const addMember = useCallback((draft: MemberDraft): string => {
    const id = uuid();
    edit((l) => ({ ...l, family: [...l.family, { ...draft, id }] }));
    return id;
  }, [edit]);

  const updateMember = useCallback((id: string, draft: MemberDraft) => {
    dropPhoto(current.current.family.find((f) => f.id === id)?.photo, draft.photo);
    edit((l) => ({ ...l, family: l.family.map((f) => (f.id === id ? { ...draft, id } : f)) }));
  }, [edit]);

  const removeMember = useCallback((id: string) => {
    dropPhoto(current.current.family.find((f) => f.id === id)?.photo);
    edit((l) => ({ ...l, family: l.family.filter((f) => f.id !== id) }));
  }, [edit]);

  /** Saved at once, not after the next render: the note is also saved as the
   *  page goes away (a closed tab, leaving the life page), when no render
   *  will follow. */
  const setEndingNote = useCallback((text: string) => {
    const now = new Date().toISOString();
    const next = { ...current.current, endingNote: text.trim() ? { text, updatedAt: now } : null, updatedAt: now };
    current.current = next;
    if (!readOnly) persistLocal(LIFE_KEY, encodeLife(next));
    loaded.current = next;
    setLife(next);
  }, [readOnly]);

  /** A restored backup replaces the whole record; pictures only the old one
   *  used leave the device's store. */
  const replace = useCallback((next: LifeData) => {
    const keep = new Set(photoIds(next));
    photoIds(current.current).filter((id) => !keep.has(id)).forEach((id) => void deletePhoto(id));
    setLife(next);
    setReadOnly(false); // a restore is the person's own choice to replace it
    setGeneration((g) => g + 1);
  }, []);

  return {
    life, readOnly, generation, setProfile, addMilestone, updateMilestone, removeMilestone,
    addMember, updateMember, removeMember, setEndingNote, replace,
  };
}

export type LifeApi = ReturnType<typeof useLife>;
