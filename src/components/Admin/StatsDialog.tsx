import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Admin-only anonymous stats dashboard (opened via #stats). Shows COUNTS ONLY —
 * signups / logins / active users / sync users / Pro subs / push devices — from
 * the admin-gated /api/admin/stats endpoint. Timetable and diary CONTENT are
 * never stored server-side, so nothing here can reveal what anyone wrote.
 */
interface Stats {
  totals: { users: number; syncUsers: number; pushDevices: number; pushUsers: number; grants: number; proSubs: number };
  active7d: number;
  daily: { day: string; signups: number; logins: number }[];
  generatedAt: number;
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <div className="text-lg font-bold text-foreground">{value.toLocaleString('ko-KR')}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function DailyChart({ daily }: { daily: Stats['daily'] }) {
  const W = 600, H = 170, PAD = 26;
  const n = daily.length;
  const max = Math.max(1, ...daily.flatMap((d) => [d.signups, d.logins]));
  const colW = (W - PAD * 2) / n;
  const barW = Math.max(2, colW / 2 - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 460 }} role="img" aria-label="최근 30일 가입·로그인">
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="hsl(var(--border))" />
        {daily.map((d, i) => {
          const x = PAD + i * colW;
          return (
            <g key={d.day}>
              <rect x={x} y={y(d.signups)} width={barW} height={H - PAD - y(d.signups)} fill="hsl(var(--primary))" rx={1}>
                <title>{`${d.day} · 가입 ${d.signups}`}</title>
              </rect>
              <rect x={x + barW + 1} y={y(d.logins)} width={barW} height={H - PAD - y(d.logins)} fill="hsl(var(--muted-foreground))" opacity={0.5} rx={1}>
                <title>{`${d.day} · 로그인 ${d.logins}`}</title>
              </rect>
              {(i % 7 === 0 || i === n - 1) && (
                <text x={x} y={H - PAD + 13} fontSize={9} fill="hsl(var(--text-muted))">{d.day.slice(5)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: 'hsl(var(--primary))' }} /> 가입</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: 'hsl(var(--muted-foreground))', opacity: 0.5 }} /> 로그인</span>
      </div>
    </div>
  );
}

export function StatsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [data, setData] = useState<Stats | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/admin/stats', { credentials: 'include' });
      if (res.status === 401) { setErr('로그인이 필요합니다.'); setData(null); return; }
      if (res.status === 403) { setErr('관리자만 볼 수 있습니다.'); setData(null); return; }
      if (!res.ok) { setErr('통계를 불러오지 못했습니다.'); setData(null); return; }
      setData((await res.json()) as Stats);
    } catch {
      setErr('네트워크 오류로 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // Defer out of the effect body so the initial setState isn't synchronous.
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>관리자 통계</DialogTitle>
        </DialogHeader>

        {err && <p className="text-sm text-destructive">{err}</p>}
        {loading && !data && <p className="text-sm text-muted-foreground">불러오는 중…</p>}

        {data && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              <Tile label="총 사용자" value={data.totals.users} />
              <Tile label="클라우드 동기화" value={data.totals.syncUsers} />
              <Tile label="활성 (7일)" value={data.active7d} />
              <Tile label="Pro 구독" value={data.totals.proSubs} />
              <Tile label="쿠폰 발급" value={data.totals.grants} />
              <Tile label="푸시 기기" value={data.totals.pushDevices} />
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">최근 30일 · 가입 / 로그인</p>
              <DailyChart daily={data.daily} />
            </div>

            <p className="text-xs text-muted-foreground">
              시간표·일기 <strong>내용</strong>은 서버에 저장하지 않아 표시할 수 없습니다(개인정보 보호). 위 숫자는 익명 집계입니다.
            </p>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                {new Date(data.generatedAt).toLocaleString('ko-KR')}
              </span>
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                새로고침
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
