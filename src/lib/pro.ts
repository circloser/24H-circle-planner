/**
 * Pro plan limits + the "open the upgrade paywall" signal.
 *
 * Pro bundle = cloud sync + unlimited archive + stats report + ad-free.
 * The core planner (editing, presets, export, goals, memos, weather, clocks,
 * sharing) stays 100% free. These constants are the single source of truth for
 * the free-tier limits; gates read them so the numbers never drift.
 */
export const FREE_SLOT_LIMIT = 3; // saved-schedule slots on the free plan (Pro: unlimited)
export const FREE_DIARY_DAYS = 30; // diary history window on the free plan (Pro: unlimited)

/** Fired to ask the app shell to open the Pro upgrade dialog from anywhere. */
export const OPEN_UPGRADE_EVENT = '24h:open-upgrade';

/** Ask the app to show the Pro paywall (any gated surface calls this). */
export function requestUpgrade(): void {
  try {
    window.dispatchEvent(new Event(OPEN_UPGRADE_EVENT));
  } catch {
    /* non-browser / SSR — no-op */
  }
}

/** True when a diary date is within the free history window (inclusive). */
export function isDiaryDateFree(dateKey: string, today = new Date()): boolean {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return true;
  const then = new Date(y, m - 1, d);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((start.getTime() - then.getTime()) / 86_400_000);
  // Future dates and anything within the last FREE_DIARY_DAYS are free.
  return days <= FREE_DIARY_DAYS;
}
