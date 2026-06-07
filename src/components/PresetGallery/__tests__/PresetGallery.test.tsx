import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PresetGallery } from '../PresetGallery';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), warning: vi.fn() },
}));

// Mock CircleTimeline — it requires a store provider and SVG rendering;
// for gallery tests we only need to confirm cards are rendered, not the ring.
vi.mock('@/components/CircleTimeline/CircleTimeline', () => ({
  CircleTimeline: ({ slices }: { slices: unknown[] }) => (
    <div data-testid="circle-timeline" data-slice-count={slices.length} />
  ),
}));

// Mock the store hooks used indirectly (CircleTimeline is mocked above but
// other transitive imports may still pull in useScheduleStore)
vi.mock('@/hooks/useScheduleStore', () => ({
  useStoreSelector: vi.fn(() => ({})),
  useStoreDispatch: vi.fn(() => vi.fn()),
  useSliceSelector: vi.fn(() => undefined),
  ScheduleStoreProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderGallery(props: Partial<Parameters<typeof PresetGallery>[0]> = {}) {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
  };
  return render(<PresetGallery {...defaults} {...props} />);
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PresetGallery', () => {
  it('renders 5 preset cards when open=true', () => {
    renderGallery({ open: true });
    // Each card has a heading with the preset name
    expect(screen.getByText('학생')).toBeTruthy();
    expect(screen.getByText('대학생')).toBeTruthy();
    expect(screen.getByText('직장인 9 to 6')).toBeTruthy();
    expect(screen.getByText('자영업자')).toBeTruthy();
    expect(screen.getByText('은퇴자')).toBeTruthy();
  });

  it('renders 5 CircleTimeline previews', () => {
    renderGallery({ open: true });
    const timelines = screen.getAllByTestId('circle-timeline');
    expect(timelines).toHaveLength(5);
  });

  it('clicking a card opens the confirmation dialog and closes the gallery', () => {
    const onOpenChange = vi.fn();
    renderGallery({ open: true, onOpenChange });
    const studentCard = screen.getByText('학생').closest('button')!;
    fireEvent.click(studentCard);
    // Sequential (non-nested) flow: the gallery is asked to close
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Confirmation dialog title appears ("{name} 적용")
    expect(screen.getByText('학생 적용')).toBeTruthy();
    // Confirm + cancel buttons present (confirm label = "현재 창에 적용")
    expect(screen.getByRole('button', { name: '현재 창에 적용' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '취소' })).toBeTruthy();
  });

  it('confirming calls onConfirm with the preset name', () => {
    const onConfirm = vi.fn();
    renderGallery({ open: true, onConfirm });

    // Click the 대학생 card
    const card = screen.getByText('대학생').closest('button')!;
    fireEvent.click(card);

    // Click the "현재 창에 적용" button
    const confirmBtn = screen.getByRole('button', { name: '현재 창에 적용' });
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledWith('대학생');
  });

  it('cancelling closes the confirmation without calling onConfirm', () => {
    const onConfirm = vi.fn();
    renderGallery({ open: true, onConfirm });

    const card = screen.getByText('자영업자').closest('button')!;
    fireEvent.click(card);

    // Confirm dialog is open ("{name} 적용")
    expect(screen.getByText('자영업자 적용')).toBeTruthy();

    // Click 취소 button
    const cancelBtn = screen.getByRole('button', { name: '취소' });
    fireEvent.click(cancelBtn);

    // onConfirm should NOT have been called
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not render cards when open=false', () => {
    renderGallery({ open: false });
    // When the dialog is closed, the DialogContent is not mounted
    expect(screen.queryByText('학생')).toBeNull();
    expect(screen.queryByText('대학생')).toBeNull();
  });
});
