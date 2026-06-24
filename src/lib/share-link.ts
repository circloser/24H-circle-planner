import { v4 as uuid } from 'uuid';
import type { Schedule } from '@/types/schedule';
import type { TimeSlice } from '@/types/time-slice';
import { hhmmToMinutes, minutesToHhmm, isContiguous24h } from '@/lib/time-utils';

// Share links encode a schedule entirely in the URL fragment (no backend), so a
// "today's routine" can be shared as a clickable link. Compact, dependency-free:
// each slice → [startMinute, label, color, icon]; end times are reconstructed
// from neighbours (the ring is contiguous), and ids are regenerated on import.

const PROD_ORIGIN = 'https://24houring.com';

// ─── UTF-8 ⇄ base64url (handles Korean labels + emoji) ────────────────────────

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

interface SharePayload {
  v: 1;
  n: string;
  s: Array<[number, string, string, string]>; // [startMin, label, color, icon]
}

/** Encode a schedule into a compact URL-fragment code. */
export function encodeSchedule(schedule: Schedule): string {
  const slices = [...schedule.slices].sort(
    (a, b) => hhmmToMinutes(a.startTime) - hhmmToMinutes(b.startTime),
  );
  const payload: SharePayload = {
    v: 1,
    n: schedule.name ?? '',
    s: slices.map((sl) => [
      hhmmToMinutes(sl.startTime) % 1440,
      sl.label ?? '',
      sl.color ?? '#d1d5db',
      sl.icon ?? '',
    ]),
  };
  return b64urlEncode(JSON.stringify(payload));
}

/** A full share URL pointing at the production site (works from anywhere). */
export function buildShareUrl(schedule: Schedule): string {
  return `${PROD_ORIGIN}/#p=${encodeSchedule(schedule)}`;
}

/** Decode a fragment code back into a Schedule, or null if invalid. */
export function decodeSchedule(code: string): Schedule | null {
  try {
    const p = JSON.parse(b64urlDecode(code)) as SharePayload;
    if (!p || p.v !== 1 || !Array.isArray(p.s) || p.s.length === 0) return null;
    const n = p.s.length;
    const slices: TimeSlice[] = p.s.map((row, i) => {
      const startMin = ((Number(row[0]) % 1440) + 1440) % 1440;
      // End = the next slice's start; the last wraps to the first (contiguous ring).
      const nextStart = ((Number(p.s[(i + 1) % n][0]) % 1440) + 1440) % 1440;
      return {
        id: uuid(),
        label: typeof row[1] === 'string' ? row[1] : '',
        color: typeof row[2] === 'string' && row[2] ? row[2] : '#d1d5db',
        icon: typeof row[3] === 'string' ? row[3] : '',
        textPosition: 'inside',
        startTime: minutesToHhmm(startMin),
        endTime: minutesToHhmm(nextStart),
      };
    });
    if (!isContiguous24h(slices)) return null;
    return {
      id: uuid(),
      version: 1,
      name: typeof p.n === 'string' ? p.n : '내 시간표',
      presetSource: null,
      updatedAt: new Date().toISOString(),
      slices,
    };
  } catch {
    return null;
  }
}

/** Read a shared schedule from the current URL fragment (#p=…), if any. */
export function readSharedFromHash(): Schedule | null {
  try {
    const m = /[#&]p=([^&]+)/.exec(window.location.hash);
    if (!m) return null;
    return decodeSchedule(m[1]);
  } catch {
    return null;
  }
}

/** Remove the #p=… fragment from the URL without reloading. */
export function clearShareHash(): void {
  try {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    // ignore
  }
}

/** Copy text to the clipboard with a legacy fallback. Returns success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
