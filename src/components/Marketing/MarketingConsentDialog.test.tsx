import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MarketingConsent } from './MarketingConsentDialog';
import { MARKETING_CONSENT_VERSION, consumeMarketingResume } from '@/lib/marketing';

const login = vi.fn();
const auth = {
  user: { id: 'u1', email: 'a@example.com', provider: 'google' } as { id: string; email: string; provider: string } | null,
  loading: false,
  login,
};
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/usePreferences', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const undecided = { decided: false, optIn: false, version: MARKETING_CONSENT_VERSION, decidedAt: null };

function mockFetch(getState: object) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const { optIn } = JSON.parse(String(init.body)) as { optIn: boolean };
      return new Response(JSON.stringify({ decided: true, optIn, version: MARKETING_CONSENT_VERSION, decidedAt: Date.now() }), { status: 200 });
    }
    return new Response(JSON.stringify(getState), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const isPut = ([, init]: unknown[]) => (init as RequestInit | undefined)?.method === 'PUT';

beforeEach(() => {
  sessionStorage.clear();
  login.mockReset();
  auth.user = { id: 'u1', email: 'a@example.com', provider: 'google' };
  auth.loading = false;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('MarketingConsent (mailing list)', () => {
  it('never opens on its own, however long a signed-in user stays', async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetch(undecided);
    render(<MarketingConsent open={false} onOpenChange={() => {}} />);
    await act(async () => { vi.advanceTimersByTime(10 * 60 * 1000); });
    expect(screen.queryByText('marketing.title')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('opened from settings, shows the disclosures and the current choice', async () => {
    mockFetch({ decided: true, optIn: true, version: MARKETING_CONSENT_VERSION, decidedAt: Date.UTC(2026, 8, 11) });
    render(<MarketingConsent open onOpenChange={() => {}} />);
    expect(screen.getByText('marketing.items')).toBeTruthy();
    expect(screen.getByText('marketing.purpose')).toBeTruthy();
    expect(screen.getByText('marketing.retention')).toBeTruthy();
    expect(screen.getByText('marketing.refuse')).toBeTruthy();
    expect(await screen.findByText('marketing.currentIn')).toBeTruthy();
  });

  it('records nothing until a button is pressed, then sends exactly that answer', async () => {
    const fetchMock = mockFetch(undecided);
    const onOpenChange = vi.fn();
    render(<MarketingConsent open onOpenChange={onOpenChange} />);
    await act(async () => { await Promise.resolve(); });
    expect(fetchMock.mock.calls.some(isPut)).toBe(false);

    await act(async () => { fireEvent.click(screen.getByText('marketing.accept')); });
    const put = fetchMock.mock.calls.find(isPut);
    expect(JSON.parse(String((put![1] as RequestInit).body))).toEqual({ optIn: true, version: MARKETING_CONSENT_VERSION });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('gives both answers the same styling, so neither is nudged', async () => {
    mockFetch(undecided);
    render(<MarketingConsent open onOpenChange={() => {}} />);
    const yes = screen.getByText('marketing.accept').closest('button')!;
    const no = screen.getByText('marketing.decline').closest('button')!;
    expect(yes.className).toBe(no.className);
  });

  it('signed out: offers sign-in instead of answers, and remembers to reopen afterwards', async () => {
    auth.user = null;
    const fetchMock = mockFetch(undecided);
    render(<MarketingConsent open onOpenChange={() => {}} />);
    expect(screen.getByText('marketing.signInBody')).toBeTruthy();
    expect(screen.queryByText('marketing.accept')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('auth.login'));
    expect(login).toHaveBeenCalledTimes(1);
    expect(consumeMarketingResume()).toBe(true);
    expect(consumeMarketingResume()).toBe(false); // one round trip only
  });
});
