/**
 * End-to-end encryption for Pro cloud sync (opt-in).
 *
 * When enabled, the sync payload (`data` map) is encrypted in the browser with
 * AES-256-GCM before it ever leaves the device. The server (and its operator)
 * stores only ciphertext — the v2 envelope carries {salt, iv, ct, check}, all
 * base64, plus a cleartext `modifiedAt` used purely for last-write-wins.
 *
 * Key = PBKDF2(passphrase, per-user salt). The passphrase is NEVER stored or
 * sent; only the DERIVED key is cached on this device (localStorage, never in
 * SYNC_KEYS so it never syncs) so returning visits unlock automatically. That
 * cache weakens nothing against the SERVER operator (the threat this feature
 * targets) — it is the same local-device exposure the plaintext store already
 * had and the privacy policy already discloses.
 *
 * IMPORTANT: there is no recovery. Lose the passphrase → the cloud copy is
 * unreadable by anyone, including the operator. Callers MUST warn before enable.
 */

const PBKDF2_ITERATIONS = 310_000;
const CHECK_PLAINTEXT = '24houring-e2ee-v1'; // encrypted into `check` to validate a passphrase
const LOCAL_KEY = '24h-circle-planner.e2ee-key'; // device-local cache: { keyB64, saltB64 } — NEVER synced

const enc = new TextEncoder();
const dec = new TextDecoder();

// ─── base64 <-> bytes ──────────────────────────────────────────────────────────

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

// ─── key derivation ─────────────────────────────────────────────────────────────

/** Derive the AES-GCM key from a passphrase + salt (PBKDF2-HMAC-SHA256). */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    true, // extractable → so we can cache it on this device
    ['encrypt', 'decrypt'],
  );
}

/** A fresh random salt for a first-time enable. */
export function newSalt(): Uint8Array {
  return randomBytes(16);
}

// ─── encrypt / decrypt ───────────────────────────────────────────────────────────

/** The encrypted portion of a v2 envelope (all fields base64). */
export interface EncBlock {
  salt: string;
  iv: string;
  ct: string; // AES-GCM ciphertext of JSON.stringify(data)
  check: string; // iv+ct of CHECK_PLAINTEXT — validates a candidate passphrase
}

async function encryptBytes(key: CryptoKey, plaintext: Uint8Array): Promise<{ iv: string; ct: string }> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext as BufferSource);
  return { iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) };
}

async function decryptBytes(key: CryptoKey, ivB64: string, ctB64: string): Promise<Uint8Array> {
  const iv = b64ToBytes(ivB64);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, b64ToBytes(ctB64) as BufferSource);
  return new Uint8Array(pt);
}

/** Encrypt the sync `data` map into a v2 EncBlock. */
export async function encryptData(key: CryptoKey, salt: Uint8Array, data: Record<string, string>): Promise<EncBlock> {
  const body = await encryptBytes(key, enc.encode(JSON.stringify(data)));
  const chk = await encryptBytes(key, enc.encode(CHECK_PLAINTEXT));
  return { salt: bytesToB64(salt), iv: body.iv, ct: body.ct, check: `${chk.iv}.${chk.ct}` };
}

/** Decrypt a v2 EncBlock back into the sync `data` map (throws on wrong key). */
export async function decryptData(key: CryptoKey, block: EncBlock): Promise<Record<string, string>> {
  const bytes = await decryptBytes(key, block.iv, block.ct);
  return JSON.parse(dec.decode(bytes)) as Record<string, string>;
}

/** True when `key` can decrypt this block's `check` token (i.e. right passphrase). */
export async function verifyKey(key: CryptoKey, block: EncBlock): Promise<boolean> {
  try {
    const [iv, ct] = block.check.split('.');
    if (!iv || !ct) return false;
    return dec.decode(await decryptBytes(key, iv, ct)) === CHECK_PLAINTEXT;
  } catch {
    return false; // GCM auth-tag mismatch on a wrong key
  }
}

// ─── device-local key cache (remember-on-this-device) ─────────────────────────────

/** In-memory key for the current session (source of truth while the tab lives). */
let sessionKey: CryptoKey | null = null;
let sessionSalt: Uint8Array | null = null;

/** Fired when the E2EE lock state changes (key set or cleared) so the engine
 *  and UI can react (e.g. resume sync / close the unlock dialog). */
export const E2EE_EVENT = '24h:e2ee-changed';
/** Ask the sync engine to immediately (re-)push — used right after ENABLING so
 *  the existing cloud copy is replaced with ciphertext even though the DATA
 *  (and thus its fingerprint) is unchanged. */
export const E2EE_REPUSH_EVENT = '24h:e2ee-repush';
/** Ask the sync engine to turn E2EE OFF cloud-wide: forget the key, then push
 *  the current data as PLAINTEXT (v1) so other devices read it without a key.
 *  Engine-driven so the forget+push is ordered against the pull loop. */
export const E2EE_DISABLE_EVENT = '24h:e2ee-disable';

function emit(name = E2EE_EVENT): void {
  try {
    window.dispatchEvent(new Event(name));
  } catch {
    /* non-DOM env */
  }
}

/** Enable-time nudge: encrypt-push the current cloud copy now. */
export function requestRepush(): void {
  emit(E2EE_REPUSH_EVENT);
}
/** Turn E2EE off cloud-wide (the engine forgets the key and re-plaintexts). */
export function requestDisable(): void {
  emit(E2EE_DISABLE_EVENT);
}

/** Cache the unlocked key on this device (exported raw → base64) + in memory. */
export async function rememberKey(key: CryptoKey, salt: Uint8Array): Promise<void> {
  sessionKey = key;
  sessionSalt = salt;
  try {
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ keyB64: bytesToB64(raw), saltB64: bytesToB64(salt) }));
  } catch {
    /* storage unavailable — stays in memory only for this session */
  }
  emit();
}

/** Re-import the cached device key on startup, if present. Returns it or null. */
export async function loadCachedKey(): Promise<CryptoKey | null> {
  if (sessionKey) return sessionKey;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const { keyB64, saltB64 } = JSON.parse(raw) as { keyB64: string; saltB64: string };
    const key = await crypto.subtle.importKey('raw', b64ToBytes(keyB64) as BufferSource, 'AES-GCM', true, ['encrypt', 'decrypt']);
    sessionKey = key;
    sessionSalt = b64ToBytes(saltB64);
    return key;
  } catch {
    return null;
  }
}

/** The current session key (may be null when locked / disabled). Synchronous. */
export function currentKey(): CryptoKey | null {
  return sessionKey;
}
/** The salt paired with the current key (needed to re-encrypt on push). */
export function currentSalt(): Uint8Array | null {
  return sessionSalt;
}
/** True when E2EE has been set up on this device (a key is cached/loaded). */
export function isE2eeEnabled(): boolean {
  return sessionKey !== null || (typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_KEY) !== null);
}

/** Forget the device key (used before wiping / disabling). Does not touch the
 *  cloud. `silent` skips the E2EE_EVENT so the disable path can control the
 *  forget→plaintext-push ordering itself (see the engine's onDisable). */
export function forgetKey(silent = false): void {
  sessionKey = null;
  sessionSalt = null;
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
  if (!silent) emit();
}
