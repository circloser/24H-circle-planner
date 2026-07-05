import { useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { requestUpgrade } from '@/lib/pro';
import { Sparkles } from 'lucide-react';

export interface AdSlotProps {
  /** Stable id for this placement (kept for call-site compatibility). */
  slot?: string;
  className?: string;
}

/**
 * Free-tier ad slot. "Ad-free" is a Pro benefit, so this renders nothing for Pro.
 *
 * For free users it shows a compact in-app promo (policy-safe, and doubles as an
 * upsell). AdSense forbids ads on tool screens without publisher content, so real
 * third-party ad units are NOT injected here by default: to serve AdSense instead,
 * create an ad unit in the AdSense dashboard and swap this promo for an
 * `<ins class="adsbygoogle" data-ad-client="ca-pub-6947130056543786"
 * data-ad-slot="<unit-id>">` (loading the script + `adsbygoogle.push({})`),
 * keeping the same `plan === 'pro'` gate.
 */
export function AdSlot({ className }: AdSlotProps) {
  const { plan } = useAuth();
  const { t } = useTranslation();

  if (plan === 'pro') return null; // ad-free — the Pro benefit

  return (
    <button
      type="button"
      onClick={requestUpgrade}
      className={`flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground ${className ?? ''}`}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
      {t('ad.housePromo')}
    </button>
  );
}
