import { describe, it, expect } from 'vitest';
import { deriveKey, newSalt, encryptData, decryptData, verifyKey, type EncBlock } from '../e2ee';
import { parseWire } from '../syncData';

const K = (s: string) => `24h-circle-planner.${s}`;
const sample = () => ({ [K('days')]: '{"activeId":"d1"}', [K('diary')]: '{"version":1,"entries":{"2026-07-01":{"note":"비밀 일기"}}}' });

describe('e2ee crypto', () => {
  it('round-trips the data map (encrypt → decrypt) with the same passphrase', async () => {
    const salt = newSalt();
    const key = await deriveKey('correct horse battery staple', salt);
    const data = sample();
    const block = await encryptData(key, salt, data);
    expect(await decryptData(key, block)).toEqual(data);
  });

  it('ciphertext contains no plaintext (the note does not leak)', async () => {
    const salt = newSalt();
    const key = await deriveKey('pw-123456', salt);
    const block = await encryptData(key, salt, sample());
    const wire = JSON.stringify({ v: 2, modifiedAt: 1, enc: block });
    expect(wire).not.toContain('비밀 일기');
    expect(wire).not.toContain('activeId');
    expect(wire).not.toContain('entries');
  });

  it('a WRONG passphrase fails to decrypt and fails verifyKey', async () => {
    const salt = newSalt();
    const right = await deriveKey('right-passphrase', salt);
    const block = await encryptData(right, salt, sample());

    const wrong = await deriveKey('wrong-passphrase', salt); // same salt, different pw
    expect(await verifyKey(wrong, block)).toBe(false);
    await expect(decryptData(wrong, block)).rejects.toThrow();

    expect(await verifyKey(right, block)).toBe(true); // the right key still works
  });

  it('the same passphrase+salt derives an equivalent key on another "device"', async () => {
    const salt = newSalt();
    const keyA = await deriveKey('shared-pass-word', salt);
    const block = await encryptData(keyA, salt, sample());
    // Device B: re-derive from the salt carried in the block.
    const saltB = Uint8Array.from(atob(block.salt), (c) => c.charCodeAt(0));
    const keyB = await deriveKey('shared-pass-word', saltB);
    expect(await decryptData(keyB, block)).toEqual(sample());
  });

  it('each encryption uses a fresh IV (nonce reuse would be catastrophic for GCM)', async () => {
    const salt = newSalt();
    const key = await deriveKey('pw', salt);
    const b1 = await encryptData(key, salt, sample());
    const b2 = await encryptData(key, salt, sample());
    expect(b1.iv).not.toBe(b2.iv);
    expect(b1.ct).not.toBe(b2.ct);
  });
});

describe('wire envelope classification', () => {
  it('classifies a v2 envelope as encrypted', () => {
    const enc: EncBlock = { salt: 'cw==', iv: 'aXY=', ct: 'Y3Q=', check: 'aXY=.Y2s=' };
    const wire = parseWire(JSON.stringify({ v: 2, modifiedAt: 5, enc }));
    expect(wire?.kind).toBe('enc');
    if (wire?.kind === 'enc') { expect(wire.modifiedAt).toBe(5); expect(wire.enc.ct).toBe('Y3Q='); }
  });

  it('classifies a v1 envelope as plaintext', () => {
    const wire = parseWire(JSON.stringify({ v: 1, modifiedAt: 9, data: { [K('days')]: 'x' } }));
    expect(wire?.kind).toBe('plain');
    if (wire?.kind === 'plain') expect(wire.envelope.data[K('days')]).toBe('x');
  });

  it('rejects a v2 envelope missing required enc fields', () => {
    expect(parseWire(JSON.stringify({ v: 2, modifiedAt: 1, enc: { salt: 'x' } }))).toBeNull();
    expect(parseWire('not json')).toBeNull();
  });
});
