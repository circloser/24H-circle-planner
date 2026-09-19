/**
 * The life page warns harder than the rest of the app about backups: a life
 * record is written over years and lives only in this browser unless it is
 * backed up or synced. These two device-local stamps (never synced, never in a
 * backup) decide when the banner shows.
 */
import { downloadBlob } from './share';
import { track } from './track';
import { loadPhoto } from './calendar-photos';
import { todayKey } from './calendar-grid';
import { lifeFile, photoIds, type LifeData } from './life';

const BACKUP_AT = '24h-life-backup-at';
const BANNER_OFF = '24h-life-banner-off';
const DAY = 86_400_000;

/** Moments on the line before the banner starts asking. */
export const BACKUP_WARN_MOMENTS = 10;
/** How recent a backup (or a dismissal) quiets the banner. */
export const BACKUP_WARN_DAYS = 30;

const read = (key: string): number | null => {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
};
const write = (key: string, now: number) => {
  try { localStorage.setItem(key, String(now)); } catch { /* storage unavailable */ }
};

/** A JSON backup was just saved: the life file, or a whole-app backup
 *  (Export → full backup, the save indicator's emergency backup). */
export const markLifeBackup = (now = Date.now()) => write(BACKUP_AT, now);
export const dismissBackupBanner = (now = Date.now()) => write(BANNER_OFF, now);

export function needsBackupWarning(o: { moments: number; syncing: boolean; now?: number; lastBackup?: number | null; dismissedAt?: number | null }): boolean {
  const now = o.now ?? Date.now();
  const lastBackup = o.lastBackup === undefined ? read(BACKUP_AT) : o.lastBackup;
  const dismissedAt = o.dismissedAt === undefined ? read(BANNER_OFF) : o.dismissedAt;
  const recent = (t: number | null) => t !== null && now - t < BACKUP_WARN_DAYS * DAY;
  return o.moments >= BACKUP_WARN_MOMENTS && !o.syncing && !recent(lastBackup) && !recent(dismissedAt);
}

/** The JSON backup, photos included, saved as a file — and remembered, so
 *  the banner rests for a while. */
export async function downloadLifeBackup(life: LifeData): Promise<void> {
  const photos: Record<string, string> = {};
  await Promise.all(photoIds(life).map(async (id) => {
    const url = await loadPhoto(id);
    if (url) photos[id] = url;
  }));
  const blob = new Blob([JSON.stringify(lifeFile(life, photos), null, 2)], { type: 'application/json' });
  downloadBlob(blob, `24houring-life-${todayKey()}.json`);
  markLifeBackup();
  track('life_backup', { kind: 'json' });
}
