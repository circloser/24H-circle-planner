import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { loadPersisted, type PersistedCodec } from '@/hooks/usePersistedState';
import { persistLocal } from '@/lib/persistence';
import { deletePhoto } from '@/lib/calendar-photos';
import {
  LIFE_KEY, MAX_LIFE_LINES, decodeLife, emptyLife, encodeLife, isNewerLife, photoIds,
  type FamilyMember, type LifeData, type LifeLine, type LifeProfile, type Milestone,
} from '@/lib/life';

export const lifeCodec: PersistedCodec<LifeData> = { decode: decodeLife, encode: encodeLife, fallback: emptyLife };

/** A picture no entry points to any more leaves this device's store. */
function dropPhoto(before: string | undefined, after?: string): void {
  if (before && before !== after) void deletePhoto(before);
}

/** How long a deleted entry can still be brought back. Its picture waits that
 *  long too — deleting it at once would make the undo restore an empty frame. */
export const UNDO_MS = 20_000;

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

  /** Remove it, and hand back what it takes to put it back where it was. */
  const removeMilestone = useCallback((id: string): { item: Milestone; at: number } | null => {
    const at = current.current.milestones.findIndex((m) => m.id === id);
    const item = at < 0 ? null : current.current.milestones[at];
    edit((l) => ({ ...l, milestones: l.milestones.filter((m) => m.id !== id) }));
    if (item?.photo) {
      const photo = item.photo;
      window.setTimeout(() => {
        if (!current.current.milestones.some((m) => m.photo === photo)) void deletePhoto(photo);
      }, UNDO_MS);
    }
    return item ? { item, at } : null;
  }, [edit]);

  const restoreMilestone = useCallback((item: Milestone, at: number) => {
    edit((l) => {
      if (l.milestones.some((m) => m.id === item.id)) return l;
      const next = [...l.milestones];
      next.splice(Math.max(0, Math.min(at, next.length)), 0, item);
      return { ...l, milestones: next };
    });
  }, [edit]);

  // ── Other people's lines, read beside mine ────────────────────────────────

  /** Someone else's life, added to the chart. */
  const addLine = useCallback((name: string, birthDate: string): string => {
    const id = uuid();
    edit((l) => ({
      ...l,
      others: [...(l.others ?? []), { id, name, birthDate, milestones: [] }].slice(0, MAX_LIFE_LINES - 1),
    }));
    return id;
  }, [edit]);

  const updateLine = useCallback((id: string, patch: { name?: string; birthDate?: string }) => {
    edit((l) => ({
      ...l,
      others: (l.others ?? []).map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  }, [edit]);

  /** Take a line off the chart, and hand back what it takes to put it back. */
  const removeLine = useCallback((id: string): { item: LifeLine; at: number } | null => {
    const all = current.current.others ?? [];
    const at = all.findIndex((o) => o.id === id);
    const item = at < 0 ? null : all[at];
    edit((l) => ({ ...l, others: (l.others ?? []).filter((o) => o.id !== id) }));
    return item ? { item, at } : null;
  }, [edit]);

  const restoreLine = useCallback((item: LifeLine, at: number) => {
    edit((l) => {
      const all = l.others ?? [];
      if (all.some((o) => o.id === item.id)) return l;
      const next = [...all];
      next.splice(Math.max(0, Math.min(at, next.length)), 0, item);
      return { ...l, others: next };
    });
  }, [edit]);

  /** A moment on somebody else's line. Their own list, nobody else's. */
  const addLineMoment = useCallback((lineId: string, draft: MilestoneDraft): string => {
    const id = uuid();
    edit((l) => ({
      ...l,
      others: (l.others ?? []).map((o) => (
        o.id === lineId ? { ...o, milestones: [...o.milestones, { ...draft, id }] } : o
      )),
    }));
    return id;
  }, [edit]);

  const updateLineMoment = useCallback((lineId: string, id: string, draft: MilestoneDraft) => {
    const line = (current.current.others ?? []).find((o) => o.id === lineId);
    dropPhoto(line?.milestones.find((m) => m.id === id)?.photo, draft.photo);
    edit((l) => ({
      ...l,
      others: (l.others ?? []).map((o) => (
        o.id === lineId
          ? { ...o, milestones: o.milestones.map((m) => (m.id === id ? { ...draft, id } : m)) }
          : o
      )),
    }));
  }, [edit]);

  const removeLineMoment = useCallback((lineId: string, id: string) => {
    edit((l) => ({
      ...l,
      others: (l.others ?? []).map((o) => (
        o.id === lineId ? { ...o, milestones: o.milestones.filter((m) => m.id !== id) } : o
      )),
    }));
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

  const removeMember = useCallback((id: string): { item: FamilyMember; at: number } | null => {
    const at = current.current.family.findIndex((f) => f.id === id);
    const item = at < 0 ? null : current.current.family[at];
    edit((l) => ({ ...l, family: l.family.filter((f) => f.id !== id) }));
    if (item?.photo) {
      const photo = item.photo;
      window.setTimeout(() => {
        if (!current.current.family.some((f) => f.photo === photo)) void deletePhoto(photo);
      }, UNDO_MS);
    }
    return item ? { item, at } : null;
  }, [edit]);

  const restoreMember = useCallback((item: FamilyMember, at: number) => {
    edit((l) => {
      if (l.family.some((f) => f.id === item.id)) return l;
      const next = [...l.family];
      next.splice(Math.max(0, Math.min(at, next.length)), 0, item);
      return { ...l, family: next };
    });
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

  /** Keep the memoir that was just written. Saved at once, like the note
   *  above it: a few pages are too dear to wait for the next render. */
  const setMemoir = useCallback((text: string) => {
    const now = new Date().toISOString();
    const body = text.trim();
    const next = { ...current.current, memoir: body ? { text: body, createdAt: now } : null, updatedAt: now };
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
    life, readOnly, generation, setProfile, addMilestone, updateMilestone, removeMilestone, restoreMilestone,
    addMember, updateMember, removeMember, restoreMember, setEndingNote, setMemoir, replace,
    addLine, updateLine, removeLine, restoreLine, addLineMoment, updateLineMoment, removeLineMoment,
  };
}

export type LifeApi = ReturnType<typeof useLife>;
