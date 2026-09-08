import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import { BoundaryHandles } from '../BoundaryHandles';
const dispatch = vi.fn();
vi.mock('@/hooks/useScheduleStore', () => ({ useStoreDispatch: () => dispatch, useStoreSelector: (selector: (state: object) => unknown) => selector({ isDraggingBoundary: false, dragRef: null }) }));
vi.mock('@/hooks/useCoarsePointer', () => ({ useCoarsePointer: () => false }));
afterEach(() => { cleanup(); dispatch.mockClear(); });
const slices = [
  { id: 'a', startTime: '22:00', endTime: '02:00', label: '', color: '#fff', icon: '', textPosition: 'inside' as const },
  { id: 'b', startTime: '02:00', endTime: '22:00', label: '', color: '#fff', icon: '', textPosition: 'inside' as const },
];
describe('Boundary keyboard controls', () => {
  it('exposes midnight-wrapped values and clamps Home/End to adjacent slice limits', () => {
    render(<svg><BoundaryHandles slices={slices} onPointerDownHandle={vi.fn()} /></svg>);
    const slider = screen.getAllByRole('slider')[0];
    expect(slider.getAttribute('aria-valuetext')).toBe('02:00');
    expect(slider.getAttribute('aria-valuenow')).toBe('1560');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'RESIZE_BOUNDARY', boundaryIndex: 0, newHHmm: '02:05', direction: 'clockwise' });
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'RESIZE_BOUNDARY', boundaryIndex: 0, newHHmm: '22:05', direction: 'counterclockwise' });
    fireEvent.keyDown(slider, { key: 'End' });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'RESIZE_BOUNDARY', boundaryIndex: 0, newHHmm: '21:55', direction: 'clockwise' });
  });
});
