import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ChartViewToggle } from './ChartViewToggle';
const setPreference = vi.fn();
let chartView = 'full';
vi.mock('@/hooks/usePreferences', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  usePreferences: () => ({ prefs: { chartView }, setPreference }),
}));
afterEach(() => { cleanup(); setPreference.mockClear(); chartView = 'full'; });
describe('ChartViewToggle', () => {
  it('selects record directly without cycling through intermediate views', async () => {
    render(<ChartViewToggle />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'view.select' }), { key: 'Enter' });
    const record = await screen.findByRole('menuitemradio', { name: 'view.record' });
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(5);
    fireEvent.click(record);
    expect(setPreference).toHaveBeenCalledExactlyOnceWith('chartView', 'record');
  });

  it('goes straight back to the timetable from the calendar, with no menu', () => {
    // Leaving the calendar returns to the view that was on before it.
    const { rerender } = render(<ChartViewToggle />);
    chartView = 'table';
    rerender(<ChartViewToggle />);
    chartView = 'calendar';
    rerender(<ChartViewToggle />);
    const button = screen.getByRole('button', { name: 'view.table' });
    fireEvent.click(button);
    expect(screen.queryAllByRole('menuitemradio')).toHaveLength(0);
    expect(setPreference).toHaveBeenCalledExactlyOnceWith('chartView', 'table');
  });
});
