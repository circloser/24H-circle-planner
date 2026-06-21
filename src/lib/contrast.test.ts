import { describe, it, expect } from 'vitest';
import { idealTextColor, relativeLuminance, DARK_TEXT, LIGHT_TEXT } from './contrast';

describe('relativeLuminance', () => {
  it('returns ~1 for white and ~0 for black', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
  });

  it('parses 3-digit hex and rgb()', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('rgb(255,255,255)')).toBeCloseTo(1, 5);
  });

  it('returns null for unparsable colours', () => {
    expect(relativeLuminance('not-a-color')).toBeNull();
  });
});

describe('idealTextColor', () => {
  it('uses dark text on light backgrounds', () => {
    expect(idealTextColor('#ffffff')).toBe(DARK_TEXT);
    expect(idealTextColor('#fef08a')).toBe(DARK_TEXT); // pale yellow post-it
    expect(idealTextColor('#bfdbfe')).toBe(DARK_TEXT); // light blue pastel
  });

  it('uses white text on dark backgrounds', () => {
    expect(idealTextColor('#000000')).toBe(LIGHT_TEXT);
    expect(idealTextColor('#1e3a5f')).toBe(LIGHT_TEXT); // deep navy
    expect(idealTextColor('#7c3aed')).toBe(LIGHT_TEXT); // saturated purple
  });

  it('falls back to dark text when the colour cannot be parsed', () => {
    expect(idealTextColor('garbage')).toBe(DARK_TEXT);
  });
});
