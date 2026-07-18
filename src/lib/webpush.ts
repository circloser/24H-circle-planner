/**
 * Web Push sender primitives — RFC 8291 (aes128gcm message encryption) and
 * RFC 8292 (VAPID) on bare WebCrypto, so the same module runs in the
 * Cloudflare Worker (the minute cron sender) and in tests.
 *
 * Correctness is pinned by src/lib/__tests__/webpush.test.ts against the
 * OFFICIAL RFC 8291 Appendix A test vector (fixed sender key + salt must
 * reproduce the RFC's exact ciphertext byte-for-byte). Do not "simplify" the
 * HKDF info strings or header layout — every byte is load-bearing.
 */

// ─── base64url ────────────────────────────────────────────────────────────────

export function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function bytesToB64url(b: Uint8Array | ArrayBuffer): string {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let bin = '';
  for (const x of u) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const te = new TextEncoder();

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource }, key, len * 8);
  return new Uint8Array(bits);
}

// ─── RFC 8291 payload encryption (aes128gcm, single record) ──────────────────

export interface PushSubscriptionKeys {
  /** Push-service delivery URL. */
  endpoint: string;
  /** Client ECDH public key, b64url (65-byte uncompressed P-256 point). */
  p256dh: string;
  /** Client 16-byte auth secret, b64url. */
  auth: string;
}

/** Test hook: fix the ephemeral sender keypair + salt to reproduce vectors. */
export interface EncryptOverrides {
  asPrivateKey?: CryptoKey;
  asPublicRaw?: Uint8Array;
  salt?: Uint8Array;
}

export async function encryptPushPayload(
  sub: PushSubscriptionKeys,
  plaintext: string,
  overrides: EncryptOverrides = {},
): Promise<Uint8Array> {
  const uaPub = b64urlToBytes(sub.p256dh);
  const authSecret = b64urlToBytes(sub.auth);

  let asPriv = overrides.asPrivateKey;
  let asPubRaw = overrides.asPublicRaw;
  if (!asPriv || !asPubRaw) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    asPriv = pair.privateKey;
    asPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  }

  const uaKey = await crypto.subtle.importKey('raw', uaPub as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPriv, 256));

  // IKM = HKDF(auth_secret, ecdh, "WebPush: info" || 0x00 || ua_public || as_public, 32)
  const ikm = await hkdf(authSecret, ecdh, concat(te.encode('WebPush: info\0'), uaPub, asPubRaw), 32);
  const salt = overrides.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);

  // Single record: plaintext || 0x02 (final-record delimiter), AES-128-GCM.
  const record = concat(te.encode(plaintext), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, aesKey, record as BufferSource));

  // Header: salt(16) || rs(4, BE) || idlen(1) || keyid(=as_public, 65)
  const header = new Uint8Array(16 + 4 + 1 + asPubRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPubRaw.length;
  header.set(asPubRaw, 21);
  return concat(header, ct);
}

// ─── RFC 8292 VAPID ──────────────────────────────────────────────────────────

/** `Authorization: vapid t=<ES256 JWT>, k=<public key>` for the endpoint's origin. */
export async function vapidAuthHeader(
  endpoint: string,
  publicKeyB64url: string,
  privatePkcs8B64url: string,
  subject: string,
): Promise<string> {
  const aud = new URL(endpoint).origin;
  const enc = (o: unknown) => bytesToB64url(te.encode(JSON.stringify(o)));
  const signing = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    b64urlToBytes(privatePkcs8B64url) as BufferSource,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  // WebCrypto ECDSA emits raw r||s (64 bytes) — exactly the JWS ES256 format.
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(signing) as BufferSource);
  return `vapid t=${signing}.${bytesToB64url(sig)}, k=${publicKeyB64url}`;
}

// ─── Send ────────────────────────────────────────────────────────────────────

/** POST one encrypted notification. Returns the push service's status code
 *  (404/410 mean the subscription is dead and should be deleted). */
export async function sendWebPush(
  sub: PushSubscriptionKeys,
  payload: string,
  vapid: { publicKey: string; privateKey: string; subject: string },
): Promise<number> {
  const body = await encryptPushPayload(sub, payload);
  const auth = await vapidAuthHeader(sub.endpoint, vapid.publicKey, vapid.privateKey, vapid.subject);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      TTL: '120',
      Urgency: 'high',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      Authorization: auth,
    },
    body: body as BodyInit,
  });
  return res.status;
}
