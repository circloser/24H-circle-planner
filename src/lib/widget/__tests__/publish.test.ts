import { describe, it, expect, beforeEach } from 'vitest';
import {
  WIDGET_PNG_SIZE,
  WIDGET_TOKEN_KEY,
  clearWidgetToken,
  ensureWidgetToken,
  newWidgetToken,
  readWidgetToken,
  svgToPx,
  widgetHaloR,
  widgetMeta,
} from '../publish';
import { viewSpec } from '@/lib/chart-view';

describe('widget token', () => {
  beforeEach(() => localStorage.clear());

  it('generates a 22-char base62 secret that the worker accepts', () => {
    const t = newWidgetToken();
    expect(t).toMatch(/^[A-Za-z0-9]{22}$/);
    expect(newWidgetToken()).not.toBe(t);
  });

  it('is device-local: created once, reused, cleared', () => {
    expect(readWidgetToken()).toBeNull();
    const a = ensureWidgetToken();
    expect(readWidgetToken()).toBe(a);
    expect(ensureWidgetToken()).toBe(a);
    clearWidgetToken();
    expect(readWidgetToken()).toBeNull();
  });

  it('ignores a corrupt stored value', () => {
    localStorage.setItem(WIDGET_TOKEN_KEY, 'not a token!');
    expect(readWidgetToken()).toBeNull();
  });
});

describe('widgetMeta', () => {
  // The native widget draws the now-hand in IMAGE pixels; the chart works in
  // SVG units inside a -36..1036 viewBox rendered at 1080. Both ends must agree
  // on this mapping or the hand drifts off the ring.
  const ring = { cx: 500, cy: 500, innerR: 100, outerR: 460 };

  it('maps the ring centre to the image centre', () => {
    const m = widgetMeta(viewSpec('full'), '#EF4444', false, ring);
    expect(m.cx).toBeCloseTo(WIDGET_PNG_SIZE / 2, 5);
    expect(m.cy).toBeCloseTo(WIDGET_PNG_SIZE / 2, 5);
  });

  it('scales radii by the viewBox→pixel factor, not the bare 1080/1000', () => {
    const m = widgetMeta(viewSpec('full'), '#EF4444', false, ring);
    const k = WIDGET_PNG_SIZE / 1072;
    expect(m.innerR).toBeCloseTo(100 * k, 1);
    expect(m.outerR).toBeCloseTo(460 * k, 1);
    // A point on the rim at 3 o'clock lands where svgToPx says it does.
    expect(m.cx + m.outerR).toBeCloseTo(svgToPx(500 + 460), 1);
  });

  it('carries the view window so 12h views place (or hide) the hand', () => {
    const day = widgetMeta(viewSpec('day'), '#EF4444', true, ring);
    expect(day).toMatchObject({ startMin: 360, spanMin: 720, startAngleDeg: 90, dark: true, hand: '#EF4444', v: 1 });
    const full = widgetMeta(viewSpec('full'), '#000000', false, ring);
    expect(full).toMatchObject({ startMin: 0, spanMin: 1440, startAngleDeg: -90 });
  });

  it('follows the adjustable ring radii', () => {
    const small = widgetMeta(viewSpec('full'), '#EF4444', false, { ...ring, innerR: 200, outerR: 400 });
    expect(small.outerR).toBeLessThan(widgetMeta(viewSpec('full'), '#EF4444', false, ring).outerR);
    expect(small.innerR).toBeCloseTo(200 * (WIDGET_PNG_SIZE / 1072), 1);
  });

  it('halo disc covers the hour labels outside the rim and stays inside the viewBox', () => {
    // Labels sit at outerR + 32 with a 30px face → must be under outerR + 47.
    expect(widgetHaloR(ring)).toBeGreaterThanOrEqual(ring.outerR + 47);
    // Largest allowed rim (480): the disc must not clip at the viewBox edge (536 from centre).
    expect(widgetHaloR({ ...ring, outerR: 480 })).toBeLessThanOrEqual(536);
  });
});
