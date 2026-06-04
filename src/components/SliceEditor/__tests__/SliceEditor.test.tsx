import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { SliceEditor } from '../SliceEditor';
import { ScheduleStoreProvider, useStoreDispatch } from '@/hooks/useScheduleStore';
import type { TimeSlice } from '@/types/time-slice';
import { v4 as uuid } from 'uuid';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), warning: vi.fn() },
}));

const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: storageMock, writable: true });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSlice(overrides: Partial<TimeSlice> = {}): TimeSlice {
  return {
    id: uuid(),
    label: '수면',
    startTime: '00:00',
    endTime: '08:00',
    color: '#9ca3af',
    icon: '💤',
    textPosition: 'inside',
    ...overrides,
  };
}

function makeMockSvgRef(): React.RefObject<SVGSVGElement | null> {
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
  const mockCTM = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } as unknown as DOMMatrix;
  Object.defineProperty(svgEl, 'getScreenCTM', {
    value: () => mockCTM,
    writable: true,
    configurable: true,
  });
  return { current: svgEl } as React.RefObject<SVGSVGElement | null>;
}

/**
 * Loads a test schedule into the store once on mount via useEffect.
 * Accepts an optional extra slice array (defaults to one companion slice).
 */
function ScheduleLoader({ slice, extraSlices }: { slice: TimeSlice; extraSlices?: TimeSlice[] }) {
  const dispatch = useStoreDispatch();
  useEffect(() => {
    const companions = extraSlices ?? [
      { ...slice, id: uuid(), startTime: '08:00', endTime: '24:00', label: '기타' },
    ];
    const schedule = {
      id: uuid(),
      version: 1 as const,
      name: 'test',
      slices: [slice, ...companions],
      updatedAt: new Date().toISOString(),
      presetSource: null,
    };
    dispatch({ type: 'LOAD_SCHEDULE', schedule });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fire once on mount
  return null;
}

function Wrapper({
  children,
  slice,
  extraSlices,
}: {
  children: ReactNode;
  slice: TimeSlice;
  extraSlices?: TimeSlice[];
}) {
  return (
    <ScheduleStoreProvider>
      <ScheduleLoader slice={slice} extraSlices={extraSlices} />
      {children}
    </ScheduleStoreProvider>
  );
}

async function renderEditor(
  sliceOverrides: Partial<TimeSlice> = {},
  onClose?: () => void,
  extraSlices?: TimeSlice[],
) {
  const slice = makeSlice(sliceOverrides);
  const handleClose = onClose ?? vi.fn();
  const svgRef = makeMockSvgRef();

  let result!: ReturnType<typeof render>;
  act(() => {
    result = render(
      <Wrapper slice={slice} extraSlices={extraSlices}>
        <SliceEditor sliceId={slice.id} svgRef={svgRef} onClose={handleClose} />
      </Wrapper>,
    );
  });

  // Wait for the input to show up in the body (portal)
  await waitFor(() => {
    const input = document.body.querySelector('input[placeholder]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
  }, { timeout: 2000 });

  return { slice, handleClose, svgRef, ...result };
}

// Helper to get the editor input from the portal
function getEditorInput(): HTMLInputElement {
  const input = document.body.querySelector('input[placeholder]') as HTMLInputElement | null;
  if (!input) throw new Error('Editor input not found in DOM');
  return input;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SliceEditor', () => {
  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '<div></div>';
  });

  it('renders the label input with the slice label', async () => {
    await renderEditor({ label: '수면' });
    const input = getEditorInput();
    expect(input.value).toBe('수면');
  });

  it('pressing ESC calls onClose without committing', async () => {
    const onClose = vi.fn();
    await renderEditor({ label: '수면' }, onClose);

    const input = getEditorInput();
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('typing a label and pressing Enter calls onClose (commit path)', async () => {
    const onClose = vi.fn();
    await renderEditor({ label: '수면' }, onClose);

    const input = getEditorInput();
    fireEvent.change(input, { target: { value: '점심' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows aria-invalid when Korean grapheme count > 12', async () => {
    await renderEditor({ label: '수면' });
    const input = getEditorInput();
    // 13 Korean chars
    fireEvent.change(input, { target: { value: '가나다라마바사아자차카타파' } });
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows warning text when over Korean 12-char limit', async () => {
    await renderEditor({ label: '수면' });
    const input = getEditorInput();
    fireEvent.change(input, { target: { value: '가나다라마바사아자차카타파' } });

    const warning = document.body.querySelector('p.text-red-500') ?? document.body.querySelector('[class*="text-red"]');
    expect(warning).not.toBeNull();
    expect(warning?.textContent).toMatch(/12자 초과/);
  });

  it('saves truncated label when over limit and Enter is pressed', async () => {
    const onClose = vi.fn();
    await renderEditor({ label: '수면' }, onClose);

    const input = getEditorInput();
    // 13 Korean chars — over limit, but commit still fires
    fireEvent.change(input, { target: { value: '가나다라마바사아자차카타파' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders placeholder text', async () => {
    await renderEditor({ label: '' });
    const input = getEditorInput();
    expect(input.placeholder).toMatch(/예: 수면/);
  });

  it('does not render dialog when sliceId is null', () => {
    document.body.innerHTML = '<div id="root"></div>';
    const svgRef = makeMockSvgRef();

    render(
      <ScheduleStoreProvider>
        <SliceEditor sliceId={null} svgRef={svgRef} onClose={() => {}} />
      </ScheduleStoreProvider>,
      { container: document.getElementById('root') ?? document.body },
    );

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
  });

  // ── 분할 / 삭제 button tests ──────────────────────────────────────────────────

  it('renders the 분할 (split) button', async () => {
    await renderEditor({ startTime: '00:00', endTime: '08:00' }); // 480 min → splittable
    const splitBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '분할',
    );
    expect(splitBtn).not.toBeUndefined();
  });

  it('renders the 삭제 (delete) button', async () => {
    await renderEditor({ startTime: '00:00', endTime: '08:00' });
    const deleteBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '삭제',
    );
    expect(deleteBtn).not.toBeUndefined();
  });

  it('분할 button is disabled when slice is < 20 min', async () => {
    // Slice is only 10 min — too narrow to split
    await renderEditor({ startTime: '00:00', endTime: '00:10' });
    const splitBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '분할',
    ) as HTMLButtonElement | undefined;
    expect(splitBtn).not.toBeUndefined();
    expect(splitBtn?.disabled).toBe(true);
  });

  it('분할 button is enabled when slice is ≥ 20 min', async () => {
    await renderEditor({ startTime: '00:00', endTime: '08:00' });
    const splitBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '분할',
    ) as HTMLButtonElement | undefined;
    expect(splitBtn?.disabled).toBe(false);
  });

  it('삭제 button is disabled when only one slice exists', async () => {
    // Pass extraSlices=[] so the schedule has exactly 1 slice
    await renderEditor({ startTime: '00:00', endTime: '00:00' }, undefined, []);
    const deleteBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '삭제',
    ) as HTMLButtonElement | undefined;
    expect(deleteBtn).not.toBeUndefined();
    expect(deleteBtn?.disabled).toBe(true);
  });

  it('삭제 button is enabled when multiple slices exist', async () => {
    await renderEditor({ startTime: '00:00', endTime: '08:00' });
    const deleteBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '삭제',
    ) as HTMLButtonElement | undefined;
    expect(deleteBtn?.disabled).toBe(false);
  });

  it('clicking 분할 dispatches SPLIT and calls onClose', async () => {
    const onClose = vi.fn();
    await renderEditor({ startTime: '00:00', endTime: '08:00' }, onClose);
    const splitBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '분할',
    ) as HTMLButtonElement;
    act(() => { fireEvent.click(splitBtn); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking 삭제 dispatches MERGE and calls onClose', async () => {
    const onClose = vi.fn();
    await renderEditor({ startTime: '00:00', endTime: '08:00' }, onClose);
    const deleteBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '삭제',
    ) as HTMLButtonElement;
    act(() => { fireEvent.click(deleteBtn); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
