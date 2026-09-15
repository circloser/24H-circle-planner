import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextMemoSpot, visibleChartRect, type SpotView } from '../memo-spawn';

// 1600×900 window, header floor 72, a 650px chart centred horizontally.
const chart = { left: 475, top: 150, right: 1125, bottom: 800 };
const view: SpotView = { width: 1600, height: 900, top: 72, chart };

describe('nextMemoSpot', () => {
  it('puts the new note just to the right when that is free', () => {
    expect(nextMemoSpot({ x: 20, y: 100 }, [], view)).toEqual({ x: 232, y: 100 });
  });

  it('goes left when the right side would leave the screen', () => {
    expect(nextMemoSpot({ x: 1380, y: 100 }, [], view)).toEqual({ x: 1168, y: 100 });
  });

  it('never lands on the chart', () => {
    // Right of x=200 would cross the chart (475+), left is off screen, so below.
    expect(nextMemoSpot({ x: 200, y: 100 }, [], view)).toEqual({ x: 200, y: 312 });
  });

  it('skips a slot another note already takes', () => {
    const taken = [{ x: 232, y: 100 }];
    expect(nextMemoSpot({ x: 20, y: 100 }, taken, view)).toEqual({ x: 20, y: 312 });
  });

  it('uses the whole screen when no chart is showing', () => {
    expect(nextMemoSpot({ x: 240, y: 100 }, [], { ...view, chart: null })).toEqual({ x: 452, y: 100 });
  });

  it('cascades over the source, still on screen, when boxed in', () => {
    const tiny: SpotView = { width: 420, height: 300, top: 72, chart: null };
    const spot = nextMemoSpot({ x: 212, y: 92 }, [], tiny);
    expect(spot).toEqual({ x: 212, y: 92 });
    expect(spot.x + 200).toBeLessThanOrEqual(420 - 8);
  });
});

describe('visibleChartRect', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  const chartAt = (rect: Partial<DOMRect>) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('data-circle-timeline', '');
    document.body.appendChild(svg);
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0, ...rect } as DOMRect);
  };

  it('returns the chart while it is on screen', () => {
    chartAt({ left: 100, top: 100, right: 700, bottom: 700, width: 600, height: 600 });
    expect(visibleChartRect()).toEqual({ left: 100, top: 100, right: 700, bottom: 700 });
  });

  it('ignores a chart parked offscreen by the hidden layout', () => {
    chartAt({ left: -20000, top: 0, right: -19280, bottom: 720, width: 720, height: 720 });
    expect(visibleChartRect()).toBeNull();
  });

  it('is null when there is no chart (table or record view)', () => {
    expect(visibleChartRect()).toBeNull();
  });
});
