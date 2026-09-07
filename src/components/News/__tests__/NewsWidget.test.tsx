import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsWidget } from '../NewsWidget';
import { NEWS_SYNC_EVENT, NEWS_WINDOWS_KEY } from '@/lib/sync/widgetSync';

vi.mock('@/hooks/usePreferences', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  usePreferences: () => ({ prefs: { newsOpen: true }, setPreference: vi.fn() }),
}));

const windowConfig = (q: string) => [{ id: 'news-test', q, country: 'US', intervalH: 24, pos: { x: 0, y: 0 } }];
function result(title: string) {
  return { ok: true, json: async () => ({ items: [{ title, link: 'https://example.com', source: '', pubDate: '' }] }) } as Response;
}

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('NewsWidget requests', () => {
  it('does not let an older query overwrite current headlines or cache', async () => {
    let resolveOld!: (value: Response) => void;
    const oldRequest = new Promise<Response>((resolve) => { resolveOld = resolve; });
    const fetchMock = vi.fn().mockReturnValueOnce(oldRequest).mockResolvedValueOnce(result('New headline'));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem(NEWS_WINDOWS_KEY, JSON.stringify(windowConfig('old')));
    render(<NewsWidget />);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      localStorage.setItem(NEWS_WINDOWS_KEY, JSON.stringify(windowConfig('new')));
      window.dispatchEvent(new Event(NEWS_SYNC_EVENT));
    });
    await screen.findByText('New headline');
    await act(async () => { resolveOld(result('Old headline')); await oldRequest; });
    expect(screen.queryByText('Old headline')).toBeNull();
    expect(JSON.parse(localStorage.getItem('24h-news.cache.news-test')!).q).toBe('new');
  });

  it('uses a fresh matching cache and still supports manual refresh', async () => {
    const fetchMock = vi.fn().mockResolvedValue(result('Refreshed headline'));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem(NEWS_WINDOWS_KEY, JSON.stringify(windowConfig('cached')));
    localStorage.setItem('24h-news.cache.news-test', JSON.stringify({ q: 'cached', country: 'US', fetchedAt: Date.now(), items: [{ title: 'Cached headline', link: 'https://example.com', source: '', pubDate: '' }] }));
    render(<NewsWidget />);
    expect(screen.getByText('Cached headline')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'news.refresh' }));
    await screen.findByText('Refreshed headline');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
