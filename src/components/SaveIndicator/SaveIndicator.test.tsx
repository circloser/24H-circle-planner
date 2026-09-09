import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SaveIndicator } from './SaveIndicator';
import { SAVED_DWELL_MS, persistLocal, resetPersistence } from '@/lib/persistence';
vi.mock('@/hooks/usePreferences', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); resetPersistence(); });
describe('SaveIndicator', () => {
  it('announces actual failures, offers recovery and only shows saved after a successful retry', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    render(<SaveIndicator />);
    act(() => persistLocal('days', { version: 1 }));
    expect(screen.getByRole('status').textContent).toContain('app.saveFailed');
    expect(screen.getByRole('button', { name: 'app.backupSave' })).toBeTruthy();
    spy.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'app.retrySave' }));
    expect(screen.getByRole('status').textContent).toContain('app.saved');
    expect(screen.queryByRole('button', { name: 'app.retrySave' })).toBeNull();
  });

  it('steps out of the header a few seconds after a save', () => {
    vi.useFakeTimers();
    render(<SaveIndicator />);
    act(() => persistLocal('days', { version: 1 }));
    expect(screen.getByRole('status').textContent).toContain('app.saved');
    act(() => { vi.advanceTimersByTime(SAVED_DWELL_MS); });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
