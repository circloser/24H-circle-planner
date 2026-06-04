import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the fonts module before importing inlineFonts
vi.mock('@/data/fonts', () => ({
  pretendardRegular: 'data:font/woff2;base64,REGULARBASE64==',
  pretendardBold: 'data:font/woff2;base64,BOLDBASE64==',
  pretendardRegularTtfUrl: '/assets/pretendard-regular.otf',
  pretendardBoldTtfUrl: '/assets/pretendard-bold.otf',
}));

import { injectFontFaceStyle } from '../inlineFonts';

// ─── JSDOM SVG helpers ────────────────────────────────────────────────────────

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 1000 1000');
  return svg;
}

function makeSvgWithDefs(): SVGSVGElement {
  const svg = makeSvg();
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(defs);
  return svg;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('injectFontFaceStyle', () => {
  it('creates a <style> element with @font-face declarations', () => {
    const svg = makeSvg();
    injectFontFaceStyle(svg);

    const style = svg.querySelector('defs style');
    expect(style).not.toBeNull();
    expect(style!.textContent).toContain('@font-face');
    expect(style!.textContent).toContain("font-family: 'Pretendard'");
    expect(style!.textContent).toContain('font-weight: 400');
    expect(style!.textContent).toContain('font-weight: 700');
  });

  it('inserts <defs> if absent', () => {
    const svg = makeSvg();
    expect(svg.querySelector('defs')).toBeNull();

    injectFontFaceStyle(svg);

    expect(svg.querySelector('defs')).not.toBeNull();
  });

  it('reuses existing <defs> if present', () => {
    const svg = makeSvgWithDefs();
    injectFontFaceStyle(svg);

    // Should still be exactly one <defs>
    expect(svg.querySelectorAll('defs').length).toBe(1);
  });

  it('inserts style as FIRST child of defs', () => {
    const svg = makeSvgWithDefs();
    const defs = svg.querySelector('defs')!;
    // Pre-populate defs with an existing filter
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.id = 'glass-blur';
    defs.appendChild(filter);

    injectFontFaceStyle(svg);

    // Style should be first child, filter second
    expect(defs.children[0].tagName).toBe('style');
    expect(defs.children[1].tagName).toBe('filter');
  });

  it('includes the WOFF2 base64 data URIs from the font module', () => {
    const svg = makeSvg();
    injectFontFaceStyle(svg);

    const style = svg.querySelector('defs style')!;
    expect(style.textContent).toContain('data:font/woff2;base64,REGULARBASE64==');
    expect(style.textContent).toContain('data:font/woff2;base64,BOLDBASE64==');
  });
});
