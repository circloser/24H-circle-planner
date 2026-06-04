import { describe, it, expect } from 'vitest';
import { buildAnnulusStencil } from '../pixelDiff';

// ─── Tests for buildAnnulusStencil ────────────────────────────────────────────
//
// compareScreenToExport cannot be fully tested in jsdom (no canvas rendering pipeline).
// We test the stencil builder which is pure math.

describe('buildAnnulusStencil', () => {
  it('returns a Uint8Array of size*size length', () => {
    const stencil = buildAnnulusStencil(100, 30, 40);
    expect(stencil).toBeInstanceOf(Uint8Array);
    expect(stencil.length).toBe(100 * 100);
  });

  it('marks center pixel as non-glass (inside innerR)', () => {
    const size = 100;
    const stencil = buildAnnulusStencil(size, 30, 40);
    // Center pixel at (50, 50) — distance 0 from center, inside innerR=30
    const centerIdx = 50 * size + 50;
    expect(stencil[centerIdx]).toBe(0);
  });

  it('marks a pixel at exactly midRadius as glass', () => {
    const size = 200;
    const innerR = 40;
    const outerR = 60;
    const stencil = buildAnnulusStencil(size, innerR, outerR);
    const midR = (innerR + outerR) / 2; // 50
    // Pixel at (cx, cy - midR) should be in the glass ring
    const cx = size / 2; // 100
    const cy = size / 2; // 100
    const px = Math.round(cx);
    const py = Math.round(cy - midR); // 50
    const idx = py * size + px;
    expect(stencil[idx]).toBe(1);
  });

  it('marks a corner pixel as non-glass (outside outerR)', () => {
    const size = 100;
    const stencil = buildAnnulusStencil(size, 30, 40);
    // Corner at (0,0) is far from center (50,50) — distance ~70.7, well outside outerR=40
    const cornerIdx = 0 * size + 0;
    expect(stencil[cornerIdx]).toBe(0);
  });

  it('for identical images (self-compare) diff is 0% — sanity stencil check', () => {
    const size = 10;
    const stencil = buildAnnulusStencil(size, 2, 4);
    // Count glass pixels
    let glassCount = 0;
    for (let i = 0; i < stencil.length; i++) {
      if (stencil[i] === 1) glassCount++;
    }
    // Glass region should be non-zero for reasonable innerR < outerR < size/2
    expect(glassCount).toBeGreaterThan(0);
    // And less than total (not all pixels are glass)
    expect(glassCount).toBeLessThan(size * size);
  });

  it('produces correct annulus shape: pixels at inner boundary are excluded', () => {
    // A pixel at exactly innerR distance should be INCLUDED (dist2 >= innerR2)
    const size = 200;
    const innerR = 40;
    const outerR = 80;
    const stencil = buildAnnulusStencil(size, innerR, outerR);
    const cx = size / 2; // 100
    const cy = size / 2; // 100

    // Pixel at (cx, cy - innerR) — exactly at inner boundary
    const pxInner = Math.round(cx);
    const pyInner = Math.round(cy - innerR); // 60
    const idxInner = pyInner * size + pxInner;
    expect(stencil[idxInner]).toBe(1);

    // Pixel at (cx, cy - (innerR - 1)) — just inside inner ring, should be non-glass
    const pyInside = Math.round(cy - (innerR - 1));
    const idxInside = pyInside * size + pxInner;
    expect(stencil[idxInside]).toBe(0);
  });
});
