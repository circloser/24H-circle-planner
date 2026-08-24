import { useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { useTranslation } from '@/hooks/usePreferences';
import { canPromoteApp, PLAY_STORE_URL } from '@/lib/twa';

/** Persisted dismissal — once closed, don't nag again on this device. */
const DISMISS_KEY = '24h-circle-planner.getapp-dismissed';

function desktop(): boolean {
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(min-width: 900px)').matches;
  } catch {
    return false;
  }
}

/**
 * Slim, one-time desktop banner promoting the Android (Play Store) app — the
 * natural companion for "plan on desktop, get alarms on your phone". Shown only
 * on a desktop-width web session that isn't already the installed app; dismissal
 * is remembered. Mirrors EnablePushBanner's style.
 */
export function GetAppBanner() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed || !canPromoteApp() || !desktop()) return null;

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
        <Smartphone className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 text-foreground">{t('getapp.bannerText')}</span>
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {t('getapp.bannerCta')}
        </a>
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
