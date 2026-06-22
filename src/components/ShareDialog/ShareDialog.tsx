import { useEffect } from 'react';
import { ImageDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';

const SITE_URL = 'https://24houring.com/';
const ADDTOANY_SRC = 'https://static.addtoany.com/menu/page.js';

declare global {
  interface Window {
    a2a?: { init_all?: () => void; init?: (mode?: string) => void };
  }
}

/** Load the AddToAny widget script once (lazily, on first share). Resolves even
 *  if it fails so the rest of the dialog still works. */
function ensureAddToAny(): Promise<void> {
  if (window.a2a) return Promise.resolve();
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${ADDTOANY_SRC}"]`);
    if (existing) {
      if (window.a2a) resolve();
      else existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = ADDTOANY_SRC;
    s.defer = true;
    s.addEventListener('load', () => resolve(), { once: true });
    s.addEventListener('error', () => resolve(), { once: true });
    document.body.appendChild(s);
  });
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Render + share the current timetable as an image (native sheet / download). */
  onShareImage: () => void;
  /** Title used for the link-share (AddToAny). */
  shareTitle: string;
}

/**
 * Share hub: share the current timetable as an IMAGE (native share sheet on
 * mobile → Instagram etc., download on desktop), or share the app LINK to social
 * networks via AddToAny (Facebook, Messenger, Threads, X, KakaoTalk, Telegram,
 * Email). The AddToAny markup is injected as opaque HTML so React never fights
 * the widget's own DOM mutations; init_all() re-scans it each time we open.
 */
export function ShareDialog({ open, onOpenChange, onShareImage, shareTitle }: ShareDialogProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void ensureAddToAny().then(() => {
      if (!cancelled) window.a2a?.init_all?.();
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const a2aHtml =
    `<div class="a2a_kit a2a_kit_size_32 a2a_default_style" data-a2a-url="${SITE_URL}" data-a2a-title="${shareTitle.replace(/"/g, '&quot;')}">` +
    '<a class="a2a_dd" href="https://www.addtoany.com/share"></a>' +
    '<a class="a2a_button_facebook"></a>' +
    '<a class="a2a_button_facebook_messenger"></a>' +
    '<a class="a2a_button_threads"></a>' +
    '<a class="a2a_button_x"></a>' +
    '<a class="a2a_button_kakao"></a>' +
    '<a class="a2a_button_telegram"></a>' +
    '<a class="a2a_button_email"></a>' +
    '</div>';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('share.button')}</DialogTitle>
        </DialogHeader>

        <p className="text-sm" style={{ color: 'hsl(var(--text-muted))' }}>
          {t('share.intro')}
        </p>

        <Button
          onClick={() => {
            onOpenChange(false);
            onShareImage();
          }}
          className="w-full gap-2"
          style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
        >
          <ImageDown className="h-4 w-4" />
          {t('share.imageShare')}
        </Button>

        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1" style={{ backgroundColor: 'hsl(var(--border))' }} />
          <span className="text-xs" style={{ color: 'hsl(var(--text-muted))' }}>{t('share.orLink')}</span>
          <span className="h-px flex-1" style={{ backgroundColor: 'hsl(var(--border))' }} />
        </div>

        {/* AddToAny link-share buttons (opaque to React). */}
        <div className="pt-0.5" dangerouslySetInnerHTML={{ __html: a2aHtml }} />
      </DialogContent>
    </Dialog>
  );
}
