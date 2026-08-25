import { useState } from 'react';
import { Share, X } from 'lucide-react';
import { useTranslation } from '@/hooks/usePreferences';
import { isIOS, isStandalone } from '@/lib/twa';

/** Persisted dismissal — once closed, don't nag again on this device. */
const DISMISS_KEY = '24h-circle-planner.ios-install-dismissed';

/**
 * Slim, one-time banner shown on iOS Safari (not already added to the home
 * screen), nudging "add to home screen" — the only way 24Houring gets alarms /
 * offline / fullscreen on iOS until a native app ships. Tapping opens the
 * existing AddToHome guide (with the iOS step-by-step). Dismissal is remembered.
 */
export function IosInstallBanner({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed || !isIOS() || isStandalone()) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage unavailable — dismiss for the session only */
    }
  };

  return (
    <div className="container mx-auto px-3 pt-2 sm:px-4">
      <div
        role="status"
        className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm"
      >
        <Share className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 text-foreground">{t('home.iosBanner')}</span>
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {t('home.iosBannerCta')}
        </button>
        <button
          type="button"
          onClick={close}
          aria-label={t('common.close')}
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-black/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
