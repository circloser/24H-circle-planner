import { useContext, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { makeDragStart, anchoredStyle, type Pos } from './clock-utils';
import { FloatingInlineContext } from './floatingInline';

interface FloatingPanelProps {
  pos: Pos;
  width: number;
  title: string;
  closeLabel: string;
  onMove: (p: Pos) => void;
  onClose: () => void;
  /** Optional controls rendered at the right of the header (e.g. a mode switch). */
  headerRight?: ReactNode;
  children: ReactNode;
}

/** A draggable, closable floating card. Drag by the header; header controls and
 *  the body opt out of dragging via `[data-no-drag]`. */
export function FloatingPanel({
  pos,
  width,
  title,
  closeLabel,
  onMove,
  onClose,
  headerRight,
  children,
}: FloatingPanelProps) {
  const inline = useContext(FloatingInlineContext);

  // Inline (mobile): a static, full-width card stacked in the clock-tools
  // section — no fixed positioning, no drag handle. pos/width/onMove are unused.
  if (inline) {
    return (
      <div
        className="w-full overflow-hidden rounded-xl shadow-sm"
        style={{ border: '1px solid hsl(var(--border))' }}
      >
        <div
          className="flex select-none items-center gap-1.5 px-2.5 py-1.5"
          style={{ backgroundColor: 'hsl(var(--surface))', borderBottom: '1px solid hsl(var(--border))' }}
        >
          <span className="truncate text-xs font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
            {title}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {headerRight}
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="grid h-6 w-6 place-items-center rounded transition-colors hover:bg-black/10"
            >
              <X className="h-3.5 w-3.5" style={{ color: 'hsl(var(--text-muted))' }} />
            </button>
          </div>
        </div>
        <div className="px-3 py-3" style={{ backgroundColor: 'hsl(var(--surface))' }}>
          {children}
        </div>
      </div>
    );
  }

  // Desktop: match the clock/weather widgets — the content floats bare, and the
  // card box + controls fade in only on hover (transparent by default). Drag from
  // the body; interactive controls opt out via [data-no-drag].
  return (
    <div
      aria-label={title}
      className="group z-[25] hover:z-[26]"
      style={{ ...anchoredStyle(pos.x, pos.y), width }}
    >
      {/* Box — fades in on hover; clean/transparent otherwise. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl border border-border bg-surface opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
      />

      {/* Hover controls (extra controls + close), top-right. */}
      <div
        data-no-drag
        className="absolute right-1.5 top-1.5 z-20 flex items-center gap-1 pointer-events-none opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100"
      >
        {headerRight}
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="grid h-5 w-5 place-items-center rounded border border-border bg-background text-muted-foreground transition-colors hover:bg-black/10"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Body — always visible; drag from here. */}
      <div
        onPointerDown={makeDragStart(pos, onMove)}
        className="relative z-10 cursor-grab touch-none select-none px-3 py-3 active:cursor-grabbing"
      >
        {children}
      </div>
    </div>
  );
}
