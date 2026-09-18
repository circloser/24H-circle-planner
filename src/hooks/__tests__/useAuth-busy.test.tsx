import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { AuthProvider, useAuth } from '../useAuth';

function Who() {
  const { user, plan, loading } = useAuth();
  return <span data-testid="who">{loading ? 'loading' : `${user?.email ?? 'none'}:${plan}`}</span>;
}

const me = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const busy = () => new Response(JSON.stringify({ error: 'server_busy' }), { status: 503 });

describe('signed-in state when the server’s database is busy', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps the last confirmed session instead of signing the device out', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(me({ user: { id: 'u1', email: 'a@b.c', provider: 'google' }, plan: 'pro' }));
    render(<AuthProvider><Who /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('a@b.c:pro'));
    cleanup();

    vi.mocked(fetch).mockResolvedValueOnce(busy());
    render(<AuthProvider><Who /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('a@b.c:pro'));
  });

  it('forgets it once the server says there is no session', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(me({ user: { id: 'u1', email: 'a@b.c', provider: 'google' }, plan: 'pro' }));
    render(<AuthProvider><Who /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('a@b.c:pro'));
    cleanup();
    vi.mocked(fetch).mockResolvedValueOnce(me({ user: null }));
    render(<AuthProvider><Who /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('none:free'));
    cleanup();
    vi.mocked(fetch).mockResolvedValueOnce(busy());
    render(<AuthProvider><Who /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('none:free'));
  });

  it('a plain failure is still signed out', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(me({ user: { id: 'u1', email: 'a@b.c', provider: 'google' }, plan: 'pro' }));
    render(<AuthProvider><Who /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('a@b.c:pro'));
    cleanup();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('boom', { status: 500 }));
    render(<AuthProvider><Who /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('none:free'));
  });
});
