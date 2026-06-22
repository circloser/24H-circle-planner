import type { ReactNode } from 'react';
import { X, GripHorizontal } from 'lucide-react';
import { makeDragStart, type Pos } from './clock-utils';

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
  return (
    <div
      style={{ position: 'fixed', left: pos.x, top: pos.y, width, zIndex: 25 }}
      className="overflow-hidden rounded-xl shadow-xl"
    >
      <div
        onPointerDown={makeDragStart(pos, onMove)}
        className="flex cursor-grab touch-none select-none items-center gap-1.5 px-2.5 py-1.5 active:cursor-grabbing"
        style={{ backgroundColor: 'hsl(var(--surface))', borderBottom: '1px solid hsl(var(--border))' }}
      >
        <GripHorizontal className="h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(var(--text-muted))' }} />
        <span className="truncate text-xs font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
          {title}
        </span>
        <div className="ml-auto flex items-center gap-1" data-no-drag>
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
      <div
        className="px-3 py-3"
        style={{ backgroundColor: 'hsl(var(--surface))', borderTop: 'none' }}
      >
        {children}
      </div>
    </div>
  );
}
