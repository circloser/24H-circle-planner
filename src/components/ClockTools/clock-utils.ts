import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';

export interface Pos {
  x: number;
  y: number;
}

/** Current time, re-rendered every `intervalMs` while `active` (no ticking when off). */
export function useNow(active: boolean, intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    // Refresh immediately on activation (async, so it isn't a synchronous
    // setState in the effect body) — avoids a stale value for up to one tick.
    const t0 = window.setTimeout(() => setNow(new Date()), 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(t0);
    };
  }, [active, intervalMs]);
  return now;
}

/** Short rising beep sequence via Web Audio (no asset). Best-effort/silent on failure. */
export function playBeep(times = 4): void {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    let t = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.32);
      t += 0.45;
    }
    window.setTimeout(() => void ctx.close(), times * 460 + 400);
  } catch {
    // audio unavailable — silent
  }
}

export const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Seconds → "MM:SS" (or "HH:MM:SS" when ≥ 1 hour). */
export function formatHMS(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(sec)}` : `${pad2(m)}:${pad2(sec)}`;
}

/**
 * Pointer-capture drag starter for a floating panel header. Updates position via
 * `onChange`. Skips elements marked `[data-no-drag]` so header controls still work.
 * Mirrors the memo-note drag so behaviour is consistent across the app.
 */
export function makeDragStart(pos: Pos, onChange: (p: Pos) => void) {
  return (e: ReactPointerEvent<HTMLElement>) => {
    if ((e.target as Element).closest('[data-no-drag]')) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = pos.x;
    const origY = pos.y;
    const onMove = (ev: PointerEvent) => {
      onChange({
        x: Math.max(0, origX + (ev.clientX - startX)),
        y: Math.max(0, origY + (ev.clientY - startY)),
      });
    };
    const onUp = () => {
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  };
}
