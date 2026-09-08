import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../track', () => ({ track: vi.fn() }));

describe('persistence truth and recovery', () => {
  beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); localStorage.clear(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('exports a restorable backup retaining other saved data and overlaying unsaved changes', async () => {
    const p = await import('../persistence');
    const { importAllData } = await import('../backup');
    localStorage.setItem('24h-circle-planner.theme', 'dark');
    localStorage.setItem('foreign-secret', 'excluded');
    p.persistLocal('24h-circle-planner.days', { latest: 3 }, 500);
    const text = p.createPersistenceBackup();
    expect(text).not.toContain('foreign-secret');
    localStorage.clear();
    const count = await importAllData({ text: async () => text } as File);
    expect(count).toBe(2);
    expect(localStorage.getItem('24h-circle-planner.theme')).toBe('dark');
    expect(JSON.parse(localStorage.getItem('24h-circle-planner.days')!)).toEqual({ latest: 3 });
  });

  it('keeps a days failure visible when the schedule cache succeeds, and retries the latest days', async () => {
    const p = await import('../persistence');
    const realSet = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === '24h-circle-planner.days') throw new DOMException('Full', 'QuotaExceededError');
      return realSet.call(localStorage, key, value);
    });
    p.persistLocal('24h-circle-planner.days', { latest: 1 });
    p.persistLocal('24h-circle-planner.schedule', { cache: true }, 500);
    vi.advanceTimersByTime(500);
    expect(p.getPersistenceStatus()).toBe('failed');
    p.persistLocal('24h-circle-planner.days', { latest: 2 });
    expect(JSON.parse(JSON.parse(p.createPersistenceBackup()).data['24h-circle-planner.days'])).toEqual({ latest: 2 });
    spy.mockRestore();
    p.retryPersistence();
    expect(p.getPersistenceStatus()).toBe('saved');
    expect(JSON.parse(localStorage.getItem('24h-circle-planner.days')!)).toEqual({ latest: 2 });
  });

  it('does not mark pending changes saved after an older deadline and retry cancels pending writes', async () => {
    const p = await import('../persistence');
    p.persistLocal('24h-circle-planner.schedule', { revision: 1 }, 500);
    vi.advanceTimersByTime(300);
    p.persistLocal('24h-circle-planner.schedule', { revision: 2 }, 500);
    vi.advanceTimersByTime(200);
    expect(p.getPersistenceStatus()).toBe('saving');
    expect(localStorage.getItem('24h-circle-planner.schedule')).toBeNull();
    p.retryPersistence();
    expect(p.getPersistenceStatus()).toBe('saved');
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    vi.advanceTimersByTime(500);
    expect(spy).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('24h-circle-planner.schedule')!)).toEqual({ revision: 2 });
  });
});

