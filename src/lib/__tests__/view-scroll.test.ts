import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANCHOR_TRIES, openViewAt, opensView, viewAnchor } from '../view-scroll';

describe('what counts as opening a view', () => {
  it('is crossing between the timetable and a page', () => {
    expect(opensView('full', 'calendar')).toBe(true);
    expect(opensView('calendar', 'full')).toBe(true);
    expect(opensView('life', 'calendar')).toBe(true);
    // A reload straight into a page opens it too.
    expect(opensView(undefined, 'life')).toBe(true);
  });

  it('is not the timetable changing its own shape', () => {
    expect(opensView('full', 'day')).toBe(false);
    expect(opensView('table', 'record')).toBe(false);
    expect(opensView(undefined, 'full')).toBe(false);
    expect(opensView('life', 'life')).toBe(false);
  });
});

describe('where a view starts', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('puts today in the middle of the life line', () => {
    const into = vi.fn();
    document.body.innerHTML = '<div data-life-today></div>';
    document.querySelector<HTMLElement>('[data-life-today]')!.scrollIntoView = into;
    openViewAt('life');
    expect(into).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' });
  });

  it('puts the calendar and the timetable at the top', () => {
    const to = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    openViewAt('calendar');
    openViewAt('full');
    expect(to).toHaveBeenCalledTimes(2);
    expect(to).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('waits a few frames for the anchor, then settles for the top', async () => {
    const to = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const frames: Array<() => void> = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(() => cb(0));
      return frames.length;
    });
    openViewAt('life', 2);
    expect(to).not.toHaveBeenCalled();
    while (frames.length) frames.shift()!();
    expect(to).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('knows which views have somewhere of their own to open at', () => {
    expect(viewAnchor('life')).toBe('[data-life-today]');
    expect(viewAnchor('calendar')).toBeNull();
    expect(ANCHOR_TRIES).toBeGreaterThan(0);
  });
});
