import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, MousePointerClick, MoveHorizontal, MousePointer2, Hand, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CircleTimeline } from '@/components/CircleTimeline/CircleTimeline';
import { PRESETS } from '@/data/presets';
import { translatePresetName } from '@/i18n/content';
import { track } from '@/lib/track';
import { useTranslation } from '@/hooks/usePreferences';

interface WelcomeOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Load a built-in persona preset straight into the chart (first-run 1-tap). */
  onLoadPreset: (name: string) => void;
  /** Open the full preset gallery (themes + user presets) for "browse more". */
  onPickPreset: () => void;
  /** Mobile vs desktop gesture guide. */
  isMobile: boolean;
}

/**
 * First-visit onboarding, compressed to a single "draw your day in a minute"
 * step: pick the persona closest to you and its schedule loads instantly (no
 * separate confirm — the mini-chart on each card IS the preview). Secondary
 * paths: browse the full gallery, or start from the demo and edit by hand. A
 * one-line gesture hint sits at the foot so the how-to isn't lost.
 */
export function WelcomeOverlay({ open, onOpenChange, onLoadPreset, onPickPreset, isMobile }: WelcomeOverlayProps) {
  const { t, lang } = useTranslation();

  // Escape dismisses the welcome (and keeps it out of the way of automation).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  const gestures = isMobile
    ? [[<Hand key="t" className="h-3.5 w-3.5" />, t('welcome.gTap')], [<Plus key="a" className="h-3.5 w-3.5" />, t('welcome.gAdd')]]
    : [
        [<MousePointerClick key="c" className="h-3.5 w-3.5" />, t('welcome.gClick')],
        [<MoveHorizontal key="d" className="h-3.5 w-3.5" />, t('welcome.gDrag')],
        [<MousePointer2 key="e" className="h-3.5 w-3.5" />, t('welcome.gEdit')],
      ];

  const pick = (name: string) => { track('onboard_persona', { preset: name }); onLoadPreset(name); onOpenChange(false); };

  return createPortal(
    // Soft backdrop focuses attention on the first choice; clicking it (or ✕)
    // falls back to editing the demo by hand — never a dead end.
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4"
      style={{ background: 'rgba(0,0,0,0.28)' }}
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-label={t('welcome.oneMinute')}
        onClick={(e) => e.stopPropagation()}
        className="relative my-auto w-full max-w-3xl rounded-2xl border border-border bg-surface p-5 shadow-2xl sm:p-6"
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t('common.cancel')}
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full transition-colors hover:bg-black/10"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="text-center">
          <h2 className="text-foreground" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.3px' }}>
            {t('welcome.oneMinute')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('welcome.pickPersona')}</p>
        </div>

        {/* Persona cards — tap loads that day instantly. */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => pick(preset.name)}
              className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-3 text-center transition hover:ring-2 hover:ring-primary"
            >
              <CircleTimeline slices={preset.slices} interactionMode="view" size={116} />
              <span className="text-sm font-semibold text-foreground">{translatePresetName(preset.name, lang)}</span>
            </button>
          ))}
        </div>

        {/* Secondary paths + a compact gesture hint. */}
        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); onPickPreset(); }}>
              {t('welcome.moreGallery')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {t('welcome.startBlank')}
            </Button>
          </div>
          <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {gestures.map(([icon, label], i) => (
              <li key={i} className="flex items-center gap-1">{icon}{label}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}
