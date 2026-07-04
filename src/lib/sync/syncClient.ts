/**
 * Pro cross-device sync — Worker transport (design §4-2).
 * Thin wrappers over GET/PUT /api/sync that return discriminated results so the
 * engine can branch without try/catch noise. Never throw.
 */
import { parseWire, type SyncEnvelope, type EncryptedEnvelope } from './syncData';
import { currentKey, currentSalt, decryptData, encryptData, type EncBlock } from './e2ee';

export type PullResult =
  | { kind: 'empty' }
  | { kind: 'data'; envelope: SyncEnvelope; version: number; updatedAt: number; deviceLabel: string | null }
  // The cloud copy is E2EE ciphertext and this device has no (matching) key yet.
  | { kind: 'locked' }
  | { kind: 'unauth' }
  | { kind: 'offline' }
  | { kind: 'error' };

export type PushResult =
  | { kind: 'ok'; version: number; updatedAt: number }
  | { kind: 'conflict'; envelope: SyncEnvelope; version: number; updatedAt: number; deviceLabel: string | null }
  | { kind: 'locked' }
  | { kind: 'unauth' }
  | { kind: 'offline' }
  | { kind: 'error' };

/** Decrypt a v2 EncBlock with the session key, or null when locked / wrong key. */
async function decryptBlock(enc: EncBlock, modifiedAt: number): Promise<SyncEnvelope | null> {
  const key = currentKey();
  if (!key) return null;
  try {
    return { v: 1, modifiedAt, data: await decryptData(key, enc) };
  } catch {
    return null; // wrong key / corrupt ciphertext → treat as locked
  }
}

/** Serialize an engine envelope for the wire: encrypted (v2) when E2EE is set up
 *  on this device, else plaintext (v1). Returns null when E2EE is on but no key. */
async function toWireBlob(env: SyncEnvelope): Promise<string | null> {
  const key = currentKey();
  const salt = currentSalt();
  if (key && salt) {
    const enc = await encryptData(key, salt, env.data);
    const wire: EncryptedEnvelope = { v: 2, modifiedAt: env.modifiedAt, enc };
    return JSON.stringify(wire);
  }
  return JSON.stringify(env); // plaintext v1
}

function offline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export async function pullRemote(): Promise<PullResult> {
  if (offline()) return { kind: 'offline' };
  let res: Response;
  try {
    res = await fetch('/api/sync', { credentials: 'include', headers: { accept: 'application/json' } });
  } catch {
    return { kind: 'offline' };
  }
  if (res.status === 204) return { kind: 'empty' };
  if (res.status === 401) return { kind: 'unauth' };
  if (!res.ok) return { kind: 'error' };
  try {
    const body = (await res.json()) as { blob: string; version: number; updatedAt: number; deviceLabel: string | null };
    const wire = parseWire(body.blob);
    if (!wire) return { kind: 'error' };
    if (wire.kind === 'enc') {
      const envelope = await decryptBlock(wire.enc, wire.modifiedAt);
      if (!envelope) return { kind: 'locked' }; // E2EE ciphertext, no matching key here
      return { kind: 'data', envelope, version: body.version, updatedAt: body.updatedAt, deviceLabel: body.deviceLabel };
    }
    return { kind: 'data', envelope: wire.envelope, version: body.version, updatedAt: body.updatedAt, deviceLabel: body.deviceLabel };
  } catch {
    return { kind: 'error' };
  }
}

export async function pushRemote(envelope: SyncEnvelope, baseVersion: number, deviceLabel: string): Promise<PushResult> {
  if (offline()) return { kind: 'offline' };
  const blob = await toWireBlob(envelope);
  if (blob === null) return { kind: 'locked' }; // shouldn't happen — engine pauses when locked
  let res: Response;
  try {
    res = await fetch('/api/sync', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ blob, baseVersion, deviceLabel }),
    });
  } catch {
    return { kind: 'offline' };
  }
  if (res.status === 401) return { kind: 'unauth' };
  if (res.status === 409) {
    try {
      const body = (await res.json()) as { blob: string; version: number; updatedAt: number; deviceLabel: string | null };
      const wire = parseWire(body.blob);
      if (!wire) return { kind: 'error' };
      if (wire.kind === 'enc') {
        const env2 = await decryptBlock(wire.enc, wire.modifiedAt);
        if (!env2) return { kind: 'locked' };
        return { kind: 'conflict', envelope: env2, version: body.version, updatedAt: body.updatedAt, deviceLabel: body.deviceLabel };
      }
      return { kind: 'conflict', envelope: wire.envelope, version: body.version, updatedAt: body.updatedAt, deviceLabel: body.deviceLabel };
    } catch {
      return { kind: 'error' };
    }
  }
  if (!res.ok) return { kind: 'error' };
  try {
    const body = (await res.json()) as { version: number; updatedAt: number };
    return { kind: 'ok', version: body.version, updatedAt: body.updatedAt };
  } catch {
    return { kind: 'error' };
  }
}

/** Fetch the current cloud copy's EncBlock (salt + check) so the unlock dialog
 *  can derive + verify a passphrase. Returns null when the cloud is empty or
 *  plaintext (nothing to unlock). Never throws. */
export async function fetchEncBlock(): Promise<EncBlock | null> {
  if (offline()) return null;
  try {
    const res = await fetch('/api/sync', { credentials: 'include', headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const body = (await res.json()) as { blob: string };
    const wire = parseWire(body.blob);
    return wire && wire.kind === 'enc' ? wire.enc : null;
  } catch {
    return null;
  }
}

/** A short human label for the writing device (conflict UX). */
export function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'device';
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'Mobile';
  return 'PC';
}
