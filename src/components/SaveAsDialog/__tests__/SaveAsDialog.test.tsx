import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SaveAsDialog } from '../SaveAsDialog';
import type { Schedule } from '@/types/schedule';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

vi.mock('@/lib/slots', () => ({
  loadSlots: vi.fn(),
  saveSlot: vi.fn(),
  SLOTS_CAPACITY: 10,
}));

import { loadSlots, saveSlot } from '@/lib/slots';
import { toast } from 'sonner';

const mockLoadSlots = loadSlots as ReturnType<typeof vi.fn>;
const mockSaveSlot = saveSlot as ReturnType<typeof vi.fn>;
const mockToastError = toast.error as ReturnType<typeof vi.fn>;
const mockToastSuccess = toast.success as ReturnType<typeof vi.fn>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSchedule(name = '내 시간표'): Schedule {
  return {
    id: 'sched-1',
    version: 1,
    name,
    slices: [
      {
        id: 'slice-1',
        label: '',
        startTime: '00:00',
        endTime: '00:00',
        color: '#9CA3AF',
        icon: '',
        textPosition: 'inside',
      },
    ],
    updatedAt: '2026-01-01T00:00:00.000Z',
    presetSource: null,
  };
}

function renderDialog(
  overrides: Partial<Parameters<typeof SaveAsDialog>[0]> = {},
) {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    currentSchedule: makeSchedule(),
    onSaved: vi.fn(),
  };
  return render(<SaveAsDialog {...defaults} {...overrides} />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockLoadSlots.mockReturnValue({});
  mockSaveSlot.mockReturnValue({ success: true });
});

describe('SaveAsDialog', () => {
  it('saves successfully: toast.success called and onSaved called', () => {
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({ onSaved, onOpenChange });

    // Input is pre-filled with the schedule name
    const input = screen.getByRole('textbox', { name: '슬롯 이름' });
    expect((input as HTMLInputElement).value).toBe('내 시간표');

    // Click 저장
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(mockSaveSlot).toHaveBeenCalledOnce();
    expect(mockToastSuccess).toHaveBeenCalledOnce();
    expect(onSaved).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows toast.error and does NOT close when at capacity', () => {
    mockSaveSlot.mockReturnValue({ success: false, reason: 'capacity' });
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({ onSaved, onOpenChange });

    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(mockToastError).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
    // onOpenChange should not have been called with false to close
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('저장 button is disabled when name is empty/whitespace', () => {
    renderDialog();
    const input = screen.getByRole('textbox', { name: '슬롯 이름' });
    fireEvent.change(input, { target: { value: '   ' } });
    const saveBtn = screen.getByRole('button', { name: '저장' });
    expect(saveBtn).toHaveProperty('disabled', true);
  });

  it('defaults to schedule name with (사본) suffix if name already taken', () => {
    mockLoadSlots.mockReturnValue({
      'slot-1': {
        id: 'slot-1',
        name: '내 시간표',
        schedule: makeSchedule(),
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });
    renderDialog({ currentSchedule: makeSchedule('내 시간표') });

    const input = screen.getByRole('textbox', { name: '슬롯 이름' });
    expect((input as HTMLInputElement).value).toBe('내 시간표 (사본)');
  });

  it('allows typing a custom name before saving', () => {
    renderDialog();
    const input = screen.getByRole('textbox', { name: '슬롯 이름' });
    fireEvent.change(input, { target: { value: '커스텀 이름' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(mockSaveSlot).toHaveBeenCalledOnce();
    const savedSlot = mockSaveSlot.mock.calls[0][0] as { name: string };
    expect(savedSlot.name).toBe('커스텀 이름');
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining('커스텀 이름'));
  });

  it('pressing Enter in input triggers save', () => {
    const onSaved = vi.fn();
    renderDialog({ onSaved });

    const input = screen.getByRole('textbox', { name: '슬롯 이름' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockSaveSlot).toHaveBeenCalledOnce();
    expect(onSaved).toHaveBeenCalledOnce();
  });
});
