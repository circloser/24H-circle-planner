import { useContext } from 'react';
import { X } from 'lucide-react';
import { AnalogClock } from './AnalogClock';
import { makeDragStart, useNow, pad2, type Pos } from './clock-utils';
import type { ClockItem } from './useClockTools';
import { TIMEZONES } from '@/data/timezones';
import { useTranslation } from '@/hooks/usePreferences';
import { FloatingInlineContext } from './floatingInline';

interface ClockWidgetProps {
  /** One of possibly several open clocks (one per timezone; tz null = local). */
  clock: ClockItem;
  onChange: (patch: Partial<Omit<ClockItem, 'id'>>) => void;
  onMove: (p: Pos) => void;
  onClose: () => void;
}

/** `now` shifted into an IANA timezone (null = as-is). en-US round-trip keeps
 *  minute/second precision and parses reliably in every modern engine. */
function zonedNow(now: Date, tz: string | null): Date {
  if (!tz) return now;
  try {
    return new Date(now.toLocaleString('en-US', { timeZone: tz }));
  } catch {
    return now; // unknown tz id — fall back to local rather than crash
  }
}

function DigitalDisplay({ now }: { now: Date }) {
  return (
    <div className="py-3 text-center text-foreground">
      <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 40, fontWeight: 800, letterSpacing: 1, lineHeight: 1 }}>
        {pad2(now.getHours())}:{pad2(now.getMinutes())}
        <span style={{ fontSize: 20, fontWeight: 700, opacity: 0.65 }}>:{pad2(now.getSeconds())}</span>
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">
        {now.toLocaleDateString()}
      </div>
    </div>
  );
}

/**
 * Floating clock. By default only the clock (analog face / digital readout) is
 * shown — clean, no surrounding box. Hovering reveals the panel box plus the
 * mode-switch, timezone picker and close controls. Drag from the clock itself.
 * Several clocks can be open at once, each with its own timezone.
 */
export function ClockWidget({ clock, onChange, onMove, onClose }: ClockWidgetProps) {
  const { t, lang } = useTranslation();
  const now = zonedNow(useNow(true), clock.tz);
  // Inline (mobile clock-tools section): static, full-width card; controls and
  // the box always visible (no hover), and dragging disabled.
  const inline = useContext(FloatingInlineContext);
  const cityLabel = clock.tz
    ? (() => {
        const z = TIMEZONES.find((o) => o.tz === clock.tz);
        return z ? (lang === 'ko' ? z.ko : z.en) : clock.tz;
      })()
    : null;

  return (
    <div
      // Base z lives in the CLASS (z-[25]) — an inline zIndex would always beat
      // hover:z-[26] and the hovered window could never raise above overlapping
      // widgets (cascaded clocks, the calendar), leaving its controls unclickable.
      className={inline ? 'group relative w-full' : 'group z-[25] hover:z-[26]'}
      data-clock-widget // stable hook — the visual-regression harness hides ticking clocks
      style={inline ? undefined : { position: 'fixed', left: clock.pos.x, top: clock.pos.y, width: 168 }}
    >
      {/* Box — fades in only on hover (clean clock by default); always shown inline. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-150 bg-surface border border-border ${inline ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
      />

      {/* Hover controls — mode switch + close, top-right; always shown inline. */}
      <div
        data-no-drag
        className={`absolute right-1.5 top-1.5 z-20 flex items-center gap-1 transition-opacity duration-150 ${inline ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'}`}
      >
        <button
          type="button"
          onClick={() => onChange({ mode: clock.mode === 'analog' ? 'digital' : 'analog' })}
          className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-background text-foreground border border-border"
        >
          {clock.mode === 'analog' ? t('clock.digital') : t('clock.analog')}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('clock.close')}
          className="grid h-5 w-5 place-items-center rounded transition-colors hover:bg-black/10 bg-background border border-border"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      {/* Clock face — always visible; drag from here (disabled inline). */}
      <div
        onPointerDown={inline ? undefined : makeDragStart(clock.pos, onMove)}
        className={`relative z-10 grid place-items-center px-3 py-3 ${inline ? '' : 'cursor-grab touch-none select-none active:cursor-grabbing'}`}
      >
        {clock.mode === 'analog' ? <AnalogClock date={now} size={140} /> : <DigitalDisplay now={now} />}
        {/* City label — always visible for a non-local clock so a wall of clocks
            reads like a world-clock board. */}
        {cityLabel ? (
          <div className="max-w-full truncate text-center text-xs font-medium text-muted-foreground">{cityLabel}</div>
        ) : null}

        {/* Timezone picker — hover-only on desktop; always visible inline. */}
        <div
          data-no-drag
          className={`mt-1.5 w-full transition-opacity duration-150 ${inline ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'}`}
        >
          <select
            value={clock.tz ?? ''}
            onChange={(e) => onChange({ tz: e.target.value || null })}
            aria-label={t('clock.timezone')}
            className="w-full rounded-md px-2 py-1 text-xs bg-background text-foreground border border-border"
          >
            <option value="">{t('clock.localTime')}</option>
            {TIMEZONES.map((z) => (
              <option key={z.tz} value={z.tz}>
                {lang === 'ko' ? z.ko : z.en}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
