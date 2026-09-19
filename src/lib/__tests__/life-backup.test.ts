import { beforeEach, describe, expect, it } from 'vitest';
import { BACKUP_WARN_MOMENTS, dismissBackupBanner, markLifeBackup, needsBackupWarning } from '../life-backup';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 20);

describe('the life backup banner', () => {
  beforeEach(() => localStorage.clear());

  it('waits for a record worth losing', () => {
    expect(needsBackupWarning({ moments: BACKUP_WARN_MOMENTS - 1, syncing: false, now: NOW })).toBe(false);
    expect(needsBackupWarning({ moments: BACKUP_WARN_MOMENTS, syncing: false, now: NOW })).toBe(true);
  });

  it('stays away while Pro sync is on', () => {
    expect(needsBackupWarning({ moments: 50, syncing: true, now: NOW })).toBe(false);
  });

  it('is quiet for 30 days after a backup, or after being closed', () => {
    markLifeBackup(NOW - 29 * DAY);
    expect(needsBackupWarning({ moments: 50, syncing: false, now: NOW })).toBe(false);
    markLifeBackup(NOW - 31 * DAY);
    expect(needsBackupWarning({ moments: 50, syncing: false, now: NOW })).toBe(true);
    dismissBackupBanner(NOW - DAY);
    expect(needsBackupWarning({ moments: 50, syncing: false, now: NOW })).toBe(false);
  });
});
