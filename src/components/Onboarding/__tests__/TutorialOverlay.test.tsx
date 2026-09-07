import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TutorialOverlay } from '../TutorialOverlay';

const state = vi.hoisted(() => ({ history: { present: { slices: [] } } }));
vi.mock('@/hooks/usePreferences', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  useChartView: () => '24h',
}));
vi.mock('@/hooks/useScheduleStore', () => ({
  useStoreSelector: (selector: (value: typeof state) => unknown) => selector(state),
}));
afterEach(cleanup);

describe('TutorialOverlay sessions', () => {
  it('starts at the first step whenever reopened', () => {
    const onClose = vi.fn();
    const { rerender } = render(<TutorialOverlay open onClose={onClose} />);
    expect(screen.getByText('tutorial.n1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /tutorial.skip/ }));
    expect(screen.getByText('tutorial.n2')).toBeTruthy();
    rerender(<TutorialOverlay open={false} onClose={onClose} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<TutorialOverlay open onClose={onClose} />);
    expect(screen.getByText('tutorial.n1')).toBeTruthy();
    expect(screen.queryByText('tutorial.done')).toBeNull();
  });
});
