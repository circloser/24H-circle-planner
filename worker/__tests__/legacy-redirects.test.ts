import { describe, it, expect } from 'vitest';
import { LEGACY_REDIRECTS, legacyRedirectTarget } from '../legacy-redirects';

/** The ten pillars that absorbed the retired articles. */
const PILLARS = [
  '/health/sleep', '/health/nutrition', '/health/movement', '/health/mind', '/health/rhythm',
  '/stories/entrepreneurs', '/stories/thinkers', '/stories/writers', '/stories/leaders', '/stories/modern',
];

describe('legacy article redirects', () => {
  it('covers all 40 retired articles', () => {
    expect(Object.keys(LEGACY_REDIRECTS)).toHaveLength(40);
  });

  it('every target is a live pillar', () => {
    for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
      expect(PILLARS, `${from} -> ${to}`).toContain(to);
    }
  });

  it('never redirects a pillar (no self- or chained redirects)', () => {
    // A prefix rule could swallow the pillars themselves; the explicit map must not.
    for (const pillar of PILLARS) {
      expect(legacyRedirectTarget(pillar)).toBeNull();
    }
    for (const to of Object.values(LEGACY_REDIRECTS)) {
      expect(LEGACY_REDIRECTS[to]).toBeUndefined();
    }
  });

  it('leaves section indexes and unrelated paths alone', () => {
    for (const p of ['/health', '/health/', '/stories', '/stories/', '/guides/time-blocking', '/', '/about']) {
      expect(legacyRedirectTarget(p)).toBeNull();
    }
  });

  it('normalises trailing slashes and casing', () => {
    const [from, to] = Object.entries(LEGACY_REDIRECTS)[0];
    expect(legacyRedirectTarget(from)).toBe(to);
    expect(legacyRedirectTarget(`${from}/`)).toBe(to);
    expect(legacyRedirectTarget(from.toUpperCase())).toBe(to);
  });
});
