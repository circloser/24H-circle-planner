import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';

export interface Pos {
  x: number;
  y: number;
}

/**
 * ONE coordinate space for every floating widget: a stored `Pos` is the offset
 * of the widget's top-left FROM THE VIEWPORT CENTRE — the circular chart's
 * anchor. Rendering is `calc(50vw + x)`, dragging/spawning store back the same
 * offset, and cloud sync ships the offset UNTRANSFORMED. Because storage, render
 * and the sync wire all share this space, a value survives any number of
 * push/pull/apply cycles byte-identically (no drift) and lands at the same spot
 * relative to the chart on every device and window size.
 *
 * Legacy values (absolute top-left pixels, in the space of the once-persisted
 * "layout origin") are migrated on load via migrateLegacyPos — the same visual
 * spot expressed as a centre offset.
 */
const ORIGIN_KEY = '24h-circle-planner.layout-origin';

const vw = () => (typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1280);
const vh = () => (typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 800);

/** The centre legacy ABSOLUTE positions were anchored to: the persisted layout
 *  origin if one exists (pre-offset builds wrote it), else the live centre. */
function legacyOrigin(): { cx: number; cy: number } {
  try {
    const raw = localStorage.getItem(ORIGIN_KEY);
    if (raw) {
      const o = JSON.parse(raw) as Partial<{ cx: number; cy: number }>;
      if (typeof o?.cx === 'number' && typeof o?.cy === 'number') return { cx: o.cx, cy: o.cy };
    }
  } catch {
    /* ignore */
  }
  return { cx: Math.round(vw() / 2), cy: Math.round(vh() / 2) };
}

/** Legacy absolute top-left pixels → centre offset (same rendered spot). */
export function migrateLegacyPos(p: Pos): Pos {
  const { cx, cy } = legacyOrigin();
  return { x: Math.round(p.x - cx), y: Math.round(p.y - cy) };
}

/** `position:fixed` left/top for a centre-offset position. */
export function anchoredStyle(x: number, y: number): { position: 'fixed'; left: string; top: string } {
  return { position: 'fixed', left: `calc(50vw + ${x}px)`, top: `calc(50vh + ${y}px)` };
}

/** Lower bound (offset space) keeping the widget's top-left on screen. */
export function dragFloor(): { minX: number; minY: number } {
  return { minX: 4 - vw() / 2, minY: 4 - vh() / 2 };
}

/** Convert a DESIRED position in the current viewport to the stored offset. */
export function toStored(x: number, y: number): Pos {
  return { x: Math.round(x - vw() / 2), y: Math.round(y - vh() / 2) };
}

/**
 * Clamp a centre-offset so a grabbable part of the widget (its top-left corner,
 * with ≥60px of body) stays inside the CURRENT viewport. Applied on every load,
 * this guarantees no widget can ever render unreachable — whatever historical,
 * corrupted, or other-device value storage holds (e.g. drift-era cloud values
 * that were double-migrated made the goals card invisible AND undraggable).
 * In-range values pass through unchanged, so load→save stays byte-stable and
 * sync never sees a phantom diff; out-of-range values change ONCE and converge
 * via the tie-prefers-local push.
 */
export function clampOffset(p: Pos, w = 200, h = 160): Pos {
  const minX = 8 - vw() / 2;
  const maxX = vw() / 2 - Math.min(w, 60);
  const minY = 8 - vh() / 2;
  const maxY = vh() / 2 - Math.min(h, 60);
  return {
    x: Math.round(Math.min(Math.max(p.x, minX), maxX)),
    y: Math.round(Math.min(Math.max(p.y, minY), maxY)),
  };
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
