import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SlotSheet } from '../SlotSheet';
import type { Slot } from '@/types/slot';
import type { Schedule } from '@/types/schedule';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}));

vi.mock('@/components/CircleTimeline/CircleTimeline', () => ({
  CircleTimeline: ({ slices }: { slices: unknown[] }) => (
    <div data-testid="circle-timeline" data-slice-count={slices.length} />
  ),
}));

vi.mock('@/hooks/useScheduleStore', () => ({
  useStoreSelector: vi.fn(() => ({})),
  useStoreDispatch: vi.fn(() => vi.fn()),
  useSliceSelector: vi.fn(() => undefined),
  ScheduleStoreProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock slots lib — we'll control what loadSlots / deleteSlot / renameSlot do
vi.mock('@/lib/slots', () => ({
  loadSlots: vi.fn(),
  deleteSlot: vi.fn(),
  renameSlot: vi.fn(),
  SLOTS_CAPACITY: 10,
}));

import { loadSlots, deleteSlot, renameSlot } from '@/lib/slots';
const mockLoadSlots = loadSlots as ReturnType<typeof vi.fn>;
const mockDeleteSlot = deleteSlot as ReturnType<typeof vi.fn>;
const mockRenameSlot = renameSlot as ReturnType<typeof vi.fn>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSchedule(): Schedule {
  return {
    id: 'sched-1',
    version: 1,
    name: '테스트',
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

function makeSlot(id: string, name: string): Slot {
  return {
    id,
    name,
    schedule: makeSchedule(),
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function make10Slots(): Record<string, Slot> {
  const slots: Record<string, Slot> = {};
  for (let i = 0; i < 10; i++) {
    slots[`slot-${i}`] = makeSlot(`slot-${i}`, `시간표 ${i}`);
  }
  return slots;
}

function renderSheet(
  overrides: Partial<{
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onLoad: (slot: Slot) => void;
  }> = {},
) {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    onLoad: vi.fn(),
  };
  return render(<SlotSheet {...defaults} {...overrides} />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockLoadSlots.mockReturnValue({});
  mockDeleteSlot.mockImplementation(() => undefined);
  mockRenameSlot.mockImplementation(() => undefined);
});

describe('SlotSheet', () => {
  it('shows empty state copy when there are 0 slots', () => {
    mockLoadSlots.mockReturnValue({});
    renderSheet();
    expect(screen.getByText(/저장된 시간표가 없습니다/)).toBeTruthy();
  });

  it('renders 3 rows with name, date and action buttons for 3 slots', () => {
    mockLoadSlots.mockReturnValue({
      'slot-1': makeSlot('slot-1', '아침 루틴'),
      'slot-2': makeSlot('slot-2', '오후 루틴'),
      'slot-3': makeSlot('slot-3', '저녁 루틴'),
    });
    renderSheet();
    expect(screen.getByText('아침 루틴')).toBeTruthy();
    expect(screen.getByText('오후 루틴')).toBeTruthy();
    expect(screen.getByText('저녁 루틴')).toBeTruthy();
    // 3 Load buttons
    expect(screen.getAllByRole('button', { name: '불러오기' })).toHaveLength(3);
    // 3 Delete buttons
    expect(screen.getAllByRole('button', { name: '삭제' })).toHaveLength(3);
    // 3 mini timelines
    expect(screen.getAllByTestId('circle-timeline')).toHaveLength(3);
  });

  it('clicking Load opens confirm dialog, confirming fires onLoad with the correct slot', () => {
    const slot = makeSlot('slot-1', '아침 루틴');
    mockLoadSlots.mockReturnValue({ 'slot-1': slot });
    const onLoad = vi.fn();
    renderSheet({ onLoad });

    // Click Load button
    fireEvent.click(screen.getByRole('button', { name: '불러오기' }));

    // Confirm dialog opens
    expect(screen.getByText(/기존 시간표가 덮어쓰여집니다/)).toBeTruthy();

    // The dialog's confirm button is the last "불러오기" button
    const allLoadBtns = screen.getAllByRole('button', { name: '불러오기' });
    fireEvent.click(allLoadBtns[allLoadBtns.length - 1]);

    expect(onLoad).toHaveBeenCalledOnce();
    expect(onLoad).toHaveBeenCalledWith(slot);
  });

  it('clicking Delete opens confirm dialog, confirming removes the slot', () => {
    const slot = makeSlot('slot-1', '아침 루틴');
    // After deletion, loadSlots returns empty
    mockLoadSlots
      .mockReturnValueOnce({ 'slot-1': slot }) // initial render
      .mockReturnValue({}); // after delete

    renderSheet();

    // Click Delete
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    // Confirm dialog opens
    expect(screen.getByText(/삭제할까요/)).toBeTruthy();

    // Click the destructive delete button in the dialog
    const deleteBtns = screen.getAllByRole('button', { name: '삭제' });
    fireEvent.click(deleteBtns[deleteBtns.length - 1]);

    expect(mockDeleteSlot).toHaveBeenCalledWith('slot-1');
    // After deletion the empty state text should appear
    expect(screen.getByText(/저장된 시간표가 없습니다/)).toBeTruthy();
  });

  it('clicking Rename pencil shows inline input, Enter commits renameSlot', () => {
    const slot = makeSlot('slot-1', '아침 루틴');
    mockLoadSlots.mockReturnValue({ 'slot-1': { ...slot, name: '새로운 이름' } });

    const { container } = render(
      <SlotSheet
        open={true}
        onOpenChange={vi.fn()}
        onLoad={vi.fn()}
      />,
    );
    // Reload with original slot
    cleanup();
    mockLoadSlots.mockReturnValue({ 'slot-1': slot });
    render(<SlotSheet open={true} onOpenChange={vi.fn()} onLoad={vi.fn()} />);

    // Click the pencil icon button (aria-label="이름 변경")
    const pencilBtn = screen.getByRole('button', { name: '이름 변경' });
    fireEvent.click(pencilBtn);

    // Input should appear
    const input = screen.getByRole('textbox', { name: '슬롯 이름 편집' });
    expect(input).toBeTruthy();

    // Change value and press Enter
    fireEvent.change(input, { target: { value: '새로운 이름' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockRenameSlot).toHaveBeenCalledWith('slot-1', '새로운 이름');

    // cleanup container from first render
    void container;
  });

  it('shows capacity warning banner when 10 slots are present', () => {
    mockLoadSlots.mockReturnValue(make10Slots());
    renderSheet();
    expect(screen.getByText(/최대 10개 슬롯에 도달했습니다/)).toBeTruthy();
  });

  it('does not show capacity warning when fewer than 10 slots', () => {
    mockLoadSlots.mockReturnValue({
      'slot-1': makeSlot('slot-1', '아침'),
    });
    renderSheet();
    expect(screen.queryByText(/최대 10개 슬롯에 도달했습니다/)).toBeNull();
  });
});
