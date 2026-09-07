import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncProvider } from '../useSync';
import { pullRemote, pushRemote, type PushResult } from '@/lib/sync/syncClient';
import { dataFingerprint, PREFS_KEY, VIEW_KEY } from '@/lib/sync/syncData';
import { loadCachedKey } from '@/lib/sync/e2ee';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: 'test-user', plan: 'pro' }) }));
vi.mock('@/hooks/usePreferences', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
vi.mock('@/lib/sync/syncClient', () => ({ pullRemote: vi.fn(), pushRemote: vi.fn(), deviceLabel: () => 'PC' }));
vi.mock('@/lib/sync/e2ee', async (original) => ({
  ...await original<typeof import('@/lib/sync/e2ee')>(),
  loadCachedKey: vi.fn().mockResolvedValue(null),
}));

describe('merged sync uploads', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.resetAllMocks();
    vi.mocked(loadCachedKey).mockResolvedValue(null);
    localStorage.setItem('24h-circle-planner.sync-consent', '1');
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it.each(['edit', 'delete', 'conflicting edit'] as const)('preserves a local %s during upload and pushes it against the uploaded base', async (change) => {
    const base = { [PREFS_KEY]: '{"language":"en"}', [VIEW_KEY]: '{"diaryDate":"2026-09-01"}' };
    const local = { ...base, [VIEW_KEY]: '{"diaryDate":"2026-09-02"}' };
    const server = { ...base, [PREFS_KEY]: '{"language":"ko"}' };
    const uploaded = { ...local, [PREFS_KEY]: server[PREFS_KEY] };
    for (const [key, value] of Object.entries(local)) localStorage.setItem(key, value);
    localStorage.setItem('24h-circle-planner.sync-base', JSON.stringify(base));
    localStorage.setItem('24h-circle-planner.syncmeta', JSON.stringify({ version: 1, baseFp: dataFingerprint(base), modifiedAt: 1 }));
    vi.mocked(pullRemote).mockResolvedValue({ kind: 'data', envelope: { v: 1, modifiedAt: 2, data: server }, version: 2, updatedAt: 2, deviceLabel: null });
    let finish!: (result: PushResult) => void;
    vi.mocked(pushRemote).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    vi.mocked(pushRemote).mockResolvedValue({ kind: 'ok', version: 4, updatedAt: 4 });

    await act(async () => { render(<SyncProvider><span /></SyncProvider>); });
    expect(pushRemote).toHaveBeenCalledTimes(1);
    expect(vi.mocked(pushRemote).mock.calls[0][0].data).toEqual(uploaded);
    const editedKey = change === 'conflicting edit' ? PREFS_KEY : VIEW_KEY;
    const latest = change === 'conflicting edit' ? '{"language":"ja"}' : '{"diaryDate":"2026-09-03"}';
    if (change === 'delete') localStorage.removeItem(editedKey);
    else localStorage.setItem(editedKey, latest);
    await act(async () => { finish({ kind: 'ok', version: 3, updatedAt: 3 }); });

    expect(localStorage.getItem(editedKey)).toBe(change === 'delete' ? null : latest);
    expect(localStorage.getItem(PREFS_KEY)).toBe(change === 'conflicting edit' ? latest : server[PREFS_KEY]);
    expect(JSON.parse(localStorage.getItem('24h-circle-planner.sync-base')!)).toEqual(uploaded);
    await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
    expect(pushRemote).toHaveBeenCalledTimes(2);
    const [next, version] = vi.mocked(pushRemote).mock.calls[1];
    expect(version).toBe(3);
    expect(next.data[editedKey]).toBe(change === 'delete' ? undefined : latest);
    expect(next.data[PREFS_KEY]).toBe(change === 'conflicting edit' ? latest : server[PREFS_KEY]);
  });
});
