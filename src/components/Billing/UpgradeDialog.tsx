import { useEffect, useState } from 'react';
import { Cloud, Archive, BarChart3, Ban, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { startCheckout } from '@/lib/sync/billing';
import { track } from '@/lib/track';
import { toast } from 'sonner';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PriceInfo {
  amount: number; // minor units (cents)
  currency: string;
  interval: string | null; // 'month' | 'year' | null
}

/** Format a Polar price (minor units) as "$1.99 / month". */
function formatPrice(p: PriceInfo, perMonth: string, perYear: string): string {
  const major = p.amount / 100;
  const num = Number.isInteger(major) ? String(major) : major.toFixed(2);
  const sym = p.currency === 'usd' ? '$' : p.currency === 'eur' ? '€' : p.currency === 'krw' ? '₩' : `${p.currency.toUpperCase()} `;
  const per = p.interval === 'year' ? perYear : perMonth;
  return `${sym}${num} / ${per}`;
}

/**
 * Pro paywall. Explains what Pro unlocks (cloud sync + diary lock — the only
 * server-backed features; everything else stays free) with a 1-month free trial,
 * shows the live price read from Polar, and starts the hosted checkout.
 */
/** Map a redeem error code to a localized message. */
function redeemError(code: string | undefined, ko: boolean): string {
  switch (code) {
    case 'invalid_code': return ko ? '존재하지 않는 코드입니다.' : 'That code doesn’t exist.';
    case 'code_expired': return ko ? '만료된 코드입니다.' : 'This code has expired.';
    case 'already_redeemed': return ko ? '이미 사용한 코드입니다.' : 'You’ve already used this code.';
    case 'code_exhausted': return ko ? '사용 한도가 모두 소진된 코드입니다.' : 'This code has been fully used.';
    case 'unauthorized': return ko ? '먼저 로그인해 주세요.' : 'Please sign in first.';
    default: return ko ? '적용에 실패했습니다.' : 'Redemption failed.';
  }
}

export function UpgradeDialog({ open, onOpenChange }: UpgradeDialogProps) {
  const { t, lang } = useTranslation();
  const { user, login, refresh, admin } = useAuth();
  const ko = lang === 'ko';
  const [prices, setPrices] = useState<PriceInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [madeCode, setMadeCode] = useState<string | null>(null);

  const redeem = async () => {
    const c = code.trim();
    if (!c) return;
    if (!user) { login(); return; }
    setRedeeming(true);
    try {
      const res = await fetch('/api/coupon/redeem', {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: c }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        track('coupon_redeem');
        await refresh();
        toast.success(ko ? '쿠폰이 적용됐어요. Pro가 활성화되었습니다!' : 'Coupon applied — Pro is now active!');
        onOpenChange(false);
      } else {
        toast.error(redeemError(data.error, ko));
      }
    } catch {
      toast.error(redeemError(undefined, ko));
    } finally {
      setRedeeming(false);
    }
  };

  const createCoupon = async (grantDays: number, note: string) => {
    setCreating(true);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ grantDays, note }),
      });
      const data = (await res.json().catch(() => ({}))) as { code?: string };
      if (res.ok && data.code) {
        setMadeCode(data.code);
        void navigator.clipboard?.writeText(data.code).catch(() => {});
        toast.success((ko ? '쿠폰 생성(복사됨): ' : 'Coupon created (copied): ') + data.code);
      } else {
        toast.error(ko ? '쿠폰 생성에 실패했습니다.' : 'Failed to create the coupon.');
      }
    } catch {
      toast.error(ko ? '쿠폰 생성에 실패했습니다.' : 'Failed to create the coupon.');
    } finally {
      setCreating(false);
    }
  };

  // Fetch the live price once the dialog opens (never blocks the CTA).
  useEffect(() => {
    if (!open) return;
    track('upgrade_open');
    let cancelled = false;
    void fetch('/api/billing/product', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { prices?: PriceInfo[] } | null) => {
        if (!cancelled && d?.prices) setPrices(d.prices.filter((p) => typeof p.amount === 'number'));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const onCta = () => {
    if (!user) {
      login(); // not signed in → send to sign-in first (checkout needs a session)
      return;
    }
    setBusy(true);
    track('checkout_start');
    startCheckout().catch(() => {
      setBusy(false);
      toast.error(t('billing.checkoutError'));
    });
  };

  const features = [
    { icon: Cloud, text: t('upgrade.featSync') },
    { icon: Archive, text: t('upgrade.featArchive') },
    { icon: BarChart3, text: t('upgrade.featStats') },
    { icon: Ban, text: t('upgrade.featNoAds') },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('upgrade.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {t('upgrade.trialBadge')}
          </span>

          <p className="text-sm text-muted-foreground">{t('upgrade.subtitle')}</p>

          {/* What Pro adds on top of the (free) planner. */}
          <ul className="flex flex-col gap-2">
            {features.map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm text-foreground">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          {/* Everything the free tier already includes, so the paywall feels fair. */}
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t('upgrade.freeBody')}
          </p>

          {/* Live price(s) from Polar; absent until fetched / if offline. */}
          {prices && prices.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {prices.map((p, i) => (
                <span key={i} className="font-semibold text-foreground">
                  {formatPrice(p, t('upgrade.perMonth'), t('upgrade.perYear'))}
                </span>
              ))}
            </div>
          )}

          <Button onClick={onCta} disabled={busy} className="w-full">
            {busy ? t('upgrade.ctaBusy') : t('upgrade.cta')}
          </Button>

          {/* Coupon redeem — anyone with a code can activate Pro here. */}
          <div className="border-t border-border pt-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{ko ? '쿠폰 코드가 있으신가요?' : 'Have a coupon code?'}</p>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') void redeem(); }}
                placeholder={ko ? '코드 입력' : 'Enter code'}
                aria-label={ko ? '쿠폰 코드' : 'Coupon code'}
                className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm uppercase tracking-wide outline-none focus:border-primary"
              />
              <Button type="button" variant="outline" onClick={() => void redeem()} disabled={redeeming || !code.trim()}>
                {redeeming ? '…' : ko ? '적용' : 'Apply'}
              </Button>
            </div>
          </div>

          {/* Admin-only coupon issuer (email allowlist; verified server-side). */}
          {admin && (
            <div className="rounded-md border border-dashed border-border p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">{ko ? '관리자 · 쿠폰 발행' : 'Admin · Issue coupons'}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void createCoupon(0, 'permanent')} disabled={creating}>{ko ? '영구' : 'Permanent'}</Button>
                <Button type="button" variant="outline" onClick={() => void createCoupon(365, '1-year')} disabled={creating}>{ko ? '1년' : '1 year'}</Button>
                <Button type="button" variant="outline" onClick={() => void createCoupon(30, '1-month')} disabled={creating}>{ko ? '1개월' : '1 month'}</Button>
              </div>
              {madeCode && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {ko ? '생성된 코드(복사됨): ' : 'Created (copied): '}
                  <span className="select-all font-mono font-semibold text-foreground">{madeCode}</span>
                </p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">{ko ? '무제한 사용 코드입니다. 사용자는 위 칸에 입력해 적용합니다.' : 'Unlimited-use code; users apply it in the field above.'}</p>
            </div>
          )}

          <p className="text-center text-[11px] text-muted-foreground">{t('upgrade.note')}</p>
          <p className="text-center text-[11px] text-muted-foreground">
            <a href="/terms" target="_blank" rel="noopener" className="underline hover:text-foreground">{t('footer.terms')}</a>
            {' · '}
            <a href="/refund" target="_blank" rel="noopener" className="underline hover:text-foreground">{t('footer.refund')}</a>
            {' · '}
            <a href="/privacy" target="_blank" rel="noopener" className="underline hover:text-foreground">{t('footer.privacy')}</a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
