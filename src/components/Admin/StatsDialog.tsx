import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Admin-only anonymous stats dashboard (⚙ → 관리자, or #stats). Shows COUNTS
 * ONLY — signups / logins / active users / sync users / Pro subs / push
 * devices — from the admin-gated /api/admin/stats endpoint. Timetable and diary
 * CONTENT are never stored server-side, so nothing here can reveal what anyone
 * wrote. The mailing-list subscribers themselves live in MailingListDialog.
 */
interface FeatureRow { name: string; today: number; d7: number; d28: number }

interface Stats {
  totals: { users: number; syncUsers: number; pushDevices: number; pushUsers: number; grants: number; proSubs: number };
  active7d: number;
  daily: { day: string; signups: number; logins: number }[];
  /** First-party usage counts (worker/metrics.ts); absent on older Workers. */
  features?: FeatureRow[];
  generatedAt: number;
}

/** Readable names for the counted events (the tag after ':' is shown as is). */
const FEATURE_LABEL: Record<string, string> = {
  app_open: '앱 열기',
  calendar_open: '캘린더 열기',
  cal_plan_add: '캘린더 일정 추가',
  ical_connect: '구글 캘린더 연결',
  decor_tool: '꾸미기 도구 열기',
  decor_place: '꾸미기 붙이기',
  paper_set: '속지 변경',
  cal_image: '달력 이미지 저장·공유',
  upgrade_open: 'Pro 안내 열림',
  price_loaded: '가격 표시',
  checkout_start: '결제 시작',
  coupon_redeem: '쿠폰 사용',
  login_start: '로그인 시작',
  schedule_edit: '시간표 편집',
  share: '시간표 공유',
  export: '내보내기',
};

const labelOf = (name: string) => {
  const [event, tag] = name.split(':');
  return `${FEATURE_LABEL[event] ?? event}${tag ? ` · ${tag}` : ''}`;
};

/** Sum of an event over all its tags. */
const total = (rows: FeatureRow[], event: string, key: 'd7' | 'd28') =>
  rows.filter((r) => r.name === event || r.name.startsWith(`${event}:`)).reduce((a, r) => a + r[key], 0);
const one = (rows: FeatureRow[], name: string, key: 'd7' | 'd28') => rows.find((r) => r.name === name)?.[key] ?? 0;
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');

function Features({ rows }: { rows: FeatureRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const key = 'd28' as const;
  const opens = total(rows, 'app_open', key);
  const upgrades = total(rows, 'upgrade_open', key);
  const ratios = [
    { label: '캘린더를 연 세션', value: pct(total(rows, 'calendar_open', key), opens) },
    { label: 'Pro 안내 중 꾸미기에서', value: pct(one(rows, 'upgrade_open:decor', key), upgrades) },
    { label: 'Pro 안내 → 결제 시작', value: pct(total(rows, 'checkout_start', key), upgrades) },
    { label: '꾸미기 안내 → 결제 시작', value: pct(one(rows, 'checkout_start:decor', key), one(rows, 'upgrade_open:decor', key)) },
  ];
  const shown = showAll ? rows : rows.slice(0, 12);
  return (
    <div className="flex flex-col gap-2" data-feature-stats>
      <p className="text-xs font-medium text-muted-foreground">기능 사용 · 최근 28일 비율</p>
      <div className="grid grid-cols-2 gap-2">
        {ratios.map((r) => (
          <div key={r.label} className="rounded-lg border border-border bg-surface px-3 py-2" data-feature-ratio>
            <div className="text-lg font-bold text-foreground">{r.value}</div>
            <div className="text-xs text-muted-foreground">{r.label}</div>
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">아직 집계된 기록이 없습니다.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1 text-left font-medium">기능</th>
              <th className="py-1 text-right font-medium">오늘</th>
              <th className="py-1 text-right font-medium">7일</th>
              <th className="py-1 text-right font-medium">28일</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.name} className="border-t border-border" data-feature-row={r.name}>
                <td className="py-1 text-foreground">{labelOf(r.name)}</td>
                <td className="py-1 text-right tabular-nums">{r.today.toLocaleString('ko-KR')}</td>
                <td className="py-1 text-right tabular-nums">{r.d7.toLocaleString('ko-KR')}</td>
                <td className="py-1 text-right tabular-nums">{r.d28.toLocaleString('ko-KR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > 12 && (
        <button type="button" className="self-start text-xs text-primary underline" onClick={() => setShowAll((v) => !v)}>
          {showAll ? '접기' : `전체 ${rows.length}개 보기`}
        </button>
      )}
      <p className="text-xs text-muted-foreground">
        횟수만 셉니다(사용자·기기 구분 없음). 앱 열기·캘린더 열기는 페이지를 열 때마다 한 번씩입니다.
      </p>
    </div>
  );
}

interface MarketingCounts {
  optedIn: number;
  declined: number;
  undecided: number;
  version: string;
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
  const [marketing, setMarketing] = useState<MarketingCounts | null>(null);
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
      // Mailing-list counts are best-effort: the dashboard stays useful without them.
      const m = await fetch('/api/admin/marketing', { credentials: 'include' }).catch(() => null);
      setMarketing(m?.ok ? ((await m.json()) as MarketingCounts) : null);
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

            {data.features && <Features rows={data.features} />}

            {marketing && (
              <div className="flex flex-col gap-2" data-marketing-admin>
                <p className="text-xs font-medium text-muted-foreground">메일링 리스트</p>
                <div className="grid grid-cols-3 gap-2">
                  <Tile label="가입" value={marketing.optedIn} />
                  <Tile label="거부·해지" value={marketing.declined} />
                  <Tile label="미응답" value={marketing.undecided} />
                </div>
                <p className="text-xs text-muted-foreground">가입자 목록과 CSV는 ⚙ → 관리자 → 메일링 리스트 가입자에서 볼 수 있습니다.</p>
              </div>
            )}

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
