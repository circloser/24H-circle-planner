import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadSchedule, saveScheduleDebounced, STORAGE_KEY_SCHEDULE } from '../storage';
import type { Schedule, ScheduleEnvelope } from '@/types/schedule';
import type { TimeSlice } from '@/types/time-slice';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSlice(startTime: string, endTime: string): TimeSlice {
  return {
    id: 'slice-1',
    label: 'Test',
    startTime,
    endTime,
    color: '#000',
    icon: '',
    textPosition: 'inside',
  };
}

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'sched-1',
    version: 1,
    name: '테스트',
    slices: [makeSlice('00:00', '00:00')],
    updatedAt: '2026-01-01T00:00:00.000Z',
    presetSource: null,
    ...overrides,
  };
}

// ─── localStorage mock ────────────────────────────────────────────────────────

const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('loadSchedule', () => {
  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
  });

  it('returns null when no key present', () => {
    expect(loadSchedule()).toBeNull();
  });

  it('loads a valid v1 envelope', () => {
    const schedule = makeSchedule();
    const envelope: ScheduleEnvelope = { version: 1, schedule };
    storageMock.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(envelope));
    const result = loadSchedule();
    expect(result).not.toBeNull();
    expect(result?.id).toBe('sched-1');
    expect(result?.name).toBe('테스트');
  });

  it('migrates a legacy schedule (no version field) → returns schedule', () => {
    const schedule = makeSchedule();
    // Store raw schedule without envelope
    storageMock.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(schedule));
    const result = loadSchedule();
    expect(result).not.toBeNull();
    expect(result?.id).toBe('sched-1');
  });

  it('returns null for unknown future version', () => {
    const envelope = { version: 99, schedule: makeSchedule() };
    storageMock.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(envelope));
    expect(loadSchedule()).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    storageMock.setItem(STORAGE_KEY_SCHEDULE, '{invalid json}}}');
    expect(loadSchedule()).toBeNull();
  });

  it('returns null when schedule has missing required fields', () => {
    const envelope = {
      version: 1,
      schedule: { id: 'x', name: 'y' }, // missing slices, updatedAt etc
    };
    storageMock.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(envelope));
    expect(loadSchedule()).toBeNull();
  });

  it('returns null when a slice has invalid textPosition', () => {
    const schedule = makeSchedule({
      slices: [{ ...makeSlice('00:00', '00:00'), textPosition: 'center' as never }],
    });
    const envelope: ScheduleEnvelope = { version: 1, schedule };
    storageMock.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(envelope));
    expect(loadSchedule()).toBeNull();
  });

  it('returns null for completely malformed data', () => {
    storageMock.setItem(STORAGE_KEY_SCHEDULE, '"just a string"');
    expect(loadSchedule()).toBeNull();
  });
});

describe('saveScheduleDebounced', () => {
  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not write immediately on first call', () => {
    const schedule = makeSchedule();
    saveScheduleDebounced(schedule);
    expect(storageMock.setItem).not.toHaveBeenCalled();
  });

  it('writes after 500ms debounce', () => {
    const schedule = makeSchedule();
    saveScheduleDebounced(schedule);
    vi.advanceTimersByTime(500);
    expect(storageMock.setItem).toHaveBeenCalledTimes(1);
    const [key, value] = storageMock.setItem.mock.calls[0] as [string, string];
    expect(key).toBe(STORAGE_KEY_SCHEDULE);
    const envelope: ScheduleEnvelope = JSON.parse(value) as ScheduleEnvelope;
    expect(envelope.version).toBe(1);
    expect(envelope.schedule.id).toBe('sched-1');
  });

  it('coalesces multiple rapid calls into one write', () => {
    const schedule = makeSchedule();
    saveScheduleDebounced(schedule);
    saveScheduleDebounced(schedule);
    saveScheduleDebounced(schedule);
    vi.advanceTimersByTime(499);
    expect(storageMock.setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(storageMock.setItem).toHaveBeenCalledTimes(1);
  });

  it('resets timer on each rapid call — only last schedule is saved', () => {
    const schedule1 = makeSchedule({ id: 'sched-1' });
    const schedule2 = makeSchedule({ id: 'sched-2' });
    saveScheduleDebounced(schedule1);
    vi.advanceTimersByTime(300);
    saveScheduleDebounced(schedule2);
    vi.advanceTimersByTime(500);
    expect(storageMock.setItem).toHaveBeenCalledTimes(1);
    const [, value] = storageMock.setItem.mock.calls[0] as [string, string];
    const envelope: ScheduleEnvelope = JSON.parse(value) as ScheduleEnvelope;
    expect(envelope.schedule.id).toBe('sched-2');
  });

  it('wraps in version:1 envelope', () => {
    const schedule = makeSchedule();
    saveScheduleDebounced(schedule);
    vi.advanceTimersByTime(500);
    const [, value] = storageMock.setItem.mock.calls[0] as [string, string];
    const parsed = JSON.parse(value) as { version: number };
    expect(parsed.version).toBe(1);
  });
});
