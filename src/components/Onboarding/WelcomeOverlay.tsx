import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, MousePointerClick, MoveHorizontal, MousePointer2, Hand, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';

interface WelcomeOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Open the preset gallery (primary CTA). */
  onPickPreset: () => void;
  /** Mobile vs desktop gesture guide. */
  isMobile: boolean;
}

/**
 * One-time first-visit welcome: a value-prop headline + a tiny "how to edit"
 * gesture guide, shown over the pre-filled demo schedule. Deliberately a
 * NON-blocking card (no full-screen modal backdrop) so visitors can start
 * exploring the demo immediately; dismiss via the buttons or the ✕.
 */
export function WelcomeOverlay({ open, onOpenChange, onPickPreset, isMobile }: WelcomeOverlayProps) {
  const { t } = useTranslation();

  // Escape dismisses the welcome (and keeps it out of the way of automation).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  const gestures = isMobile
    ? [
        [<Hand className="h-4 w-4" />, t('welcome.gTap')],
        [<Plus className="h-4 w-4" />, t('welcome.gAdd')],
      ]
    : [
        [<MousePointerClick className="h-4 w-4" />, t('welcome.gClick')],
        [<MoveHorizontal className="h-4 w-4" />, t('welcome.gDrag')],
        [<MousePointer2 className="h-4 w-4" />, t('welcome.gEdit')],
      ];

  return createPortal(
    // Container is click-through (pointer-events-none); only the card captures clicks.
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-label={t('welcome.title')}
        className="pointer-events-auto relative w-full max-w-md rounded-xl border p-5 shadow-2xl"
        style={{ backgroundColor: 'hsl(var(--surface))', borderColor: 'hsl(var(--border))' }}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t('common.cancel')}
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full transition-colors hover:bg-black/10"
        >
          <X className="h-4 w-4" style={{ color: 'hsl(var(--text-muted))' }} />
        </button>

        <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px', color: 'hsl(var(--foreground))' }}>
          {t('welcome.title')}
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'hsl(var(--text-muted))' }}>
          {t('welcome.subtitle')}
        </p>

        <section className="mt-3 rounded-lg p-3" style={{ backgroundColor: 'hsl(var(--text-muted) / 0.07)' }}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--text-muted))' }}>
            {t('welcome.howto')}
          </h3>
          <ul className="flex flex-col gap-2">
            {gestures.map(([icon, label], i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm" style={{ color: 'hsl(var(--foreground))' }}>
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
                  style={{ backgroundColor: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--text-muted))' }}
                >
                  {icon}
                </span>
                {label}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => { onOpenChange(false); onPickPreset(); }}
            className="flex-1 gap-1.5"
            style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            <Sparkles className="h-4 w-4" />
            {t('welcome.startPreset')}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            {t('welcome.startBlank')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
