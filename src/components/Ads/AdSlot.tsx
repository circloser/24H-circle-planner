import { useTranslation } from '@/hooks/usePreferences';

interface AdSlotProps {
  /** Stable id for this placement (e.g. "settings", "export"). */
  slot: string;
  className?: string;
}

/**
 * Reserved space for an advertisement inside a dialog/popup. Today it renders a
 * labelled placeholder; a real AdSense `<ins class="adsbygoogle">` unit (with a
 * data-ad-slot id from the AdSense dashboard) can be dropped in here later
 * without disturbing the surrounding layout. The site-level AdSense loader is
 * already present (index.html), so Auto ads may also fill this region.
 */
export function AdSlot({ slot, className = '' }: AdSlotProps) {
  const { t } = useTranslation();
  return (
    <div
      data-ad-slot={slot}
      aria-label={t('export.adLabel')}
      className={`flex h-[90px] w-full items-center justify-center rounded-lg border border-dashed text-center ${className}`}
      style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--text-muted) / 0.06)' }}
    >
      <span className="text-[11px] uppercase tracking-wide" style={{ color: 'hsl(var(--text-muted) / 0.7)' }}>
        {t('export.adLabel')}
      </span>
    </div>
  );
}
