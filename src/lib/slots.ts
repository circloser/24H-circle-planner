import { toast } from 'sonner';
import type { Schedule } from '@/types/schedule';
import type { Slot, SlotsEnvelope } from '@/types/slot';

export const STORAGE_KEY_SLOTS = '24h-circle-planner.slots';
export const SLOTS_CAPACITY = 10;

// ─── Validation helpers ────────────────────────────────────────────────────────

function isValidSchedule(s: unknown): s is Schedule {
  if (typeof s !== 'object' || s === null) return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['name'] === 'string' &&
    typeof obj['updatedAt'] === 'string' &&
    Array.isArray(obj['slices'])
  );
}

function isValidSlot(v: unknown): v is Slot {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['name'] === 'string' &&
    typeof obj['createdAt'] === 'string' &&
    isValidSchedule(obj['schedule'])
  );
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ─── loadSlots ─────────────────────────────────────────────────────────────────

/**
 * Load named slots from localStorage.
 * - Missing key → returns {}
 * - Valid v1 envelope → returns validated record
 * - Legacy bare record (v0 migration) → migrates, re-persists, returns record
 * - Unknown version → shows toast, returns {}
 * - Corrupt JSON / invalid → returns {}
 */
export function loadSlots(): Record<string, Slot> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SLOTS);
    if (raw === null) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return {};

    // Has version + slots fields: treat as envelope
    if ('version' in parsed && 'slots' in parsed) {
      const version = parsed['version'];
      const slots = parsed['slots'];

      if (version === 1 && isPlainObject(slots)) {
        // Validate every slot
        const result: Record<string, Slot> = {};
        for (const [key, val] of Object.entries(slots)) {
          if (isValidSlot(val)) {
            result[key] = val;
          }
        }
        return result;
      }

      // Unknown future version
      if (typeof version === 'number' && version !== 1) {
        toast.error(`알 수 없는 슬롯 버전입니다 (${version}). 슬롯을 불러올 수 없습니다.`);
        return {};
      }

      return {};
    }

    // Legacy bare Record<string, Slot> — check if all values look like slots
    const allLookLikeSlots =
      isPlainObject(parsed) &&
      Object.values(parsed).every(
        (v) =>
          isPlainObject(v) &&
          typeof (v as Record<string, unknown>)['id'] === 'string' &&
          isValidSchedule((v as Record<string, unknown>)['schedule']),
      );

    if (allLookLikeSlots) {
      const migratedSlots: Record<string, Slot> = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (isValidSlot(val)) {
          migratedSlots[key] = val;
        }
      }
      // Persist migrated envelope immediately
      saveSlots(migratedSlots);
      return migratedSlots;
    }

    return {};
  } catch {
    return {};
  }
}

// ─── saveSlots ─────────────────────────────────────────────────────────────────

/**
 * Write the full slots record as a v1 SlotsEnvelope to localStorage.
 * No debounce — slot writes are user-initiated and rare.
 */
export function saveSlots(slots: Record<string, Slot>): void {
  const envelope: SlotsEnvelope = { version: 1, slots };
  localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(envelope));
}

// ─── saveSlot ─────────────────────────────────────────────────────────────────

/**
 * Save a single slot.
 * Returns { success: false, reason: 'capacity' } if at capacity and the slot is new.
 */
export function saveSlot(slot: Slot): { success: boolean; reason?: string } {
  const existing = loadSlots();
  const isNew = !(slot.id in existing);

  if (isNew && Object.keys(existing).length >= SLOTS_CAPACITY) {
    return { success: false, reason: 'capacity' };
  }

  existing[slot.id] = slot;
  saveSlots(existing);
  return { success: true };
}

// ─── deleteSlot ───────────────────────────────────────────────────────────────

/**
 * Delete a slot by id. No-op if id is missing.
 */
export function deleteSlot(id: string): void {
  const existing = loadSlots();
  if (!(id in existing)) return;
  delete existing[id];
  saveSlots(existing);
}

// ─── renameSlot ───────────────────────────────────────────────────────────────

/**
 * Rename a slot by id. No-op if id is missing.
 */
export function renameSlot(id: string, name: string): void {
  const existing = loadSlots();
  if (!(id in existing)) return;
  existing[id] = { ...existing[id], name };
  saveSlots(existing);
}
