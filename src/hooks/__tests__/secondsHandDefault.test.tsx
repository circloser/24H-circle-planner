import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const PREFS_KEY = '24h-circle-planner.prefs';
const FLIP_KEY = '24h-circle-planner.seconds-hand-off-v1';

/** Renders the seconds-hand setting as text, through the real provider. */
async function readSecondsHand(): Promise<boolean> {
  const { PreferencesProvider, useSecondsHand } = await import('../usePreferences');
  function Probe() {
    return <span data-testid="on">{String(useSecondsHand().on)}</span>;
  }
  render(
    <PreferencesProvider>
      <Probe />
    </PreferencesProvider>,
  );
  return screen.getByTestId('on').textContent === 'true';
}

const savedWith = (showSecondsHand: boolean) =>
  localStorage.setItem(PREFS_KEY, JSON.stringify({ version: 1, prefs: { language: 'ko', showSecondsHand } }));

beforeEach(() => { vi.resetModules(); localStorage.clear(); });
afterEach(() => { cleanup(); });

describe('seconds hand default', () => {
  it('is off for a brand-new visitor', async () => {
    expect(await readSecondsHand()).toBe(false);
  });

  it('turns itself off once for a profile carrying the old default', async () => {
    // Every existing profile has the old `true` written into it, so flipping the
    // default alone would reach nobody who has ever used the app.
    savedWith(true);
    expect(await readSecondsHand()).toBe(false);
    expect(localStorage.getItem(FLIP_KEY)).toBe('1');
  });

  it('never runs twice, so turning it back on sticks', async () => {
    savedWith(true);
    expect(await readSecondsHand()).toBe(false); // the one-time flip
    cleanup();

    // The user goes to Settings and switches it back on; that is saved.
    savedWith(true);
    vi.resetModules();
    expect(await readSecondsHand()).toBe(true);
  });

  it('leaves the profile alone when storage cannot be written', async () => {
    savedWith(true);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    // No marker can be stored, so flipping would repeat on every load and
    // override the user forever — better to leave the saved value standing.
    expect(await readSecondsHand()).toBe(true);
    spy.mockRestore();
  });
});
