import { createPortal } from 'react-dom';
import { X, Smartphone } from 'lucide-react';
import { QrCode } from '@/components/QrCode/QrCode';
import { PLAY_STORE_URL } from '@/lib/twa';
import { useTranslation } from '@/hooks/usePreferences';

interface PlayStoreBannerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The final flourish of the first-run flow: a "get it on your phone" card with a
 * scannable QR (→ Play Store) plus a direct link for phones. Shown once, after
 * the design magician + tutorial finish.
 */
export function PlayStoreBanner({ open, onClose }: PlayStoreBannerProps) {
  const { t } = useTranslation();
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={t('getapp.title')}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xs rounded-2xl border border-border bg-surface p-5 text-center shadow-2xl"
      >
        <button type="button" onClick={onClose} aria-label={t('common.cancel')}
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full transition-colors hover:bg-black/10">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <h2 className="text-foreground" style={{ fontSize: 18, fontWeight: 800 }}>{t('getapp.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('getapp.scan')}</p>

        <div className="mx-auto mt-3 w-fit rounded-xl border border-border bg-white p-2">
          <QrCode value={PLAY_STORE_URL} size={168} />
        </div>

        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <Smartphone className="h-4 w-4" />
          {t('getapp.playstore')}
        </a>
        <button type="button" onClick={onClose} className="mt-2 w-full py-1 text-xs text-muted-foreground hover:text-foreground">
          {t('getapp.later')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
