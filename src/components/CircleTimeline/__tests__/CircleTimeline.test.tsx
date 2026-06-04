import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CircleTimeline } from '../CircleTimeline';
import type { TimeSlice } from '@/types/time-slice';

function makeSlice(startTime: string, endTime: string, id = 'test'): TimeSlice {
  return {
    id,
    label: 'Test',
    startTime,
    endTime,
    color: '#3B82F6',
    icon: '',
    textPosition: 'inside',
  };
}

const defaultSlices: TimeSlice[] = [
  makeSlice('00:00', '06:00', 'a'),
  makeSlice('06:00', '12:00', 'b'),
  makeSlice('12:00', '18:00', 'c'),
  makeSlice('18:00', '00:00', 'd'),
];

describe('CircleTimeline', () => {
  it('renders an SVG with the correct viewBox', () => {
    const { container } = render(<CircleTimeline slices={defaultSlices} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 1000 1000');
  });

  it('renders one path per slice in the slice-group', () => {
    const { container } = render(<CircleTimeline slices={defaultSlices} />);
    const sliceGroup = container.querySelector('.slice-group');
    const paths = sliceGroup?.querySelectorAll('path');
    expect(paths?.length).toBe(defaultSlices.length);
  });

  it('attaches data-slice-id to each slice path', () => {
    const { container } = render(<CircleTimeline slices={defaultSlices} />);
    const sliceGroup = container.querySelector('.slice-group');
    const paths = sliceGroup?.querySelectorAll('path');
    const ids = Array.from(paths ?? []).map((p) => p.getAttribute('data-slice-id'));
    expect(ids).toEqual(defaultSlices.map((s) => s.id));
  });

  it('renders with fixed size when size prop is provided', () => {
    const { container } = render(<CircleTimeline slices={defaultSlices} size={400} />);
    const svg = container.querySelector('svg');
    expect(svg?.style.width).toBe('400px');
    expect(svg?.style.height).toBe('400px');
  });

  it('renders responsive by default (no explicit size)', () => {
    const { container } = render(<CircleTimeline slices={defaultSlices} />);
    const svg = container.querySelector('svg');
    // Responsive: width is 100%, not a fixed pixel value
    expect(svg?.style.width).toBe('100%');
  });

  it('applies pointer-events none in preview mode', () => {
    const { container } = render(<CircleTimeline slices={defaultSlices} mode="preview" />);
    const svg = container.querySelector('svg');
    expect(svg?.style.pointerEvents).toBe('none');
  });

  it('does not set pointer-events none in interactive mode', () => {
    const { container } = render(<CircleTimeline slices={defaultSlices} mode="interactive" />);
    const svg = container.querySelector('svg');
    expect(svg?.style.pointerEvents).toBeFalsy();
  });

  it('renders hour tick lines', () => {
    const { container } = render(<CircleTimeline slices={defaultSlices} />);
    const ticks = container.querySelector('.hour-ticks');
    expect(ticks).not.toBeNull();
    // 24 tick lines (one per hour)
    const lines = ticks?.querySelectorAll('line');
    expect(lines?.length).toBe(24);
  });

  it('renders all 24 hour labels', () => {
    const { container } = render(<CircleTimeline slices={defaultSlices} />);
    const ticks = container.querySelector('.hour-ticks');
    // All 24 hour labels (00–23) are now rendered
    const labels = ticks?.querySelectorAll('text');
    expect(labels?.length).toBe(24);
  });

  it('renders cardinal hour labels (00/06/12/18) with larger font', () => {
    const { container } = render(<CircleTimeline slices={defaultSlices} />);
    const ticks = container.querySelector('.hour-ticks');
    const allLabels = Array.from(ticks?.querySelectorAll('text') ?? []);
    // Cardinal hours are at indices 0, 6, 12, 18 (h values)
    const cardinalTexts = allLabels.filter((el) =>
      ['00', '06', '12', '18'].includes(el.textContent ?? '')
    );
    expect(cardinalTexts.length).toBe(4);
    // Cardinal labels have font-size 22, minor labels have 15
    // React renders fontSize prop as the SVG attribute "font-size" in the DOM
    for (const el of cardinalTexts) {
      const fs = el.getAttribute('font-size') ?? el.getAttribute('fontSize');
      expect(Number(fs)).toBe(22);
    }
  });

  it('renders the now-indicator with data-export-exclude', () => {
    const { container } = render(<CircleTimeline slices={defaultSlices} />);
    const nowIndicator = container.querySelector('.now-indicator');
    expect(nowIndicator).not.toBeNull();
    expect(nowIndicator?.getAttribute('data-export-exclude')).toBe('true');
  });

  it('renders empty slices without error', () => {
    expect(() => render(<CircleTimeline slices={[]} />)).not.toThrow();
  });

  // B4: SVG is bounded within its container
  it('B4: SVG has max-width 720px when responsive', () => {
    const { container } = render(<CircleTimeline slices={defaultSlices} />);
    const svg = container.querySelector('svg');
    expect(svg?.style.maxWidth).toBe('720px');
  });

  it('B4: SVG has aspect-ratio 1/1 when responsive', () => {
    const { container } = render(<CircleTimeline slices={defaultSlices} />);
    const svg = container.querySelector('svg');
    expect(svg?.style.aspectRatio).toBe('1 / 1');
  });
});
