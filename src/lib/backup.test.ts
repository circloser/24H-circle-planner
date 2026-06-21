import { describe, it, expect, beforeEach } from 'vitest';
import { exportAllData, importAllData, resetAllData, APP_STORAGE_PREFIX } from './backup';

function fileFromBlob(blob: Blob, name = 'backup.json'): File {
  return new File([blob], name, { type: 'application/json' });
}

describe('backup export/import', () => {
  beforeEach(() => localStorage.clear());

  it('exports only app-prefixed keys', async () => {
    localStorage.setItem(`${APP_STORAGE_PREFIX}schedule`, '{"a":1}');
    localStorage.setItem(`${APP_STORAGE_PREFIX}memos`, '{"b":2}');
    localStorage.setItem('unrelated.key', 'nope');

    const blob = exportAllData();
    const parsed = JSON.parse(await blob.text());
    expect(parsed.app).toBe('24h-circle-planner');
    expect(parsed.version).toBe(1);
    expect(Object.keys(parsed.data).sort()).toEqual([
      `${APP_STORAGE_PREFIX}memos`,
      `${APP_STORAGE_PREFIX}schedule`,
    ]);
    expect(parsed.data).not.toHaveProperty('unrelated.key');
  });

  it('round-trips: export → clear → import restores values', async () => {
    localStorage.setItem(`${APP_STORAGE_PREFIX}schedule`, '{"id":"x"}');
    localStorage.setItem(`${APP_STORAGE_PREFIX}days`, '{"days":[]}');
    const blob = exportAllData();

    localStorage.clear();
    const written = await importAllData(fileFromBlob(blob));

    expect(written).toBe(2);
    expect(localStorage.getItem(`${APP_STORAGE_PREFIX}schedule`)).toBe('{"id":"x"}');
    expect(localStorage.getItem(`${APP_STORAGE_PREFIX}days`)).toBe('{"days":[]}');
  });

  it('import clears stale app keys not present in the backup', async () => {
    localStorage.setItem(`${APP_STORAGE_PREFIX}schedule`, '{"id":"x"}');
    const blob = exportAllData();
    // Add a key that is NOT in the backup; restore should remove it.
    localStorage.setItem(`${APP_STORAGE_PREFIX}memos`, '{"stale":true}');

    await importAllData(fileFromBlob(blob));
    expect(localStorage.getItem(`${APP_STORAGE_PREFIX}memos`)).toBeNull();
    expect(localStorage.getItem(`${APP_STORAGE_PREFIX}schedule`)).toBe('{"id":"x"}');
  });

  it('rejects a non-backup file', async () => {
    await expect(importAllData(fileFromBlob(new Blob(['{"foo":1}'])))).rejects.toThrow();
  });
});

describe('resetAllData', () => {
  beforeEach(() => localStorage.clear());

  it('removes every app key but leaves unrelated keys', () => {
    localStorage.setItem(`${APP_STORAGE_PREFIX}schedule`, '{"a":1}');
    localStorage.setItem(`${APP_STORAGE_PREFIX}memos`, '{"b":2}');
    localStorage.setItem('other-app.token', 'keep-me');

    const removed = resetAllData();

    expect(removed).toBe(2);
    expect(localStorage.getItem(`${APP_STORAGE_PREFIX}schedule`)).toBeNull();
    expect(localStorage.getItem(`${APP_STORAGE_PREFIX}memos`)).toBeNull();
    expect(localStorage.getItem('other-app.token')).toBe('keep-me');
  });
});
