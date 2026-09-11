import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { localDate } from '@/lib/marketing';

/**
 * Admin-only: who is on the mailing list. Opened from ⚙ → 관리자.
 *
 * Shows only people who explicitly joined (see worker/marketing.ts), newest
 * first, with the date each one agreed. Unsubscribe tokens are never sent to
 * this view; they come only inside the CSV, where each belongs in that
 * person's email.
 */
interface Counts {
  optedIn: number;
  declined: number;
  undecided: number;
  version: string;
}

interface Subscriber {
  email: string;
  agreedAt: number;
}

export function MailingListDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[] | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [countsRes, listRes] = await Promise.all([
        fetch('/api/admin/marketing', { credentials: 'include' }),
        fetch('/api/admin/marketing?format=list', { credentials: 'include' }),
      ]);
      const status = !countsRes.ok ? countsRes.status : !listRes.ok ? listRes.status : 200;
      if (status !== 200) {
        setCounts(null);
        setSubscribers(null);
        setErr(status === 401 ? '로그인이 필요합니다.' : status === 403 ? '관리자만 볼 수 있습니다.' : '목록을 불러오지 못했습니다.');
        return;
      }
      setCounts((await countsRes.json()) as Counts);
      const list = (await listRes.json()) as { subscribers: Subscriber[]; total: number; limit: number };
      setSubscribers(list.subscribers);
      setLimit(list.total >= list.limit ? list.limit : null);
    } catch {
      setErr('네트워크 오류로 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const exportCsv = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/admin/marketing?format=csv', { credentials: 'include' });
      if (!res.ok) { setErr('CSV를 내려받지 못했습니다.'); return; }
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `24houring-mailing-list-${localDate(Date.now())}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setErr('네트워크 오류로 내려받지 못했습니다.');
    } finally {
      setExporting(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // Defer out of the effect body so the initial setState isn't synchronous.
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [open, load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (subscribers ?? []).filter((s) => !q || s.email.toLowerCase().includes(q));
  }, [subscribers, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>메일링 리스트 가입자</DialogTitle>
        </DialogHeader>

        {err && <p className="text-sm text-destructive">{err}</p>}
        {loading && !subscribers && <p className="text-sm text-muted-foreground">불러오는 중…</p>}

        {counts && subscribers && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground" data-mailing-counts>
              가입 <strong>{counts.optedIn.toLocaleString('ko-KR')}</strong>명 · 거부·해지 {counts.declined.toLocaleString('ko-KR')}명 · 미응답 {counts.undecided.toLocaleString('ko-KR')}명
            </p>

            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이메일 검색"
              aria-label="이메일 검색"
            />

            <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
              {shown.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  {subscribers.length === 0 ? '아직 가입한 사람이 없습니다.' : '검색 결과가 없습니다.'}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="w-12 px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">이메일</th>
                      <th className="w-28 px-3 py-2 font-medium">가입일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((s, i) => (
                      <tr key={s.email} className="border-t border-border" data-mailing-row>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="break-all px-3 py-1.5 text-foreground">{s.email}</td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">{localDate(s.agreedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {limit !== null && (
              <p className="text-xs text-muted-foreground">최근 {limit.toLocaleString('ko-KR')}명까지만 표시합니다. 전체는 CSV로 받으세요.</p>
            )}

            <p className="text-xs text-muted-foreground">
              직접 가입한 사람만 표시됩니다. 메일을 보낼 때는 CSV에 있는 사람별 수신 거부 링크를 그 사람의 메일에 넣으세요.
            </p>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                새로고침
              </Button>
              <Button variant="outline" size="sm" onClick={() => void exportCsv()} disabled={exporting || counts.optedIn === 0}>
                CSV 내려받기
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
