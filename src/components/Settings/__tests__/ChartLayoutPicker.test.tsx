import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { PreferencesProvider } from '@/hooks/usePreferences';
import { ChartLayoutPicker } from '../ChartLayoutPicker';

afterEach(() => { cleanup(); localStorage.clear(); });

describe('ChartLayoutPicker', () => {
  it('offers the four layouts and marks the current one', () => {
    const { container } = render(
      <PreferencesProvider>
        <ChartLayoutPicker value="left" onChange={() => {}} />
      </PreferencesProvider>,
    );
    const chips = [...container.querySelectorAll<HTMLButtonElement>('button[data-layout]')];
    expect(chips.map((b) => b.dataset.layout)).toEqual(['center', 'left', 'right', 'hidden']);
    expect(chips.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false']);
    // Every chip carries a visible label, not just the picture.
    expect(chips.every((b) => (b.textContent ?? '').trim().length > 0)).toBe(true);
  });

  it('reports the picked layout', () => {
    const onChange = vi.fn();
    const { container } = render(
      <PreferencesProvider>
        <ChartLayoutPicker value="center" onChange={onChange} />
      </PreferencesProvider>,
    );
    fireEvent.click(container.querySelector('button[data-layout="hidden"]')!);
    expect(onChange).toHaveBeenCalledWith('hidden');
  });
});
