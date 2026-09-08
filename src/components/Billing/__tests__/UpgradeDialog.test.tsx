import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpgradeDialog } from '../UpgradeDialog';

const checkout = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/hooks/usePreferences', () => ({ useTranslation: () => ({ t: (key: string) => key, lang: 'en' }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test' }, login: vi.fn(), refresh: vi.fn(), admin: false }) }));
vi.mock('@/lib/sync/billing', () => ({ startCheckout: checkout }));
vi.mock('@/lib/twa', () => ({ isPlayStoreApp: () => false }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); checkout.mockClear(); });

describe('UpgradeDialog price confirmation', () => {
  it('blocks checkout during loading and after an invalid price, then supports retry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ prices: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ prices: [{ amount: 199, currency: 'usd', interval: 'month' }] }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<UpgradeDialog open onOpenChange={() => {}} />);
    const cta = screen.getByRole('button', { name: 'upgrade.cta' });
    expect((cta as HTMLButtonElement).disabled).toBe(true);
    await screen.findByText('upgrade.priceError');
    fireEvent.click(cta);
    expect(checkout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'upgrade.priceRetry' }));
    await waitFor(() => expect((cta as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByText('$1.99 / upgrade.perMonth')).toBeTruthy();
    fireEvent.click(cta);
    expect(checkout).toHaveBeenCalledOnce();
  });

  it('shows a recoverable error when the price request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<UpgradeDialog open onOpenChange={() => {}} />);
    await screen.findByText('upgrade.priceError');
    expect((screen.getByRole('button', { name: 'upgrade.cta' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('discards the previous session price on programmatic reopen', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ prices: [{ amount: 199, currency: 'usd', interval: 'month' }] }) })
      .mockImplementationOnce(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<UpgradeDialog open onOpenChange={() => {}} />);
    await screen.findByText('$1.99 / upgrade.perMonth');
    rerender(<UpgradeDialog open={false} onOpenChange={() => {}} />);
    rerender(<UpgradeDialog open onOpenChange={() => {}} />);
    expect(screen.queryByText('$1.99 / upgrade.perMonth')).toBeNull();
    expect((screen.getByRole('button', { name: 'upgrade.cta' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
