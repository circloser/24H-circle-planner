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
export function UpgradeDialog({ open, onOpenChange }: UpgradeDialogProps) {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const [prices, setPrices] = useState<PriceInfo[] | null>(null);
  const [busy, setBusy] = useState(false);

  // Fetch the live price once the dialog opens (never blocks the CTA).
  useEffect(() => {
    if (!open) return;
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
