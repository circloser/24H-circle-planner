import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GraduationCap, X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useTranslation, useChartView } from '@/hooks/usePreferences';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import type { TKey } from '@/i18n/translations';

interface TutorialOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Called when the user completes the tour via the finish button. */
  onFinish?: () => void;
}

interface Rect { top: number; left: number; width: number; height: number }

const RIM_KEY = '24h-circle-planner.rimmemos';
const DIARY_KEY = '24h-circle-planner.diary';

/** Bounding rect of a real, medium-sized slice path (small enough to read as
 *  "this one", big enough to grab) — steps 1-3 point at it. */
function sliceRect(): Rect | null {
  const paths = [...document.querySelectorAll<SVGPathElement>('main svg path[data-slice-id]')];
  if (paths.length === 0) return null;
  const rects = paths.map((p) => p.getBoundingClientRect()).filter((r) => r.width > 24 && r.height > 24);
  if (rects.length === 0) return null;
  rects.sort((a, b) => a.width * a.height - b.width * b.height);
  const r = rects[Math.floor(rects.length / 2)]; // median-sized slice
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** A small zone just OUTSIDE the ring at its BOTTOM-RIGHT — hovering there
 *  reveals the rim-memo affordance. */
function rimRect(): Rect | null {
  // The chart is the LARGEST svg in main (small icon svgs come first in DOM).
  const svgs = [...document.querySelectorAll('main svg')];
  if (svgs.length === 0) return null;
  const r = svgs.map((s) => s.getBoundingClientRect()).sort((a, b) => b.width - a.width)[0];
  if (r.width < 200) return null;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const edge = r.width * 0.47; // just past the ring's outer edge
  const k = Math.SQRT1_2; // 45° toward bottom-right
  return { top: cy + edge * k - 30, left: cx + edge * k - 40, width: 96, height: 68 };
}

function anchorRect(name: string): Rect | null {
  const el = document.querySelector(`[data-tour="${name}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

interface SliceSnap { id: string; label: string; startTime: string; endTime: string }
interface Baseline { slices: SliceSnap[]; rim: string | null; diary: string | null; view: string }

const readLs = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

/**
 * A hands-on coach-mark tour: each step highlights the EXACT control (a real
 * slice, the rim, the diary menu, the view toggle) with a pulsing ring and asks
 * the user to actually do it. The overlay watches the schedule/preferences/
 * storage, marks the step done (✓) the moment the action happens, and advances
 * automatically. Steps can also be skipped with Next.
 */
export function TutorialOverlay({ open, onClose, onFinish }: TutorialOverlayProps) {
  const { t } = useTranslation();
  const chartView = useChartView();
  const slices = useStoreSelector((s) => s.history.present.slices);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [done, setDone] = useState(false);
  const base = useRef<Baseline | null>(null);

  const steps: { name: TKey; body: TKey; target: () => Rect | null }[] = [
    { name: 'tutorial.n1', body: 'tutorial.s1', target: sliceRect },
    { name: 'tutorial.n2', body: 'tutorial.s2', target: sliceRect },
    { name: 'tutorial.n3', body: 'tutorial.s3', target: sliceRect },
    { name: 'tutorial.n4', body: 'tutorial.s4', target: rimRect },
    { name: 'tutorial.n5', body: 'tutorial.s5', target: () => anchorRect('diarySave') ?? anchorRect('diary') },
    { name: 'tutorial.n6', body: 'tutorial.s6', target: () => anchorRect('view') },
  ];
  const last = step === steps.length - 1;

  useEffect(() => { if (open) setStep(0); }, [open]);

  // Capture a baseline when a step becomes active — completion is "something
  // relevant changed since this snapshot".
  useEffect(() => {
    if (!open) return;
    base.current = {
      slices: slices.map((s) => ({ id: s.id, label: s.label, startTime: s.startTime, endTime: s.endTime })),
      rim: readLs(RIM_KEY),
      diary: readLs(DIARY_KEY),
      view: chartView,
    };
    setDone(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  // Detect the step's action. Store/pref changes arrive via re-render; rim/diary
  // localStorage writes are polled (same-tab storage events don't fire).
  useEffect(() => {
    if (!open || done) return;
    const b = base.current;
    if (!b) return;
    const check = () => {
      switch (step) {
        case 0: { // resize: same slices, some time moved
          if (slices.length !== b.slices.length) return false;
          return slices.some((s) => { const o = b.slices.find((x) => x.id === s.id); return o && (o.startTime !== s.startTime || o.endTime !== s.endTime); });
        }
        case 1: return slices.length < b.slices.length; // delete
        case 2: { // rename
          if (slices.length !== b.slices.length) return false;
          return slices.some((s) => { const o = b.slices.find((x) => x.id === s.id); return o && o.label !== s.label; });
        }
        case 3: return readLs(RIM_KEY) !== b.rim; // rim memo
        case 4: return readLs(DIARY_KEY) !== b.diary; // diary saved
        case 5: return chartView !== b.view; // view switched
        default: return false;
      }
    };
    if (check()) { setDone(true); return; }
    const id = window.setInterval(() => { if (check()) setDone(true); }, 600);
    return () => window.clearInterval(id);
  }, [open, step, done, slices, chartView]);

  // NB: no auto-advance — the user moves on with Next when ready, so there's
  // room to reflect on each feature after trying it.

  // Track the current target's position (re-measure on step, resize, scroll,
  // and periodically — slices move as the user edits).
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => setRect(steps[step].target());
    measure();
    const id = window.setInterval(measure, 500);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.clearInterval(id); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  if (!open) return null;

  const go = (d: number) => setStep((s) => Math.min(steps.length - 1, Math.max(0, s + d)));

  // Tooltip placement: below the target if it fits, else above; else centred.
  const cardW = 310;
  const cardH = 190;
  let cardStyle: React.CSSProperties;
  if (rect) {
    const below = rect.top + rect.height + cardH + 20 < window.innerHeight;
    const top = below ? rect.top + rect.height + 14 : Math.max(8, rect.top - 14 - cardH);
    let left = rect.left + rect.width / 2 - cardW / 2;
    left = Math.max(8, Math.min(window.innerWidth - cardW - 8, left));
    cardStyle = { position: 'fixed', top, left, width: cardW };
  } else {
    cardStyle = { position: 'fixed', top: '50%', left: '50%', width: cardW, transform: 'translate(-50%, -50%)' };
  }

  return createPortal(
    // Container is click-through so the user can actually do each action; only
    // the tooltip card captures the pointer.
    <div className="fixed inset-0 z-[59]" style={{ pointerEvents: 'none' }}>
      <style>{`@keyframes tut-pulse { 0%,100% { box-shadow: 0 0 0 3px hsl(var(--primary) / 0.25), 0 0 20px hsl(var(--primary) / 0.35); } 50% { box-shadow: 0 0 0 9px hsl(var(--primary) / 0.12), 0 0 30px hsl(var(--primary) / 0.5); } }`}</style>
      {rect && (
        <div
          aria-hidden
          className="fixed rounded-xl"
          style={{
            top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12,
            border: `2px solid ${done ? '#16a34a' : 'hsl(var(--primary))'}`,
            boxShadow: done ? '0 0 0 3px rgb(22 163 74 / 0.3)' : undefined,
            animation: done ? 'none' : 'tut-pulse 1.6s ease-in-out infinite',
            transition: 'top .25s ease, left .25s ease, width .25s ease, height .25s ease',
          }}
        />
      )}
      <div
        role="dialog"
        aria-label={t('tutorial.title')}
        className="rounded-2xl border border-border bg-surface p-4 shadow-2xl"
        style={{ ...cardStyle, pointerEvents: 'auto' }}
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <GraduationCap className="h-4 w-4" style={{ color: 'hsl(var(--primary))' }} />
          <span className="flex-1 text-sm font-bold text-foreground">{t(steps[step].name)}</span>
          <span className="text-[11px] tabular-nums text-muted-foreground">{step + 1}/{steps.length}</span>
          <button type="button" onClick={onClose} aria-label={t('common.cancel')}
            className="grid h-6 w-6 place-items-center rounded transition-colors hover:bg-black/10">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <p className="text-[13px] leading-relaxed text-foreground">{t(steps[step].body)}</p>

        {/* Green "done!" the moment the action lands (no hint line, no rush). */}
        {done && (
          <p className="mt-2 flex items-center gap-1 text-[12px] font-semibold" style={{ color: '#16a34a' }} role="status">
            <Check className="h-3.5 w-3.5" /> {t('tutorial.done')}
          </p>
        )}

        <div className="mt-2.5 flex justify-center gap-1">
          {steps.map((_, i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full"
              style={{ background: i < step || (i === step && done) ? '#16a34a' : i === step ? 'hsl(var(--primary))' : 'hsl(var(--border))' }} />
          ))}
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <button type="button" onClick={() => go(-1)} disabled={step === 0}
            className="grid h-8 w-8 place-items-center rounded-md border border-border disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {last ? (
            <button type="button" onClick={() => { onClose(); onFinish?.(); }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold text-primary-foreground"
              style={{ background: done ? '#16a34a' : 'hsl(var(--primary))' }}>
              <Check className="h-4 w-4" /> {t('magician.finish')}
            </button>
          ) : (
            <button type="button" onClick={() => go(1)}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground">
              {t(done ? 'magician.next' : 'tutorial.skip')} <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
