import { describe, expect, it } from 'vitest';
import { lifeImageScale } from '../export/lifeImage';

describe('the life image size', () => {
  it('is drawn at 2× while the canvas allows', () => {
    expect(lifeImageScale(4000, 2, 240_000_000)).toBe(2);
  });

  it('steps down for a very long line, staying inside what browsers accept', () => {
    const h = 40_000;
    const s = lifeImageScale(h, 2, 240_000_000);
    expect(h * s).toBeLessThanOrEqual(32_000);
    expect(1080 * s * h * s).toBeLessThanOrEqual(240_000_000);
  });

  it('keeps an iPhone canvas under Safari’s 16.7M-pixel limit', () => {
    const h = 6000;
    const s = lifeImageScale(h, 2, 16_000_000);
    expect(1080 * s * h * s).toBeLessThanOrEqual(16_777_216);
    expect(s).toBeLessThan(2);
  });
});
