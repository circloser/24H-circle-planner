import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hasSyncConsent, grantSyncConsent, SYNC_CONSENT_EVENT } from '../consent';
import { SYNC_KEYS } from '../syncData';

const CONSENT_KEY = '24h-circle-planner.sync-consent';
const E2EE_KEY = '24h-circle-planner.e2ee-key';

describe('sync consent — nothing uploads unannounced', () => {
  beforeEach(() => localStorage.clear());

  it('starts unanswered, so the engine holds its first push', () => {
    expect(hasSyncConsent()).toBe(false);
  });

  it('is answered once the user chooses (either way)', () => {
    grantSyncConsent();
    expect(hasSyncConsent()).toBe(true);
    expect(localStorage.getItem(CONSENT_KEY)).toBe('1');
  });

  it('announces the answer so the engine can release the held push', () => {
    const seen = vi.fn();
    window.addEventListener(SYNC_CONSENT_EVENT, seen);
    grantSyncConsent();
    window.removeEventListener(SYNC_CONSENT_EVENT, seen);
    expect(seen).toHaveBeenCalledOnce();
  });

  it('a passphrase already set counts as answered — that IS the stronger choice', () => {
    localStorage.setItem(E2EE_KEY, JSON.stringify({ keyB64: 'x', saltB64: 'y' }));
    expect(hasSyncConsent()).toBe(true);
  });

  it('never travels to other devices — each device answers for its own upload', () => {
    expect(SYNC_KEYS).not.toContain(CONSENT_KEY);
  });
});
