import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ChartViewToggle } from './ChartViewToggle';
const setPreference = vi.fn();
vi.mock('@/hooks/usePreferences', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  usePreferences: () => ({ prefs: { chartView: 'full' }, setPreference }),
}));
afterEach(() => { cleanup(); setPreference.mockClear(); });
describe('ChartViewToggle', () => {
  it('selects record directly without cycling through intermediate views', async () => {
    render(<ChartViewToggle />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'view.select' }), { key: 'Enter' });
    const record = await screen.findByRole('menuitemradio', { name: 'view.record' });
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(5);
    fireEvent.click(record);
    expect(setPreference).toHaveBeenCalledExactlyOnceWith('chartView', 'record');
  });
});
