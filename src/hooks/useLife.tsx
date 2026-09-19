import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { loadPersisted, type PersistedCodec } from '@/hooks/usePersistedState';
import { persistLocal } from '@/lib/persistence';
import { deletePhoto } from '@/lib/calendar-photos';
import {
  LIFE_KEY, decodeLife, emptyLife, encodeLife,
  type FamilyMember, type LifeData, type LifeProfile, type Milestone,
} from '@/lib/life';

export const lifeCodec: PersistedCodec<LifeData> = { decode: decodeLife, encode: encodeLife, fallback: emptyLife };

/** A picture no entry points to any more leaves this device's store. */
function dropPhoto(before: string | undefined, after?: string): void {
  if (before && before !== after) void deletePhoto(before);
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
  // What was just loaded is already stored: only real edits are written back.
  const loaded = useRef(life);
  useEffect(() => {
    if (life === loaded.current) return;
    persistLocal(LIFE_KEY, encodeLife(life));
  }, [life]);

  const edit = useCallback((fn: (l: LifeData) => LifeData) => {
    setLife((prev) => ({ ...fn(prev), updatedAt: new Date().toISOString() }));
  }, []);

  const setProfile = useCallback((patch: Partial<LifeProfile>) => {
    edit((l) => ({ ...l, profile: { ...l.profile, ...patch } }));
  }, [edit]);

  // The record as last rendered, for the photo clean-up below (kept out of
  // the state updaters, which must stay pure).
  const current = useRef(life);
  useEffect(() => { current.current = life; }, [life]);

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

  const setEndingNote = useCallback((text: string) => {
    const now = new Date().toISOString();
    edit((l) => ({ ...l, endingNote: text.trim() ? { text, updatedAt: now } : null }));
  }, [edit]);

  /** A restored backup replaces the whole record. */
  const replace = useCallback((next: LifeData) => setLife(next), []);

  return {
    life, setProfile, addMilestone, updateMilestone, removeMilestone,
    addMember, updateMember, removeMember, setEndingNote, replace,
  };
}

export type LifeApi = ReturnType<typeof useLife>;
