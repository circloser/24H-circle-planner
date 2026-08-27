import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GraduationCap, X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useTranslation } from '@/hooks/usePreferences';

interface TutorialOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Called when the user completes the tour via the finish button. */
  onFinish?: () => void;
}

interface Rect { top: number; left: number; width: number; height: number }

/**
 * A guided coach-mark tour of the timetable's core features. Each step points a
 * highlight ring + tooltip at a real control (via its `data-tour` anchor) and
 * explains what to try — without blocking the app, so the user can actually do
 * it. Launched from the bottom of the 내 시간표 menu (and offered after the
 * design magician). Falls back to a centred card if an anchor isn't on screen.
 */
export function TutorialOverlay({ open, onClose, onFinish }: TutorialOverlayProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const steps: { tour: string; text: string }[] = [
    { tour: 'chart', text: t('tutorial.s1') },
    { tour: 'chart', text: t('tutorial.s2') },
    { tour: 'chart', text: t('tutorial.s3') },
    { tour: 'chart', text: t('tutorial.s4') },
    { tour: 'diary', text: t('tutorial.s5') },
    { tour: 'view', text: t('tutorial.s6') },
  ];

  useEffect(() => { if (open) setStep(0); }, [open]);

  // Track the current target's position (re-measure on step, resize, scroll).
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = document.querySelector(`[data-tour="${steps[step].tour}"]`);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  if (!open) return null;

  const last = step === steps.length - 1;
  const go = (d: number) => setStep((s) => Math.min(steps.length - 1, Math.max(0, s + d)));

  // Tooltip placement: below the target if it fits, else above; else centred.
  const pad = 8;
  const cardW = 300;
  let cardStyle: React.CSSProperties;
  if (rect) {
    const below = rect.top + rect.height + 150 < window.innerHeight;
    const top = below ? rect.top + rect.height + pad + 6 : Math.max(8, rect.top - 6 - 150);
    let left = rect.left + rect.width / 2 - cardW / 2;
    left = Math.max(8, Math.min(window.innerWidth - cardW - 8, left));
    cardStyle = { position: 'fixed', top, left, width: cardW };
  } else {
    cardStyle = { position: 'fixed', top: '50%', left: '50%', width: cardW, transform: 'translate(-50%, -50%)' };
  }

  return createPortal(
    // Container is click-through so the user can actually try each feature; only
    // the tooltip card and the highlight ring are drawn.
    <div className="fixed inset-0 z-[59]" style={{ pointerEvents: 'none' }}>
      {rect && (
        <div
          aria-hidden
          className="fixed rounded-xl"
          style={{
            top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12,
            border: '2px solid hsl(var(--primary))',
            boxShadow: '0 0 0 3px hsl(var(--primary) / 0.25), 0 0 22px hsl(var(--primary) / 0.35)',
            transition: 'all .2s ease',
          }}
        />
      )}
      <div
        role="dialog"
        aria-label={t('tutorial.title')}
        className="rounded-2xl border border-border bg-surface p-4 shadow-2xl"
        style={{ ...cardStyle, pointerEvents: 'auto' }}
      >
        <div className="mb-2 flex items-center gap-1.5">
          <GraduationCap className="h-4 w-4" style={{ color: 'hsl(var(--primary))' }} />
          <span className="flex-1 text-sm font-bold text-foreground">{t('tutorial.title')}</span>
          <span className="text-[11px] tabular-nums text-muted-foreground">{step + 1}/{steps.length}</span>
          <button type="button" onClick={onClose} aria-label={t('common.cancel')}
            className="grid h-6 w-6 place-items-center rounded transition-colors hover:bg-black/10">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <p className="text-[13px] leading-relaxed text-foreground">{steps[step].text}</p>

        <div className="mt-3 flex justify-center gap-1">
          {steps.map((_, i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i === step ? 'hsl(var(--primary))' : 'hsl(var(--border))' }} />
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => go(-1)} disabled={step === 0}
            className="grid h-8 w-8 place-items-center rounded-md border border-border disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {last ? (
            <button type="button" onClick={() => { onClose(); onFinish?.(); }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground">
              <Check className="h-4 w-4" /> {t('magician.finish')}
            </button>
          ) : (
            <button type="button" onClick={() => go(1)}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground">
              {t('magician.next')} <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
