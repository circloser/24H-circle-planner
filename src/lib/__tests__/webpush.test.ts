import { describe, it, expect } from 'vitest';
import { encryptPushPayload, vapidAuthHeader, b64urlToBytes, bytesToB64url } from '../webpush';

// ─── RFC 8291 Appendix A official test vector ────────────────────────────────
const PT = 'When I grow up, I want to be a watermelon';
const UA_PUB = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
const AUTH = 'BTBZMqHH6r4Tts7J_aSIgg';
const AS_PRIV_D = 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw';
const AS_PUB = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
const SALT = 'DGv6ra1nlYgDCS1FRnbzlw';
const EXPECTED =
  'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml' +
  'mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT' +
  'pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';

describe('RFC 8291 aes128gcm encryption', () => {
  it('reproduces the official Appendix A ciphertext byte-for-byte', async () => {
    const asPubRaw = b64urlToBytes(AS_PUB);
    const jwk = {
      kty: 'EC',
      crv: 'P-256',
      d: AS_PRIV_D,
      x: bytesToB64url(asPubRaw.slice(1, 33)),
      y: bytesToB64url(asPubRaw.slice(33, 65)),
      ext: true,
    };
    const asPrivateKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const out = await encryptPushPayload(
      { endpoint: 'https://push.example.net/send', p256dh: UA_PUB, auth: AUTH },
      PT,
      { asPrivateKey, asPublicRaw: asPubRaw, salt: b64urlToBytes(SALT) },
    );
    expect(bytesToB64url(out)).toBe(EXPECTED);
  });

  it('random-key output has the right structure (header + tagged record)', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const p256dh = bytesToB64url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
    const auth = bytesToB64url(crypto.getRandomValues(new Uint8Array(16)));
    const out = await encryptPushPayload({ endpoint: 'https://x', p256dh, auth }, 'hi');
    // 16 salt + 4 rs + 1 idlen + 65 key + (2 plaintext + 1 delim + 16 tag)
    expect(out.length).toBe(16 + 4 + 1 + 65 + 2 + 1 + 16);
    expect(out[20]).toBe(65); // idlen
    expect(new DataView(out.buffer).getUint32(16)).toBe(4096); // rs
  });
});

describe('RFC 8292 VAPID', () => {
  it('produces an ES256 JWT that verifies against the public key, scoped to the endpoint origin', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const pub = bytesToB64url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
    const priv = bytesToB64url(new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey)));
    const header = await vapidAuthHeader('https://fcm.googleapis.com/fcm/send/abc123', pub, priv, 'mailto:test@example.com');

    const m = header.match(/^vapid t=([^,]+), k=(.+)$/);
    expect(m).not.toBeNull();
    const [h, p, s] = m![1].split('.');
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
    expect(JSON.parse(new TextDecoder().decode(b64urlToBytes(h)))).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(payload.aud).toBe('https://fcm.googleapis.com');
    expect(payload.sub).toBe('mailto:test@example.com');
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000);

    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.publicKey,
      b64urlToBytes(s) as BufferSource,
      new TextEncoder().encode(`${h}.${p}`) as BufferSource,
    );
    expect(ok).toBe(true);
    expect(m![2]).toBe(pub);
  });
});
