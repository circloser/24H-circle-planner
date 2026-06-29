/**
 * Pro cross-device sync — Worker transport (design §4-2).
 * Thin wrappers over GET/PUT /api/sync that return discriminated results so the
 * engine can branch without try/catch noise. Never throw.
 */
import { parseEnvelope, type SyncEnvelope } from './syncData';

export type PullResult =
  | { kind: 'empty' }
  | { kind: 'data'; envelope: SyncEnvelope; version: number; updatedAt: number; deviceLabel: string | null }
  | { kind: 'unauth' }
  | { kind: 'offline' }
  | { kind: 'error' };

export type PushResult =
  | { kind: 'ok'; version: number; updatedAt: number }
  | { kind: 'conflict'; envelope: SyncEnvelope; version: number; updatedAt: number; deviceLabel: string | null }
  | { kind: 'unauth' }
  | { kind: 'offline' }
  | { kind: 'error' };

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
    const envelope = parseEnvelope(body.blob);
    if (!envelope) return { kind: 'error' };
    return { kind: 'data', envelope, version: body.version, updatedAt: body.updatedAt, deviceLabel: body.deviceLabel };
  } catch {
    return { kind: 'error' };
  }
}

export async function pushRemote(envelope: SyncEnvelope, baseVersion: number, deviceLabel: string): Promise<PushResult> {
  if (offline()) return { kind: 'offline' };
  let res: Response;
  try {
    res = await fetch('/api/sync', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ blob: JSON.stringify(envelope), baseVersion, deviceLabel }),
    });
  } catch {
    return { kind: 'offline' };
  }
  if (res.status === 401) return { kind: 'unauth' };
  if (res.status === 409) {
    try {
      const body = (await res.json()) as { blob: string; version: number; updatedAt: number; deviceLabel: string | null };
      const envelope2 = parseEnvelope(body.blob);
      if (!envelope2) return { kind: 'error' };
      return { kind: 'conflict', envelope: envelope2, version: body.version, updatedAt: body.updatedAt, deviceLabel: body.deviceLabel };
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

/** A short human label for the writing device (conflict UX). */
export function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'device';
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'Mobile';
  return 'PC';
}
