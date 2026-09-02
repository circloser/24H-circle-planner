import { isE2eeEnabled } from './e2ee';

/**
 * The privacy step that must be passed before this account's data is uploaded
 * for the first time.
 *
 * Cloud sync is what turns a device-only diary into something that also lives
 * on our server, so the user is told exactly that BEFORE the first upload and
 * chooses: set a passphrase (the server then only ever sees ciphertext — see
 * e2ee.ts) or sync in plaintext knowingly. The engine holds its first push
 * until one of the two is chosen, so nothing goes up unannounced.
 *
 * Device-local ON PURPOSE (never in SYNC_KEYS): the choice is about what THIS
 * device is about to upload, and a synced flag would silently pre-answer the
 * question on a device that has not been through it.
 */

const KEY = '24h-circle-planner.sync-consent';

/** Fired once the user has answered — the engine resumes and pushes. */
export const SYNC_CONSENT_EVENT = '24h:sync-consent';

/** Has this device passed the privacy step? Setting a passphrase counts: the
 *  E2EE dialog is the stronger half of the same decision. */
export function hasSyncConsent(): boolean {
  try {
    if (localStorage.getItem(KEY) === '1') return true;
  } catch {
    // storage unavailable — fall through to the E2EE check, then treat as
    // answered so a private-mode visitor is never stuck with sync paused.
    return true;
  }
  return isE2eeEnabled();
}

/** Record the answer (either choice) and let the engine proceed. */
export function grantSyncConsent(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* storage unavailable — the event still unblocks this session */
  }
  try {
    window.dispatchEvent(new Event(SYNC_CONSENT_EVENT));
  } catch {
    /* non-browser */
  }
}
