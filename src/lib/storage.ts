import type { Schedule, ScheduleEnvelope } from '@/types/schedule';
import type { TimeSlice } from '@/types/time-slice';

export const STORAGE_KEY_SCHEDULE = '24h-circle-planner.schedule';
export const STORAGE_KEY_THEME = '24h-circle-planner.theme';

/** Validate that a value looks like a valid TimeSlice. */
function isValidSlice(s: unknown): s is TimeSlice {
  if (typeof s !== 'object' || s === null) return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['label'] === 'string' &&
    typeof obj['startTime'] === 'string' &&
    typeof obj['endTime'] === 'string' &&
    typeof obj['color'] === 'string' &&
    typeof obj['icon'] === 'string' &&
    (obj['textPosition'] === 'inside' || obj['textPosition'] === 'outside')
  );
}

/** Validate that a value looks like a valid Schedule. */
function isValidSchedule(s: unknown): s is Schedule {
  if (typeof s !== 'object' || s === null) return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['name'] === 'string' &&
    typeof obj['updatedAt'] === 'string' &&
    Array.isArray(obj['slices']) &&
    (obj['slices'] as unknown[]).every(isValidSlice)
  );
}

/**
 * Load the schedule from localStorage.
 * - If missing: returns null (no toast; caller distinguishes via getItem check).
 * - If v1 envelope: validates and returns Schedule.
 * - If missing version (legacy): stamps version:1 and returns.
 * - If unknown future version: returns null (caller should show toast).
 * - If corrupt/invalid: returns null.
 */
export function loadSchedule(): Schedule | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SCHEDULE);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;

    // Detect envelope vs legacy (direct schedule without wrapper)
    if ('version' in obj && 'schedule' in obj) {
      const version = obj['version'];
      if (version === 1) {
        const schedule = obj['schedule'];
        if (!isValidSchedule(schedule)) return null;
        return schedule;
      }
      // Unknown future version
      return null;
    }

    // Legacy: raw schedule object without envelope — migrate
    if (isValidSchedule(parsed)) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced save — coalesces rapid calls into one write after 500ms.
 * Persists only the present schedule (not undo/redo history).
 */
export function saveScheduleDebounced(schedule: Schedule): void {
  if (_debounceTimer !== null) {
    clearTimeout(_debounceTimer);
  }
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null;
    const envelope: ScheduleEnvelope = { version: 1, schedule };
    localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(envelope));
  }, 500);
}
