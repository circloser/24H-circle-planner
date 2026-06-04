import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportDialog } from '../ExportDialog';
import type { Schedule } from '@/types/schedule';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/lib/export/png', () => ({
  exportPng: vi.fn().mockResolvedValue(new Blob(['PNG'], { type: 'image/png' })),
}));

vi.mock('@/lib/export/pdf', () => ({
  exportPdf: vi.fn().mockResolvedValue(new Blob(['PDF'], { type: 'application/pdf' })),
}));

vi.mock('@/lib/export/jsonIo', () => ({
  exportScheduleAsJson: vi.fn().mockReturnValue(new Blob(['{}'], { type: 'application/json' })),
  importScheduleFromJson: vi.fn().mockResolvedValue({
    id: 'imported-id',
    version: 1 as const,
    name: '가져온 시간표',
    slices: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    presetSource: null,
  }),
}));

// Stub URL.createObjectURL / revokeObjectURL
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  globalThis.URL.revokeObjectURL = vi.fn();
}

import { toast } from 'sonner';
const mockToastSuccess = toast.success as ReturnType<typeof vi.fn>;
const mockToastError = toast.error as ReturnType<typeof vi.fn>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSchedule(): Schedule {
  return {
    id: 'sched-1',
    version: 1,
    name: '직장인 9 to 6',
    slices: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    presetSource: null,
  };
}

function makeSvgRef(): React.RefObject<SVGSVGElement | null> {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
  return { current: el };
}

function renderDialog(overrides: Partial<Parameters<typeof ExportDialog>[0]> = {}) {
  const user = userEvent.setup();
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    svgRef: makeSvgRef(),
    scheduleName: '직장인 9 to 6',
    schedule: makeSchedule(),
    onImport: vi.fn(),
  };
  const utils = render(<ExportDialog {...defaults} {...overrides} />);
  return { ...utils, user };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ExportDialog', () => {
  it('renders three tabs: PNG, PDF, JSON', () => {
    renderDialog();
    expect(screen.getByRole('tab', { name: 'PNG' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'PDF' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'JSON' })).toBeTruthy();
  });

  it('PNG tab is active by default', () => {
    renderDialog();
    const pngTab = screen.getByRole('tab', { name: 'PNG' });
    expect(pngTab.getAttribute('data-state')).toBe('active');
  });

  it('PNG 내보내기 button is present in PNG tab', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /PNG 내보내기/ })).toBeTruthy();
  });

  it('clicking PNG 내보내기 calls exportPng and shows success toast', async () => {
    const { user } = renderDialog();
    const btn = screen.getByRole('button', { name: /PNG 내보내기/ });
    await user.click(btn);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('PNG 내보내기 완료');
    });
  });

  it('PDF tab becomes active when clicked via userEvent', async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole('tab', { name: 'PDF' }));
    const pdfTab = screen.getByRole('tab', { name: 'PDF' });
    expect(pdfTab.getAttribute('data-state')).toBe('active');
  });

  it('PDF 내보내기 button appears after clicking PDF tab', async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole('tab', { name: 'PDF' }));
    const btn = await screen.findByRole('button', { name: /PDF 내보내기/ });
    expect(btn).toBeTruthy();
  });

  it('clicking PDF 내보내기 calls exportPdf and shows success toast', async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole('tab', { name: 'PDF' }));
    const btn = await screen.findByRole('button', { name: /PDF 내보내기/ });
    await user.click(btn);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('PDF 내보내기 완료');
    });
  });

  it('JSON tab becomes active when clicked via userEvent', async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole('tab', { name: 'JSON' }));
    const jsonTab = screen.getByRole('tab', { name: 'JSON' });
    expect(jsonTab.getAttribute('data-state')).toBe('active');
  });

  it('clicking JSON 내보내기 shows success toast', async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole('tab', { name: 'JSON' }));
    const btn = await screen.findByRole('button', { name: /JSON 내보내기/ });
    await user.click(btn);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('JSON 내보내기 완료');
    });
  });

  it('shows error toast when SVG ref is null for PNG export', async () => {
    const { user } = renderDialog({ svgRef: { current: null } });
    const btn = screen.getByRole('button', { name: /PNG 내보내기/ });
    await user.click(btn);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  it('PNG resolution selector shows three options', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: '1080px' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2K (2160px)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '4K (3840px)' })).toBeTruthy();
  });

  it('transparent background switch is present in PNG tab', () => {
    renderDialog();
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('JSON tab shows JSON 가져오기 button', async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole('tab', { name: 'JSON' }));
    const importBtn = await screen.findByRole('button', { name: /JSON 가져오기/ });
    expect(importBtn).toBeTruthy();
  });
});
