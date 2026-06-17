/**
 * Verifies that exportPng strips [data-export-exclude] elements (e.g. the
 * now-indicator line) from the SVG clone before rasterization.
 *
 * We test the clone-and-strip step in isolation — the full canvas pipeline
 * cannot run in jsdom (no real canvas toBlob), so we intercept at the
 * XMLSerializer step by monkey-patching it.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('@/data/fonts', () => ({
  pretendardRegular: 'data:font/woff2;base64,REGULARBASE64==',
  pretendardBold: 'data:font/woff2;base64,BOLDBASE64==',
  pretendardRegularTtfUrl: '/assets/pretendard-regular.otf',
  pretendardBoldTtfUrl: '/assets/pretendard-bold.otf',
  notoSansKr400: 'data:font/woff2;base64,NOTO400==',
  notoSansKr700: 'data:font/woff2;base64,NOTO700==',
  nanumMyeongjo400: 'data:font/woff2;base64,NANUM400==',
  nanumMyeongjo700: 'data:font/woff2;base64,NANUM700==',
  jua400: 'data:font/woff2;base64,JUA400==',
  gowunDodum400: 'data:font/woff2;base64,GOWUN400==',
  blackHanSans400: 'data:font/woff2;base64,BLACKHAN400==',
  gaegu400: 'data:font/woff2;base64,GAEGU400==',
}));

// ─── jsdom canvas stub (minimal — just enough to not throw) ──────────────────
beforeAll(() => {
  // Stub URL.createObjectURL / revokeObjectURL
  if (!URL.createObjectURL) {
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:mock'),
      writable: true,
    });
  }
  if (!URL.revokeObjectURL) {
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      writable: true,
    });
  }
});

// ─── Helper: build an SVG with a now-indicator ───────────────────────────────

function buildSvgWithNowIndicator(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 1000 1000');

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '500');
  circle.setAttribute('cy', '500');
  circle.setAttribute('r', '100');
  svg.appendChild(circle);

  // Now-indicator group — must be stripped before export
  const nowGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  nowGroup.classList.add('now-indicator');
  nowGroup.setAttribute('data-export-exclude', 'true');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('stroke', '#EF4444');
  nowGroup.appendChild(line);
  svg.appendChild(nowGroup);

  return svg;
}

// ─── Test: the clone produced by exportPng excludes [data-export-exclude] ────

describe('exportPng — data-export-exclude stripping', () => {
  it('clone passed to XMLSerializer has no [data-export-exclude] elements', async () => {
    const sourceSvg = buildSvgWithNowIndicator();

    // Capture the clone that exportPng serializes
    let capturedClone: SVGSVGElement | null = null;
    const origSerialize = XMLSerializer.prototype.serializeToString;
    XMLSerializer.prototype.serializeToString = function (node) {
      if (node instanceof SVGSVGElement) capturedClone = node as SVGSVGElement;
      return origSerialize.call(this, node);
    };

    // We expect exportPng to throw (no real canvas), so catch the error
    const { exportPng } = await import('../png');
    try {
      await exportPng(sourceSvg, { size: 1080, transparent: false });
    } catch {
      // expected in jsdom — canvas pipeline not fully available
    } finally {
      XMLSerializer.prototype.serializeToString = origSerialize;
    }

    // The clone must not contain the now-indicator
    expect(capturedClone).not.toBeNull();
    if (capturedClone) {
      expect((capturedClone as SVGSVGElement).querySelector('[data-export-exclude]')).toBeNull();
      expect((capturedClone as SVGSVGElement).querySelector('.now-indicator')).toBeNull();
    }
  });
});
