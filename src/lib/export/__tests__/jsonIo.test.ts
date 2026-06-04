import { describe, it, expect, vi, beforeEach } from 'vitest';

// Top-level mock — uuid returns deterministic values per call
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid'),
}));

import { exportScheduleAsJson, importScheduleFromJson } from '../jsonIo';
import type { Schedule } from '@/types/schedule';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'sched-1',
    version: 1,
    name: '테스트 시간표',
    slices: [
      {
        id: 'slice-1',
        label: '수면',
        startTime: '00:00',
        endTime: '07:00',
        color: '#9CA3AF',
        icon: '💤',
        textPosition: 'inside',
      },
    ],
    updatedAt: '2026-01-01T00:00:00.000Z',
    presetSource: null,
    ...overrides,
  };
}

async function blobToJson(blob: Blob): Promise<unknown> {
  const text = await blob.text();
  return JSON.parse(text) as unknown;
}

function makeJsonFile(content: unknown, name = 'schedule.json'): File {
  const json = JSON.stringify(content);
  return new File([json], name, { type: 'application/json' });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('exportScheduleAsJson', () => {
  it('returns a Blob with type application/json', () => {
    const blob = exportScheduleAsJson(makeSchedule());
    expect(blob.type).toBe('application/json');
  });

  it('produces the correct envelope shape { version, exportedAt, schedule }', async () => {
    const schedule = makeSchedule();
    const blob = exportScheduleAsJson(schedule);
    const parsed = await blobToJson(blob) as Record<string, unknown>;

    expect(parsed['version']).toBe(1);
    expect(typeof parsed['exportedAt']).toBe('string');
    const s = parsed['schedule'] as Record<string, unknown>;
    expect(s['id']).toBe('sched-1');
    expect(s['name']).toBe('테스트 시간표');
  });

  it('is pretty-printed (contains newlines and indentation)', async () => {
    const blob = exportScheduleAsJson(makeSchedule());
    const text = await blob.text();
    expect(text).toContain('\n');
    expect(text).toContain('  ');
  });
});

describe('importScheduleFromJson — v1 valid', () => {
  it('returns a Schedule with new UUIDs assigned to id and slices', async () => {
    const { v4: mockUuid } = await import('uuid');
    // Each call returns 'mock-uuid'; we just verify the uuid fn was called and ids changed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vi.mocked(mockUuid) as any).mockReturnValue('new-uuid');

    const schedule = makeSchedule();
    const file = makeJsonFile({ version: 1, exportedAt: new Date().toISOString(), schedule });

    const result = await importScheduleFromJson(file);
    // Both schedule id and slice id should be new UUIDs
    expect(result.id).toBe('new-uuid');
    expect(result.slices[0].id).toBe('new-uuid');
    expect(result.name).toBe('테스트 시간표');
  });
});

describe('importScheduleFromJson — legacy (no version envelope)', () => {
  it('migrates legacy bare schedule to version 1 with new UUIDs', async () => {
    const { v4: mockUuid } = await import('uuid');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vi.mocked(mockUuid) as any).mockReturnValue('migrated-uuid');

    // Bare schedule WITHOUT the version envelope wrapper
    // Note: a bare Schedule has version:1 in it, but no 'schedule' key wrapping it
    const schedule = makeSchedule();
    // Remove the wrapping — pass the raw schedule object without envelope
    const bareSchedule = { ...schedule };
    // Delete 'version' to simulate truly legacy (no version field)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (bareSchedule as any)['version'];
    const file = makeJsonFile(bareSchedule);

    const result = await importScheduleFromJson(file);
    expect(result.version).toBe(1);
    expect(result.id).toBe('migrated-uuid');
    expect(result.name).toBe('테스트 시간표');
  });
});

describe('importScheduleFromJson — unknown future version', () => {
  it('throws Error with version number when version > 1', async () => {
    const file = makeJsonFile({
      version: 99,
      exportedAt: new Date().toISOString(),
      schedule: makeSchedule(),
    });

    await expect(importScheduleFromJson(file)).rejects.toThrow('Unknown JSON version: 99');
  });
});

describe('importScheduleFromJson — corrupt JSON', () => {
  it('throws on invalid JSON', async () => {
    const file = new File(['not valid json{{{'], 'bad.json', { type: 'application/json' });
    await expect(importScheduleFromJson(file)).rejects.toThrow();
  });
});
