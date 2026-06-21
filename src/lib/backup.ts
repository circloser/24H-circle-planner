/**
 * Full-data backup: dump/restore every piece of app state the app keeps in
 * localStorage (schedule, days, memos, slots, preferences, user presets, theme).
 *
 * This is the client-only safety net against data loss — a user can save a
 * backup file and restore it on the same or a different device/browser, since
 * the app has no server. All app keys share the "24h-circle-planner." prefix.
 */

export const APP_STORAGE_PREFIX = '24h-circle-planner.';

interface BackupEnvelope {
  app: '24h-circle-planner';
  version: 1;
  exportedAt: string; // ISO8601
  data: Record<string, string>; // localStorage key → raw string value
}

/** Collect all app localStorage entries into a downloadable JSON Blob. */
export function exportAllData(): Blob {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(APP_STORAGE_PREFIX)) {
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    }
  }
  const envelope: BackupEnvelope = {
    app: '24h-circle-planner',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
  return new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
}

/**
 * Restore from a backup file: overwrites every app key with the file's contents.
 * Resolves to the number of keys written. Throws on an invalid file. The caller
 * is expected to reload the page afterwards so all providers re-read storage.
 */
export async function importAllData(file: File): Promise<number> {
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as BackupEnvelope).app !== '24h-circle-planner' ||
    typeof (parsed as BackupEnvelope).data !== 'object' ||
    (parsed as BackupEnvelope).data === null
  ) {
    throw new Error('Not a valid 24h backup file');
  }
  const data = (parsed as BackupEnvelope).data;
  // Clear existing app keys first so removed entries don't linger.
  const existing: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(APP_STORAGE_PREFIX)) existing.push(key);
  }
  existing.forEach((k) => localStorage.removeItem(k));

  let written = 0;
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith(APP_STORAGE_PREFIX) && typeof value === 'string') {
      localStorage.setItem(key, value);
      written++;
    }
  }
  return written;
}
