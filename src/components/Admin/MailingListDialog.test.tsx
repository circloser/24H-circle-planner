import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MailingListDialog } from './MailingListDialog';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubAdminApi(status = 200) {
  const fetchMock = vi.fn(async (url: string) => {
    if (status !== 200) return new Response('{}', { status });
    if (url.includes('format=list')) {
      return new Response(JSON.stringify({
        subscribers: [
          { email: 'newest@example.com', agreedAt: Date.UTC(2026, 8, 11, 3) },
          { email: 'older@example.com', agreedAt: Date.UTC(2026, 8, 10, 3) },
        ],
        total: 2,
        limit: 10000,
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ optedIn: 2, declined: 1, undecided: 5, version: 'v' }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('MailingListDialog (admin)', () => {
  it('lists who joined, with counts, and filters by email', async () => {
    stubAdminApi();
    render(<MailingListDialog open onOpenChange={() => {}} />);

    expect(await screen.findByText('newest@example.com')).toBeTruthy();
    expect(screen.getByText('older@example.com')).toBeTruthy();
    expect(document.querySelectorAll('[data-mailing-row]')).toHaveLength(2);
    expect(document.querySelector('[data-mailing-counts]')!.textContent).toMatch(/가입\s*2명.*거부·해지 1명.*미응답 5명/);

    fireEvent.change(screen.getByLabelText('이메일 검색'), { target: { value: 'OLDER' } });
    expect(document.querySelectorAll('[data-mailing-row]')).toHaveLength(1);
    expect(screen.queryByText('newest@example.com')).toBeNull();

    fireEvent.change(screen.getByLabelText('이메일 검색'), { target: { value: 'nobody' } });
    expect(screen.getByText('검색 결과가 없습니다.')).toBeTruthy();
  });

  it('shows nothing but a refusal to a non-admin', async () => {
    stubAdminApi(403);
    render(<MailingListDialog open onOpenChange={() => {}} />);
    expect(await screen.findByText('관리자만 볼 수 있습니다.')).toBeTruthy();
    expect(document.querySelectorAll('[data-mailing-row]')).toHaveLength(0);
  });

  it('asks the server for nothing while closed', () => {
    const fetchMock = stubAdminApi();
    render(<MailingListDialog open={false} onOpenChange={() => {}} />);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
