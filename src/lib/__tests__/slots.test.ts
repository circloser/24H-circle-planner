import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  loadSlots,
  saveSlots,
  saveSlot,
  deleteSlot,
  renameSlot,
  STORAGE_KEY_SLOTS,
  SLOTS_CAPACITY,
} from '../slots';
import type { Slot } from '@/types/slot';
import type { Schedule } from '@/types/schedule';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}));

// Import after mock
import { toast } from 'sonner';

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
    _store: () => store,
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSchedule(id = 'sched-1'): Schedule {
  return {
    id,
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

function makeSlot(id = 'slot-1', name = '내 시간표'): Slot {
  return {
    id,
    name,
    schedule: makeSchedule(),
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('loadSlots', () => {
  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
  });

  it('returns {} when key is absent', () => {
    expect(loadSlots()).toEqual({});
  });

  it('loads a valid v1 envelope and returns its slots', () => {
    const slot = makeSlot();
    const envelope = { version: 1, slots: { [slot.id]: slot } };
    storageMock.setItem(STORAGE_KEY_SLOTS, JSON.stringify(envelope));
    const result = loadSlots();
    expect(Object.keys(result)).toHaveLength(1);
    expect(result['slot-1'].name).toBe('내 시간표');
  });

  it('migrates legacy bare Record (no version/slots keys) to v1 envelope', () => {
    const slot = makeSlot();
    // Bare record without envelope wrapper
    const bare: Record<string, Slot> = { [slot.id]: slot };
    storageMock.setItem(STORAGE_KEY_SLOTS, JSON.stringify(bare));

    const result = loadSlots();

    // Returns the slots
    expect(Object.keys(result)).toHaveLength(1);
    expect(result['slot-1'].id).toBe('slot-1');

    // localStorage now contains the v1 envelope
    const stored = storageMock.getItem(STORAGE_KEY_SLOTS);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as { version: number; slots: unknown };
    expect(parsed.version).toBe(1);
    expect(parsed.slots).toBeTruthy();
  });

  it('returns {} and calls toast.error for unknown future version', () => {
    const envelope = { version: 99, slots: {} };
    storageMock.setItem(STORAGE_KEY_SLOTS, JSON.stringify(envelope));
    const result = loadSlots();
    expect(result).toEqual({});
    expect(toast.error).toHaveBeenCalledOnce();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('99'));
  });

  it('returns {} for corrupt JSON', () => {
    storageMock.setItem(STORAGE_KEY_SLOTS, '{invalid}');
    expect(loadSlots()).toEqual({});
  });

  it('silently skips invalid slot entries in an otherwise valid v1 envelope', () => {
    const envelope = {
      version: 1,
      slots: {
        'slot-1': makeSlot(),
        'bad-slot': { id: 'bad-slot', name: 'broken' }, // missing createdAt + schedule
      },
    };
    storageMock.setItem(STORAGE_KEY_SLOTS, JSON.stringify(envelope));
    const result = loadSlots();
    // Only the valid slot is returned
    expect(Object.keys(result)).toHaveLength(1);
    expect(result['slot-1']).toBeTruthy();
  });
});

describe('saveSlots', () => {
  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
  });

  it('writes a { version: 1, slots: ... } envelope to localStorage', () => {
    const slot = makeSlot();
    saveSlots({ [slot.id]: slot });

    const stored = storageMock.getItem(STORAGE_KEY_SLOTS);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as { version: number; slots: Record<string, Slot> };
    expect(parsed.version).toBe(1);
    expect(parsed.slots['slot-1'].name).toBe('내 시간표');
  });
});

describe('saveSlot', () => {
  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
  });

  it('saves a new slot successfully when under capacity', () => {
    const slot = makeSlot();
    const result = saveSlot(slot);
    expect(result).toEqual({ success: true });

    const loaded = loadSlots();
    expect(loaded['slot-1']).toBeTruthy();
  });

  it('returns { success: false, reason: "capacity" } when at max capacity with a new id', () => {
    // Fill to capacity
    const slots: Record<string, Slot> = {};
    for (let i = 0; i < SLOTS_CAPACITY; i++) {
      slots[`slot-${i}`] = makeSlot(`slot-${i}`, `시간표 ${i}`);
    }
    saveSlots(slots);

    // Try to add an 11th new slot
    const newSlot = makeSlot('slot-new', '새 시간표');
    const result = saveSlot(newSlot);
    expect(result).toEqual({ success: false, reason: 'capacity' });

    // localStorage unchanged (still 10 slots)
    const stored = loadSlots();
    expect(Object.keys(stored)).toHaveLength(SLOTS_CAPACITY);
  });

  it('allows updating an existing slot id even when at capacity', () => {
    // Fill to capacity
    const slots: Record<string, Slot> = {};
    for (let i = 0; i < SLOTS_CAPACITY; i++) {
      slots[`slot-${i}`] = makeSlot(`slot-${i}`, `시간표 ${i}`);
    }
    saveSlots(slots);

    // Update existing slot-0
    const updated = makeSlot('slot-0', '업데이트된 이름');
    const result = saveSlot(updated);
    expect(result).toEqual({ success: true });

    const loaded = loadSlots();
    expect(loaded['slot-0'].name).toBe('업데이트된 이름');
    expect(Object.keys(loaded)).toHaveLength(SLOTS_CAPACITY);
  });
});

describe('deleteSlot', () => {
  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
  });

  it('removes the slot and persists the result', () => {
    const slot = makeSlot();
    saveSlots({ [slot.id]: slot });

    deleteSlot('slot-1');
    expect(loadSlots()).toEqual({});
  });

  it('is a no-op when id does not exist', () => {
    const slot = makeSlot();
    saveSlots({ [slot.id]: slot });

    deleteSlot('non-existent');
    expect(Object.keys(loadSlots())).toHaveLength(1);
  });
});

describe('renameSlot', () => {
  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
  });

  it('renames the slot and persists', () => {
    const slot = makeSlot();
    saveSlots({ [slot.id]: slot });

    renameSlot('slot-1', '새로운 이름');
    expect(loadSlots()['slot-1'].name).toBe('새로운 이름');
  });

  it('is a no-op when id does not exist', () => {
    const slot = makeSlot();
    saveSlots({ [slot.id]: slot });

    renameSlot('missing', '이름');
    // Original slot still intact
    expect(loadSlots()['slot-1'].name).toBe('내 시간표');
  });
});

describe('delete + rename round-trip', () => {
  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('round-trip: save, rename, delete leaves an empty record', () => {
    const slot = makeSlot();
    saveSlot(slot);
    renameSlot(slot.id, '변경됨');
    expect(loadSlots()[slot.id].name).toBe('변경됨');
    deleteSlot(slot.id);
    expect(loadSlots()).toEqual({});
  });
});
