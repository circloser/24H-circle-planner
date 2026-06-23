import { useContext } from 'react';
import { X } from 'lucide-react';
import { AnalogClock } from './AnalogClock';
import { makeDragStart, useNow, pad2, type Pos } from './clock-utils';
import type { ClockState } from './useClockTools';
import { useTranslation } from '@/hooks/usePreferences';
import { FloatingInlineContext } from './floatingInline';

interface ClockWidgetProps {
  clock: ClockState;
  onMove: (p: Pos) => void;
  onClose: () => void;
  onToggleMode: () => void;
}

function DigitalDisplay({ now }: { now: Date }) {
  return (
    <div className="py-3 text-center" style={{ color: 'hsl(var(--foreground))' }}>
      <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 40, fontWeight: 800, letterSpacing: 1, lineHeight: 1 }}>
        {pad2(now.getHours())}:{pad2(now.getMinutes())}
        <span style={{ fontSize: 20, fontWeight: 700, opacity: 0.65 }}>:{pad2(now.getSeconds())}</span>
      </div>
      <div className="mt-1.5 text-xs" style={{ color: 'hsl(var(--text-muted))' }}>
        {now.toLocaleDateString()}
      </div>
    </div>
  );
}

/**
 * Floating clock. By default only the clock (analog face / digital readout) is
 * shown — clean, no surrounding box. Hovering reveals the panel box plus the
 * mode-switch and close controls. Drag from the clock itself.
 */
export function ClockWidget({ clock, onMove, onClose, onToggleMode }: ClockWidgetProps) {
  const { t } = useTranslation();
  const now = useNow(true);
  // Inline (mobile clock-tools section): static, full-width card; controls and
  // the box always visible (no hover), and dragging disabled.
  const inline = useContext(FloatingInlineContext);

  return (
    <div
      className={inline ? 'group relative w-full' : 'group'}
      style={inline ? undefined : { position: 'fixed', left: clock.pos.x, top: clock.pos.y, width: 168, zIndex: 25 }}
    >
      {/* Box — fades in only on hover (clean clock by default); always shown inline. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-150 ${inline ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        style={{
          backgroundColor: 'hsl(var(--surface))',
          border: '1px solid hsl(var(--border))',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}
      />

      {/* Hover controls — mode switch + close, top-right; always shown inline. */}
      <div
        data-no-drag
        className={`absolute right-1.5 top-1.5 z-20 flex items-center gap-1 transition-opacity duration-150 ${inline ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'}`}
      >
        <button
          type="button"
          onClick={onToggleMode}
          className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}
        >
          {clock.mode === 'analog' ? t('clock.digital') : t('clock.analog')}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('clock.close')}
          className="grid h-5 w-5 place-items-center rounded transition-colors hover:bg-black/10"
          style={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
        >
          <X className="h-3 w-3" style={{ color: 'hsl(var(--text-muted))' }} />
        </button>
      </div>

      {/* Clock face — always visible; drag from here (disabled inline). */}
      <div
        onPointerDown={inline ? undefined : makeDragStart(clock.pos, onMove)}
        className={`relative z-10 grid place-items-center px-3 py-3 ${inline ? '' : 'cursor-grab touch-none select-none active:cursor-grabbing'}`}
      >
        {clock.mode === 'analog' ? <AnalogClock date={now} size={140} /> : <DigitalDisplay now={now} />}
      </div>
    </div>
  );
}
