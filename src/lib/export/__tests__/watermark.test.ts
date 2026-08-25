import { describe, it, expect } from 'vitest';
import { addWatermark, addShareQr, WATERMARK_TEXT, APP_URL } from '../watermark';

const SVG_NS = 'http://www.w3.org/2000/svg';
const newSvg = () => document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;

describe('addWatermark', () => {
  it('stamps the brand wordmark once', () => {
    const svg = newSvg();
    addWatermark(svg);
    const marks = svg.querySelectorAll('[data-watermark]');
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe(WATERMARK_TEXT);
  });

  it('does not double-stamp', () => {
    const svg = newSvg();
    addWatermark(svg);
    addWatermark(svg);
    expect(svg.querySelectorAll('[data-watermark]')).toHaveLength(1);
  });
});

describe('addShareQr', () => {
  it('injects a scannable QR group in the bottom-right corner', () => {
    const svg = newSvg();
    addShareQr(svg, APP_URL);
    const g = svg.querySelector('[data-share-qr]');
    expect(g).not.toBeNull();

    // A white card rect + a non-empty modules path.
    const rect = g!.querySelector('rect')!;
    const path = g!.querySelector('path')!;
    expect(rect).not.toBeNull();
    expect(path.getAttribute('d')!.length).toBeGreaterThan(0);
    expect(path.getAttribute('d')).toContain('M'); // has module rects

    // Positioned in the free bottom-right margin (well outside the ring),
    // inside the viewBox whose max edge is 1036.
    const x = Number(rect.getAttribute('x'));
    const y = Number(rect.getAttribute('y'));
    const w = Number(rect.getAttribute('width'));
    expect(x).toBeGreaterThan(800);
    expect(y).toBeGreaterThan(800);
    expect(x + w).toBeLessThanOrEqual(1036);
  });

  it('does not double-add', () => {
    const svg = newSvg();
    addShareQr(svg, APP_URL);
    addShareQr(svg, APP_URL);
    expect(svg.querySelectorAll('[data-share-qr]')).toHaveLength(1);
  });
});
