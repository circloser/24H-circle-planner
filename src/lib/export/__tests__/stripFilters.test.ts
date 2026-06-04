import { describe, it, expect, vi } from 'vitest';

vi.mock('@/data/fonts', () => ({
  pretendardRegular: 'data:font/woff2;base64,REGULARBASE64==',
  pretendardBold: 'data:font/woff2;base64,BOLDBASE64==',
  pretendardRegularTtfUrl: '/assets/pretendard-regular.otf',
  pretendardBoldTtfUrl: '/assets/pretendard-bold.otf',
}));

import { stripFiltersAndBackdrop } from '../stripFilters';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTestSvg(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 1000 1000');

  // <defs> with a filter
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  filter.id = 'glass-blur';
  defs.appendChild(filter);
  svg.appendChild(defs);

  // Glass backdrop path
  const backdrop = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  backdrop.classList.add('glass-ring-backdrop');
  backdrop.setAttribute('filter', 'url(#glass-blur)');
  backdrop.setAttribute('d', 'M 0 0 Z');
  svg.appendChild(backdrop);

  // Slice paths with fill-opacity
  for (let i = 0; i < 3; i++) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('data-slice-id', `slice-${i}`);
    path.setAttribute('fill', '#ff0000');
    path.setAttribute('fill-opacity', '0.8');
    path.setAttribute('filter', 'url(#glass-blur)');
    svg.appendChild(path);
  }

  // An unrelated path with filter
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('filter', 'url(#glass-blur)');
  svg.appendChild(rect);

  // Now-indicator group tagged for export exclusion
  const nowGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  nowGroup.classList.add('now-indicator');
  nowGroup.setAttribute('data-export-exclude', 'true');
  const nowLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  nowLine.setAttribute('stroke', '#EF4444');
  nowGroup.appendChild(nowLine);
  svg.appendChild(nowGroup);

  return svg;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('stripFiltersAndBackdrop', () => {
  it('removes the .glass-ring-backdrop path', () => {
    const svg = buildTestSvg();
    const result = stripFiltersAndBackdrop(svg);

    expect(result.querySelector('.glass-ring-backdrop')).toBeNull();
  });

  it('removes all filter= attributes from elements', () => {
    const svg = buildTestSvg();
    const result = stripFiltersAndBackdrop(svg);

    const elementsWithFilter = result.querySelectorAll('[filter]');
    expect(elementsWithFilter.length).toBe(0);
  });

  it('removes <filter> elements from <defs>', () => {
    const svg = buildTestSvg();
    const result = stripFiltersAndBackdrop(svg);

    expect(result.querySelector('filter')).toBeNull();
  });

  it('removes fill-opacity from all [data-slice-id] paths (G7: 100% opaque)', () => {
    const svg = buildTestSvg();
    const result = stripFiltersAndBackdrop(svg);

    const slicePaths = result.querySelectorAll('[data-slice-id]');
    expect(slicePaths.length).toBeGreaterThan(0);
    for (const path of Array.from(slicePaths)) {
      expect(path.hasAttribute('fill-opacity')).toBe(false);
    }
  });

  it('injects @font-face <style> in <defs> (for svg2pdf text mapping)', () => {
    const svg = buildTestSvg();
    const result = stripFiltersAndBackdrop(svg);

    const style = result.querySelector('defs style');
    expect(style).not.toBeNull();
    expect(style!.textContent).toContain('@font-face');
  });

  it('does NOT modify the original SVG (deep clone)', () => {
    const svg = buildTestSvg();
    stripFiltersAndBackdrop(svg);

    // Original should still have the backdrop
    expect(svg.querySelector('.glass-ring-backdrop')).not.toBeNull();
    // Original should still have filter attrs
    expect(svg.querySelectorAll('[filter]').length).toBeGreaterThan(0);
  });

  it('returns an SVGSVGElement not attached to document', () => {
    const svg = buildTestSvg();
    const result = stripFiltersAndBackdrop(svg);

    expect(result).toBeInstanceOf(SVGSVGElement);
    expect(result.isConnected).toBe(false);
  });

  it('removes all [data-export-exclude] elements (e.g. now-indicator)', () => {
    const svg = buildTestSvg();
    const result = stripFiltersAndBackdrop(svg);

    // The now-indicator group should be gone
    expect(result.querySelector('[data-export-exclude]')).toBeNull();
    expect(result.querySelector('.now-indicator')).toBeNull();
  });

  it('does NOT remove [data-export-exclude] from the original (deep clone)', () => {
    const svg = buildTestSvg();
    stripFiltersAndBackdrop(svg);

    // Original still has the now-indicator
    expect(svg.querySelector('.now-indicator')).not.toBeNull();
  });
});
