import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Wand2, X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import {
  usePreferences, GRADIENT_PRESETS, FONT_FAMILIES,
  FONT_SCALE_MIN, FONT_SCALE_MAX, FONT_SCALE_STEP, RING_INNER_MIN, RING_INNER_MAX,
} from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/usePreferences';
import { makeDragStart, spawnNearCentre, type Pos } from '@/components/ClockTools/clock-utils';

interface DesignMagicianProps {
  open: boolean;
  onClose: () => void;
  /** Offer the timetable tutorial after finishing (optional). */
  onFinish?: () => void;
}

/**
 * A guided "design magician": steps a visitor through the main look-and-feel
 * choices one at a time, writing each straight to preferences so the app updates
 * LIVE behind the panel. The panel itself is draggable and translucent so the
 * change is always visible; each step also nudges the panel to a fresh spot.
 * Reachable on first visit and from the top of the Design settings.
 */
export function DesignMagician({ open, onClose, onFinish }: DesignMagicianProps) {
  const { prefs, setPreference } = usePreferences();
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  // The panel drifts to a new corner each step so it never hides what changed.
  const spots: Pos[] = [
    spawnNearCentre(-300, 160, 300, 260), spawnNearCentre(300, -180, 300, 260),
    spawnNearCentre(-300, -180, 300, 260), spawnNearCentre(300, 160, 300, 260),
    spawnNearCentre(0, 200, 300, 260),
  ];
  const [pos, setPos] = useState<Pos>(spots[0]);
  // Restart at the first step whenever it (re)opens.
  useEffect(() => { if (open) { setStep(0); setPos(spawnNearCentre(-300, 160, 300, 260)); } }, [open]);

  if (!open) return null;

  const swatch = (from: string, via: string, to: string) => `linear-gradient(135deg, ${from}, ${via}, ${to})`;

  const steps = [
    // ── Background ──────────────────────────────────────────────────────────
    {
      title: t('magician.stepBg'),
      body: (
        <div className="flex flex-col gap-2">
          <div className="flex gap-1.5">
            {(['none', 'gradient'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPreference('bgType', mode === 'none' ? 'pattern' : 'gradient')}
                aria-pressed={mode === 'none' ? prefs.bgType !== 'gradient' && prefs.bgType !== 'color' : prefs.bgType === 'gradient'}
                className="opt-chip flex-1 rounded-md px-2 py-1.5 text-xs"
              >
                {mode === 'none' ? t('magician.bgPlain') : t('magician.bgGradient')}
              </button>
            ))}
          </div>
          {prefs.bgType === 'gradient' && (
            <>
              <div className="flex gap-1.5">
                {(['linear', 'radial'] as const).map((sh) => (
                  <button key={sh} type="button"
                    onClick={() => setPreference('gradient', { ...prefs.gradient, shape: sh })}
                    aria-pressed={(prefs.gradient.shape ?? 'linear') === sh}
                    className="opt-chip flex-1 rounded-md px-2 py-1 text-xs">
                    {sh === 'linear' ? t('settings.gradLinear') : t('settings.gradRadial')}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {GRADIENT_PRESETS.map((g) => (
                  <button key={g.id} type="button" aria-label={g.en}
                    onClick={() => setPreference('gradient', { from: g.from, via: g.via, to: g.to, angle: g.angle, shape: prefs.gradient.shape ?? 'linear' })}
                    className="h-8 rounded-md border border-border"
                    style={{ backgroundImage: swatch(g.from, g.via, g.to) }} />
                ))}
              </div>
            </>
          )}
        </div>
      ),
    },
    // ── Font ────────────────────────────────────────────────────────────────
    {
      title: t('magician.stepFont'),
      body: (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {FONT_FAMILIES.map((f) => (
              <button key={f.css} type="button"
                onClick={() => setPreference('fontFamily', f.css)}
                aria-pressed={prefs.fontFamily === f.css}
                style={{ fontFamily: `${f.css}, system-ui, sans-serif` }}
                className="opt-chip rounded-md px-2 py-1 text-xs">
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="range" min={FONT_SCALE_MIN} max={FONT_SCALE_MAX} step={FONT_SCALE_STEP}
              value={prefs.fontScale} onChange={(e) => setPreference('fontScale', Number(e.target.value))}
              className="flex-1 cursor-pointer accent-[hsl(var(--primary))]" />
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round(prefs.fontScale * 100)}%</span>
          </div>
        </div>
      ),
    },
    // ── Icons on/off ──────────────────────────────────────────────────────────
    {
      title: t('magician.stepIcons'),
      body: (
        <div className="flex gap-1.5">
          {[true, false].map((on) => (
            <button key={String(on)} type="button"
              onClick={() => setPreference('showIcons', on)}
              aria-pressed={prefs.showIcons === on}
              className="opt-chip flex-1 rounded-md px-2 py-1.5 text-xs">
              {on ? t('magician.on') : t('magician.off')}
            </button>
          ))}
        </div>
      ),
    },
    // ── Ring thickness ────────────────────────────────────────────────────────
    {
      title: t('magician.stepRing'),
      body: (
        <div className="flex items-center gap-2">
          {/* Slider is inverted: smaller innerR = thicker band. */}
          <span className="text-xs text-muted-foreground">{t('magician.thick')}</span>
          <input type="range" min={460 - RING_INNER_MAX} max={460 - RING_INNER_MIN}
            value={460 - prefs.ringInnerR}
            onChange={(e) => setPreference('ringInnerR', 460 - Number(e.target.value))}
            className="flex-1 cursor-pointer accent-[hsl(var(--primary))]" />
          <span className="text-xs text-muted-foreground">{t('magician.thin')}</span>
        </div>
      ),
    },
  ];

  const last = step === steps.length - 1;
  const go = (d: number) => {
    const n = Math.min(steps.length - 1, Math.max(0, step + d));
    setStep(n);
    setPos(spots[n % spots.length]);
  };
  const finish = () => { onClose(); onFinish?.(); };

  return createPortal(
    <div
      role="dialog"
      aria-label={t('magician.title')}
      onPointerDown={makeDragStart(pos, setPos)}
      className="fixed z-[58] w-[300px] cursor-grab touch-none overflow-hidden rounded-2xl p-4 shadow-2xl active:cursor-grabbing"
      style={{
        position: 'fixed', left: `calc(50vw + ${pos.x}px)`, top: `calc(50vh + ${pos.y}px)`,
        border: '1px solid hsl(var(--border))',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      {/* Translucent surface fill (content stays fully opaque above it) so the
          live change behind the panel stays visible. */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundColor: 'hsl(var(--surface))', opacity: 0.82 }} />
      <div className="relative z-10">
      <div className="mb-2 flex items-center gap-1.5">
        <Wand2 className="h-4 w-4" style={{ color: 'hsl(var(--primary))' }} />
        <span className="flex-1 text-sm font-bold text-foreground">{t('magician.title')}</span>
        <span className="text-[11px] tabular-nums text-muted-foreground">{step + 1}/{steps.length}</span>
        <button type="button" data-no-drag onClick={onClose} aria-label={t('common.cancel')}
          className="grid h-6 w-6 place-items-center rounded transition-colors hover:bg-black/10">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <h3 className="mb-2 text-[13px] font-semibold text-foreground">{steps[step].title}</h3>
      <div data-no-drag>{steps[step].body}</div>

      {/* Progress dots. */}
      <div className="mt-3 flex justify-center gap-1">
        {steps.map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i === step ? 'hsl(var(--primary))' : 'hsl(var(--border))' }} />
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2" data-no-drag>
        <button type="button" onClick={() => go(-1)} disabled={step === 0}
          className="grid h-8 w-8 place-items-center rounded-md border border-border disabled:opacity-40">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {last ? (
          <button type="button" onClick={finish}
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
