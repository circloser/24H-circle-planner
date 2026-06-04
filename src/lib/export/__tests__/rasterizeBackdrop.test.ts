import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('@/data/fonts', () => ({
  pretendardRegular: 'data:font/woff2;base64,REGULARBASE64==',
  pretendardBold: 'data:font/woff2;base64,BOLDBASE64==',
  pretendardRegularTtfUrl: '/assets/pretendard-regular.otf',
  pretendardBoldTtfUrl: '/assets/pretendard-bold.otf',
}));

// jsdom does not support OffscreenCanvas natively; polyfill with a stub that
// returns a predictable PNG data URL so the rest of the pipeline can be tested.
beforeAll(() => {
  if (typeof OffscreenCanvas === 'undefined') {
    // Minimal stub: convertToBlob returns a valid PNG blob
    class OffscreenCanvasStub {
      width: number;
      height: number;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }
      getContext(_type: string) {
        return {
          drawImage: vi.fn(),
        };
      }
      async convertToBlob(_opts?: unknown): Promise<Blob> {
        // Return a minimal 1×1 PNG (89 bytes)
        const pngBytes = new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
          0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR length + type
          0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
          0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth, color type
          0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT header
          0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, // IDAT data
          0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, // CRC
          0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND header
          0x44, 0xae, 0x42, 0x60, 0x82,                    // IEND data
        ]);
        return new Blob([pngBytes], { type: 'image/png' });
      }
    }
    // @ts-expect-error polyfill
    globalThis.OffscreenCanvas = OffscreenCanvasStub;
  }

  // Stub HTMLImageElement.decode (jsdom doesn't support it)
  if (!HTMLImageElement.prototype.decode) {
    HTMLImageElement.prototype.decode = function () {
      return Promise.resolve();
    };
  }

  // Stub URL.createObjectURL / revokeObjectURL (not available in jsdom)
  if (!globalThis.URL.createObjectURL) {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();
  }
});

import { rasterizeBackdrop } from '../rasterizeBackdrop';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTestSvg(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 1000 1000');

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  filter.id = 'glass-blur';
  defs.appendChild(filter);
  svg.appendChild(defs);

  const backdrop = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  backdrop.classList.add('glass-ring-backdrop');
  backdrop.setAttribute('filter', 'url(#glass-blur)');
  backdrop.setAttribute('d', 'M 500 40 A 460 460 0 1 1 499.9999 40 Z');
  svg.appendChild(backdrop);

  // Sibling elements that should be removed
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('width', '1000');
  rect.setAttribute('height', '1000');
  svg.appendChild(rect);

  const sliceGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  sliceGroup.className.baseVal = 'slice-group';
  svg.appendChild(sliceGroup);

  return svg;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('rasterizeBackdrop', () => {
  it('resolves with a string starting with data:image/png;base64,', async () => {
    const svg = buildTestSvg();
    const result = await rasterizeBackdrop(svg, { width: 100, height: 100 });
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^data:image\/png/);
  });

  it('does not modify the original SVG (non-destructive clone)', async () => {
    const svg = buildTestSvg();
    const originalChildren = svg.children.length;
    await rasterizeBackdrop(svg, { width: 100, height: 100 });
    expect(svg.children.length).toBe(originalChildren);
    expect(svg.querySelector('.glass-ring-backdrop')).not.toBeNull();
  });
});
