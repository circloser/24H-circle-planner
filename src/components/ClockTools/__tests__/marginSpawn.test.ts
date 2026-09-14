import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { marginSpawn, relocateSlot, MARGIN_SLOT_SIZE } from '../clock-utils';

// Stored positions are offsets from the viewport centre: (x - 640, y - 400).
const size = { innerWidth: window.innerWidth, innerHeight: window.innerHeight };
beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
});
afterAll(() => {
  Object.defineProperty(window, 'innerWidth', { value: size.innerWidth, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: size.innerHeight, configurable: true });
});

describe('marginSpawn', () => {
  it('keeps the classic spots for the centred (and hidden) chart', () => {
    expect(marginSpawn('clock', ...MARGIN_SLOT_SIZE.clock)).toEqual({ x: -620, y: -316 });
    expect(marginSpawn('memo', ...MARGIN_SLOT_SIZE.memo)).toEqual({ x: 412, y: -260 });
    expect(marginSpawn('clock', ...MARGIN_SLOT_SIZE.clock, 'hidden')).toEqual({ x: -620, y: -316 });
  });

  it('moves everything to the right side when the chart hugs the left', () => {
    // Clock flush with the right edge (1280 - 168 - 20 = 1092 → +452).
    expect(marginSpawn('clock', ...MARGIN_SLOT_SIZE.clock, 'left')).toEqual({ x: 452, y: -316 });
    // Calendar right-aligned too; the post-it sits beside that column.
    expect(marginSpawn('calendar', ...MARGIN_SLOT_SIZE.calendar, 'left').x).toBe(1280 - 232 - 20 - 640);
    expect(marginSpawn('memo', ...MARGIN_SLOT_SIZE.memo, 'left')).toEqual({ x: 1280 - 200 - 276 - 640, y: -260 });
  });

  it('puts the post-it beside the left column when the chart hugs the right', () => {
    expect(marginSpawn('clock', ...MARGIN_SLOT_SIZE.clock, 'right')).toEqual({ x: -620, y: -316 });
    expect(marginSpawn('memo', ...MARGIN_SLOT_SIZE.memo, 'right')).toEqual({ x: 276 - 640, y: -260 });
  });
});

describe('relocateSlot', () => {
  // Computed per test: the viewport is only 1280×800 once beforeAll has run.
  const centreClock = () => marginSpawn('clock', ...MARGIN_SLOT_SIZE.clock);

  it('moves a widget still sitting on its spot to the new layout’s spot', () => {
    const at = centreClock();
    expect(relocateSlot(at, 'clock', 'center', 'left')).toEqual({ x: 452, y: -316 });
    expect(relocateSlot({ x: at.x + 2, y: at.y - 1 }, 'clock', 'center', 'left')).toEqual({ x: 452, y: -316 });
  });

  it('leaves a widget the user dragged elsewhere alone', () => {
    const at = centreClock();
    expect(relocateSlot({ x: at.x + 40, y: at.y }, 'clock', 'center', 'left')).toBeNull();
  });

  it('does nothing when the spot does not change', () => {
    expect(relocateSlot(centreClock(), 'clock', 'center', 'right')).toBeNull();
    expect(relocateSlot(centreClock(), 'clock', 'center', 'hidden')).toBeNull();
  });

  it('round-trips back to the classic spot', () => {
    const left = relocateSlot(centreClock(), 'clock', 'center', 'left');
    expect(left).not.toBeNull();
    expect(relocateSlot(left!, 'clock', 'left', 'center')).toEqual(centreClock());
  });
});
