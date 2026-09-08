// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync('public/sw.js', 'utf8');
type FetchEvent = { request: { url: string; method: string; mode: string }; respondWith: (response: Promise<Response>) => void };

function harness() {
  const entries = new Map<string, Response>([['/', new Response('planner', { headers: { 'content-type': 'text/html' } })]]);
  const fetch = vi.fn().mockResolvedValue(new Response('new planner', { headers: { 'content-type': 'text/html; charset=utf-8' } }));
  const removeCache = vi.fn().mockResolvedValue(true);
  const listeners: Record<string, (event: unknown) => void> = {};
  const cache = { put: vi.fn(async (key: string, response: Response) => { entries.set(key, response); }), addAll: vi.fn().mockResolvedValue(undefined) };
  runInNewContext(source, {
    URL, Response, fetch,
    caches: { open: vi.fn().mockResolvedValue(cache), match: async (key: string) => entries.get(key)?.clone(), keys: async () => ['24h-cache-v10', '24h-cache-v11'], delete: removeCache },
    self: { location: { origin: 'https://24houring.com' }, addEventListener: (name: string, cb: (event: unknown) => void) => { listeners[name] = cb; }, clients: { claim: vi.fn() } },
  });
  function navigate(path: string, mode = 'navigate') {
    const respondWith = vi.fn();
    const event: FetchEvent = { request: { url: `https://24houring.com${path}`, method: 'GET', mode }, respondWith };
    listeners.fetch(event);
    return { intercepted: respondWith.mock.calls.length > 0, response: respondWith.mock.calls[0]?.[0] as Promise<Response> | undefined };
  }
  return { entries, fetch, cache, navigate, listeners, removeCache };
}

describe('offline app shell navigation isolation', () => {
  it('visiting a guide cannot replace the offline planner shell', async () => {
    const h = harness();
    h.fetch.mockResolvedValue(new Response('article', { headers: { 'content-type': 'text/html' } }));
    expect(h.navigate('/guides/time-blocking').intercepted).toBe(false);
    expect(h.fetch).not.toHaveBeenCalled();
    h.fetch.mockRejectedValue(new Error('offline'));
    const response = await h.navigate('/').response;
    expect(await response!.text()).toBe('planner');
    expect(h.cache.put).not.toHaveBeenCalled();
  });

  it.each(['/faq', '/s/abc123', '/api/auth/google/start', '/api/sync', '/missing', '/ko/guides/time-blocking'])('leaves %s navigation to the network', (path) => {
    const h = harness();
    expect(h.navigate(path).intercepted).toBe(false);
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it.each(['/', '/index.html', '/ko/', '/de/', '/ja/', '/zh/', '/fr/', '/es/', '/ru/'])('caches a valid app entry %s at its own path', async (path) => {
    const h = harness();
    const response = await h.navigate(path).response;
    expect(await response!.text()).toBe('new planner');
    expect(h.cache.put).toHaveBeenCalledWith(path, expect.any(Response));
    if (path !== '/') expect(await h.entries.get('/')!.text()).toBe('planner');
  });

  it.each([404, 500, 206])('does not replace the shell with HTTP %s HTML', async (status) => {
    const h = harness();
    h.fetch.mockResolvedValue(new Response('error page', { status, headers: { 'content-type': 'text/html' } }));
    expect((await h.navigate('/').response)!.status).toBe(status);
    h.fetch.mockRejectedValue(new Error('offline'));
    expect(await (await h.navigate('/').response)!.text()).toBe('planner');
  });

  it('does not cache redirected HTML or a successful non-HTML response', async () => {
    const h = harness();
    const redirected = new Response('redirect target', { headers: { 'content-type': 'text/html' } });
    Object.defineProperty(redirected, 'redirected', { value: true });
    h.fetch.mockResolvedValueOnce(redirected).mockResolvedValueOnce(new Response('{}', { headers: { 'content-type': 'application/json' } }));
    await h.navigate('/').response;
    await h.navigate('/').response;
    expect(h.cache.put).not.toHaveBeenCalled();
  });

  it('falls back to the visited locale shell, then the root shell if unavailable', async () => {
    const h = harness();
    await h.navigate('/ko/').response;
    h.fetch.mockRejectedValue(new Error('offline'));
    expect(await (await h.navigate('/ko/').response)!.text()).toBe('new planner');
    expect(await (await h.navigate('/ja/').response)!.text()).toBe('planner');
  });

  it('removes the previously poisoned cache version during activation', async () => {
    const h = harness();
    const waitUntil = vi.fn();
    h.listeners.activate({ waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(h.removeCache).toHaveBeenCalledExactlyOnceWith('24h-cache-v10');
  });
});
