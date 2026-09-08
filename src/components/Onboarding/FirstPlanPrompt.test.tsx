import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { FirstPlanPrompt } from './FirstPlanPrompt';
vi.mock('@/hooks/usePreferences', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
describe('FirstPlanPrompt', () => {
  it('offers direct creation and templates without a modal blocking the planner', () => {
    const onAdd = vi.fn(); const onTemplates = vi.fn(); const onDismiss = vi.fn();
    render(<FirstPlanPrompt open onAdd={onAdd} onTemplates={onTemplates} onDismiss={onDismiss} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'block.add' }));
    fireEvent.click(screen.getByRole('button', { name: 'welcome.moreGallery' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(onAdd).toHaveBeenCalledOnce(); expect(onTemplates).toHaveBeenCalledOnce(); expect(onDismiss).toHaveBeenCalledOnce();
  });
  it('leaves no prompt controls after dismissal', () => {
    render(<FirstPlanPrompt open={false} onAdd={vi.fn()} onTemplates={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByRole('region')).toBeNull();
  });
});
