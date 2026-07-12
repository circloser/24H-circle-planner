import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';

export interface Pos {
  x: number;
  y: number;
}

/**
 * Floating widgets store ABSOLUTE top-left pixels, but rendering them literally
 * makes them cling to the top-left as the viewport grows. Instead we anchor every
 * widget to the viewport CENTRE: `layoutOrigin` is the viewport centre captured
 * ONCE (device-local, persisted) the first time this build runs, and a widget at
 * stored (x,y) renders at `calc(50vw + (x - originCx))`. At the origin size that
 * is exactly (x,y) — no jump — and as the viewport grows/shrinks or you zoom, the
 * widget keeps its distance from the centre (margins expand symmetrically), just
 * like the chart. This is purely a render/drag transform: storage and cloud sync
 * (which already send centre-relative positions) are untouched.
 */
const ORIGIN_KEY = '24h-circle-planner.layout-origin';
let originCache: { cx: number; cy: number } | null = null;
export function layoutOrigin(): { cx: number; cy: number } {
  if (originCache) return originCache;
  try {
    const raw = localStorage.getItem(ORIGIN_KEY);
    if (raw) {
      const o = JSON.parse(raw) as Partial<{ cx: number; cy: number }>;
      if (typeof o?.cx === 'number' && typeof o?.cy === 'number') {
        originCache = { cx: o.cx, cy: o.cy };
        return originCache;
      }
    }
  } catch {
    /* ignore */
  }
  const w = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1280;
  const h = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 800;
  originCache = { cx: Math.round(w / 2), cy: Math.round(h / 2) };
  try {
    localStorage.setItem(ORIGIN_KEY, JSON.stringify(originCache));
  } catch {
    /* ignore */
  }
  return originCache;
}

/** `position:fixed` left/top that anchor a widget's absolute (x,y) to the
 *  viewport centre (see layoutOrigin). Spread into a widget's style. */
export function anchoredStyle(x: number, y: number): { position: 'fixed'; left: string; top: string } {
  const { cx, cy } = layoutOrigin();
  return { position: 'fixed', left: `calc(50vw + ${x - cx}px)`, top: `calc(50vh + ${y - cy}px)` };
}

/** Lower bound for a stored abs coordinate so the widget's top-left stays on
 *  screen once the centre-anchor offset is applied. */
export function dragFloor(): { minX: number; minY: number } {
  const { cx, cy } = layoutOrigin();
  const w = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1280;
  const h = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 800;
  return { minX: cx - w / 2 + 4, minY: cy - h / 2 + 4 };
}

const vw = () => (typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1280);
const vh = () => (typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 800);

/** Convert a DESIRED position in the current viewport to the value we must STORE
 *  so anchoredStyle renders it exactly there on this viewport (inverse of the
 *  anchor offset). */
export function toStored(x: number, y: number): Pos {
  const { cx, cy } = layoutOrigin();
  return { x: Math.round(x - vw() / 2 + cx), y: Math.round(y - vh() / 2 + cy) };
}

/** A spawn position NEAR the centred chart: (dx,dy) offset from the current
 *  viewport centre, clamped so the whole widget (w×h) stays on screen, then
 *  mapped into stored (anchor) space. New widgets therefore always appear next
 *  to the chart — overlapping is fine, the user can drag them out — and never
 *  off-screen, on any viewport size. */
export function spawnNearCentre(dx: number, dy: number, w = 180, h = 180): Pos {
  const x = Math.min(Math.max(8, vw() / 2 + dx), Math.max(8, vw() - w - 8));
  const y = Math.min(Math.max(72, vh() / 2 + dy), Math.max(72, vh() - h - 8));
  return toStored(x, y);
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
    const { minX, minY } = dragFloor();
    const onMove = (ev: PointerEvent) => {
      onChange({
        x: Math.max(minX, origX + (ev.clientX - startX)),
        y: Math.max(minY, origY + (ev.clientY - startY)),
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
