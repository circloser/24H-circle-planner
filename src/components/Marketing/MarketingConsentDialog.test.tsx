import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AUTO_ASK_DELAY_MS, MarketingConsent } from './MarketingConsentDialog';
import { MARKETING_CONSENT_VERSION, wasRecentlyDismissed } from '@/lib/marketing';

const auth = { user: { id: 'u1', email: 'a@example.com', provider: 'google' } as { id: string; email: string; provider: string } | null, loading: false };
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

async function waitOutTheDelay() {
  await act(async () => { vi.advanceTimersByTime(AUTO_ASK_DELAY_MS); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  auth.user = { id: 'u1', email: 'a@example.com', provider: 'google' };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('MarketingConsent', () => {
  it('asks a signed-in user who has never answered, after they settle in', async () => {
    mockFetch(undecided);
    render(<MarketingConsent manageOpen={false} onManageClose={() => {}} suppressAutoAsk={false} />);
    expect(screen.queryByText('marketing.title')).toBeNull();
    await waitOutTheDelay();
    expect(screen.getByText('marketing.title')).toBeTruthy();
    // The legally required disclosures are on screen with the question.
    expect(screen.getByText('marketing.items')).toBeTruthy();
    expect(screen.getByText('marketing.purpose')).toBeTruthy();
    expect(screen.getByText('marketing.retention')).toBeTruthy();
    expect(screen.getByText('marketing.refuse')).toBeTruthy();
  });

  it('never asks someone who already answered, a signed-out visitor, or over another flow', async () => {
    mockFetch({ ...undecided, decided: true });
    const { unmount } = render(<MarketingConsent manageOpen={false} onManageClose={() => {}} suppressAutoAsk={false} />);
    await waitOutTheDelay();
    expect(screen.queryByText('marketing.title')).toBeNull();
    unmount();

    const fetchMock = mockFetch(undecided);
    auth.user = null;
    const second = render(<MarketingConsent manageOpen={false} onManageClose={() => {}} suppressAutoAsk={false} />);
    await waitOutTheDelay();
    expect(screen.queryByText('marketing.title')).toBeNull();
    second.unmount();

    auth.user = { id: 'u1', email: 'a@example.com', provider: 'google' };
    render(<MarketingConsent manageOpen={false} onManageClose={() => {}} suppressAutoAsk />);
    await waitOutTheDelay();
    expect(screen.queryByText('marketing.title')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('records nothing until a button is pressed, then sends exactly that answer', async () => {
    const fetchMock = mockFetch(undecided);
    render(<MarketingConsent manageOpen={false} onManageClose={() => {}} suppressAutoAsk={false} />);
    await waitOutTheDelay();
    expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit | undefined)?.method !== 'PUT')).toBe(true);

    await act(async () => { fireEvent.click(screen.getByText('marketing.accept')); });
    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');
    expect(JSON.parse(String((put![1] as RequestInit).body))).toEqual({ optIn: true, version: MARKETING_CONSENT_VERSION });
  });

  it('gives both answers the same styling, so neither is nudged', async () => {
    mockFetch(undecided);
    render(<MarketingConsent manageOpen={false} onManageClose={() => {}} suppressAutoAsk={false} />);
    await waitOutTheDelay();
    const yes = screen.getByText('marketing.accept').closest('button')!;
    const no = screen.getByText('marketing.decline').closest('button')!;
    expect(yes.className).toBe(no.className);
  });

  it('treats closing without answering as "later", not as an answer', async () => {
    const fetchMock = mockFetch(undecided);
    render(<MarketingConsent manageOpen={false} onManageClose={() => {}} suppressAutoAsk={false} />);
    await waitOutTheDelay();
    await act(async () => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' }); });
    expect(wasRecentlyDismissed()).toBe(true);
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false);
  });
});
