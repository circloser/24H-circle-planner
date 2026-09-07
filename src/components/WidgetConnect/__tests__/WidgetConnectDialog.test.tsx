import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WidgetConnectDialog } from '../WidgetConnectDialog';

const mocks = vi.hoisted(() => ({ publish: vi.fn() }));
vi.mock('@/hooks/usePreferences', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  useChartView: () => '24h',
  useNowLineStyle: () => ({ color: '#000' }),
  usePreferences: () => ({ prefs: { language: 'en' } }),
}));
vi.mock('@/lib/widget/publish', () => ({
  clearWidgetToken: vi.fn(), deleteWidgetSlot: vi.fn(), ensureWidgetToken: () => 'token',
  isDarkTheme: () => false, publishWidget: mocks.publish, readWidgetToken: () => null,
  widgetMeta: () => ({}),
}));
vi.mock('@/lib/chart-view', () => ({ viewSpec: () => ({}) }));
vi.mock('@/lib/track', () => ({ track: vi.fn() }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));
afterEach(() => { cleanup(); mocks.publish.mockReset(); });

describe('WidgetConnectDialog sessions', () => {
  it('waits for a fresh publish after reopening and ignores the previous session result', async () => {
    let resolveFirst!: (ok: boolean) => void;
    let resolveSecond!: (ok: boolean) => void;
    const first = new Promise<boolean>((resolve) => { resolveFirst = resolve; });
    const second = new Promise<boolean>((resolve) => { resolveSecond = resolve; });
    mocks.publish.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const props = { onOpenChange: vi.fn(), svgRef: { current: document.createElementNS('http://www.w3.org/2000/svg', 'svg') } };
    const { rerender } = render(<WidgetConnectDialog {...props} open />);
    expect((screen.getByRole('button', { name: 'homewidget.preparing' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<WidgetConnectDialog {...props} open={false} />);
    rerender(<WidgetConnectDialog {...props} open />);
    expect(mocks.publish).toHaveBeenCalledTimes(2);
    await act(async () => { resolveFirst(true); await first; });
    expect((screen.getByRole('button', { name: 'homewidget.preparing' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { resolveSecond(true); await second; });
    expect((screen.getByRole('button', { name: 'homewidget.connect' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
