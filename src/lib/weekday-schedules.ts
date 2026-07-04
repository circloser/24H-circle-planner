/**
 * Per-weekday default schedules. Maps each weekday (0=Sun … 6=Sat, matching
 * Date.getDay()) to a SAVED SLOT id (see lib/slots.ts). When the app opens on a
 * weekday that has an assignment, App prompts to load that day's schedule.
 *
 * Device-local (not in SYNC_KEYS) — it references slot ids, and slots themselves
 * are not synced, so the mapping stays with the slots on this device.
 */

export const STORAGE_KEY_WEEKDAY = '24h-circle-planner.weekday-schedules';
/** Last local date (YYYY-MM-DD) we prompted, so we ask at most once per day. */
export const STORAGE_KEY_WEEKDAY_PROMPTED = '24h-circle-planner.weekday-prompted';

/** weekday index (0=Sun … 6=Sat) → slot id */
export type WeekdayMap = Record<number, string>;

export function loadWeekdayMap(): WeekdayMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WEEKDAY);
    if (!raw) return {};
    const p = JSON.parse(raw) as { version?: number; byWeekday?: Record<string, unknown> };
    if (p && p.version === 1 && p.byWeekday && typeof p.byWeekday === 'object') {
      const out: WeekdayMap = {};
      for (const [k, v] of Object.entries(p.byWeekday)) {
        const n = Number(k);
        if (Number.isInteger(n) && n >= 0 && n <= 6 && typeof v === 'string' && v) out[n] = v;
      }
      return out;
    }
  } catch {
    /* corrupt / unavailable */
  }
  return {};
}

export function saveWeekdayMap(map: WeekdayMap): void {
  try {
    localStorage.setItem(STORAGE_KEY_WEEKDAY, JSON.stringify({ version: 1, byWeekday: map }));
  } catch {
    /* storage unavailable */
  }
}

/** Localized long weekday name for index 0..6. 2023-01-01 was a Sunday. */
export function weekdayName(index: number, lang: string): string {
  return new Date(2023, 0, 1 + index).toLocaleDateString(lang, { weekday: 'long' });
}
