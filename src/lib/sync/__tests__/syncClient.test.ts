import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pushRemote } from '../syncClient';
import { currentKey, currentSalt, encryptData } from '../e2ee';
import type { SyncEnvelope } from '../syncData';

vi.mock('../e2ee', () => ({ currentKey: vi.fn(), currentSalt: vi.fn(), encryptData: vi.fn(), decryptData: vi.fn() }));

describe('pushRemote failures', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns an error without sending plaintext when encryption fails', async () => {
    vi.mocked(currentKey).mockReturnValue({} as CryptoKey);
    vi.mocked(currentSalt).mockReturnValue(new Uint8Array(16));
    vi.mocked(encryptData).mockRejectedValue(new Error('encryption unavailable'));
    await expect(pushRemote({ v: 1, modifiedAt: 1, data: {} }, 0, 'PC')).resolves.toEqual({ kind: 'error' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns an error when the envelope cannot be serialized', async () => {
    const envelope: SyncEnvelope = { v: 1, modifiedAt: 1, data: {} };
    Object.defineProperty(envelope, 'data', { get() { throw new Error('serialization failed'); } });
    await expect(pushRemote(envelope, 0, 'PC')).resolves.toEqual({ kind: 'error' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('still reports network failures as offline', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('network unavailable'));
    await expect(pushRemote({ v: 1, modifiedAt: 1, data: {} }, 0, 'PC')).resolves.toEqual({ kind: 'offline' });
  });
});
