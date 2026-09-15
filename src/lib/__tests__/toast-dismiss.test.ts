import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dismiss = vi.fn();
vi.mock('sonner', () => ({ toast: { dismiss: (id: unknown) => dismiss(id) } }));

const { dismissAfterVisible } = await import('../toast-dismiss');

let hidden = false;
const setHidden = (h: boolean) => {
  hidden = h;
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  vi.useFakeTimers();
  dismiss.mockClear();
  hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'hidden');
  vi.restoreAllMocks();
});

describe('dismissAfterVisible', () => {
  it('closes the toast after the given on-screen time', () => {
    dismissAfterVisible('t1', 8000);
    vi.advanceTimersByTime(7999);
    expect(dismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(dismiss).toHaveBeenCalledWith('t1');
  });

  it('does not count time the page is hidden', () => {
    dismissAfterVisible('t2', 8000);
    vi.advanceTimersByTime(3000);
    setHidden(true);
    vi.advanceTimersByTime(60_000);
    expect(dismiss).not.toHaveBeenCalled();
    setHidden(false);
    vi.advanceTimersByTime(4999);
    expect(dismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(dismiss).toHaveBeenCalledWith('t2');
  });

  it('waits until the page is shown when raised in a background tab', () => {
    hidden = true;
    dismissAfterVisible('t3', 8000);
    vi.advanceTimersByTime(30_000);
    expect(dismiss).not.toHaveBeenCalled();
    setHidden(false);
    vi.advanceTimersByTime(8000);
    expect(dismiss).toHaveBeenCalledWith('t3');
  });

  it('closes exactly once and stops listening', () => {
    const removed = vi.spyOn(document, 'removeEventListener');
    dismissAfterVisible('t4', 100);
    vi.advanceTimersByTime(100);
    setHidden(true);
    setHidden(false);
    vi.advanceTimersByTime(1000);
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(removed).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
