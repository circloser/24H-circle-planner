import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pullRemote, pushRemote } from '../syncClient';
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

describe('a server whose database is not answering', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  const busy = () => new Response(JSON.stringify({ error: 'server_busy', retryAfter: 3600 }), { status: 503 });

  it('is reported as busy, not as a sync error', async () => {
    vi.mocked(fetch).mockResolvedValue(busy());
    await expect(pullRemote()).resolves.toEqual({ kind: 'busy' });
    vi.mocked(fetch).mockResolvedValue(busy());
    await expect(pushRemote({ v: 1, modifiedAt: 1, data: {} }, 0, 'PC')).resolves.toEqual({ kind: 'busy' });
  });

  it('while any other failure is still an error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('boom', { status: 500 }));
    await expect(pullRemote()).resolves.toEqual({ kind: 'error' });
  });
});
