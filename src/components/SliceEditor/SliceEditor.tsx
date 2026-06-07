import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { labelAnchorInside, truncateLabel } from '@/lib/svg-geometry';
import { IconChips } from './IconChips';
import { ColorSwatch } from './ColorSwatch';
import { IconPickerDialog } from '@/components/IconPicker/IconPickerDialog';
import { cn } from '@/lib/utils';
import type { TimeSlice } from '@/types/time-slice';

// ─── Character counter helpers ────────────────────────────────────────────────

function getGraphemeCount(text: string): number {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter('ko', { granularity: 'grapheme' });
    return [...seg.segment(text)].length;
  }
  return text.length;
}

function hasKorean(text: string): boolean {
  return /[가-힣ᄀ-ᇿ㄰-㆏]/.test(text);
}

function isOverLimit(text: string): boolean {
  if (hasKorean(text)) {
    return getGraphemeCount(text) > 12;
  }
  return text.length > 24;
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface SliceEditorProps {
  sliceId: string | null;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onClose: () => void;
}

// ─── Inner editor (remounts when sliceId changes via key prop) ────────────────

interface SliceEditorInnerProps {
  slice: TimeSlice;
  sliceId: string;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onClose: () => void;
}

function SliceEditorInner({ slice, sliceId, svgRef, onClose }: SliceEditorInnerProps) {
  const dispatch = useStoreDispatch();

  // State initializes from slice on mount; key={sliceId} forces remount on change
  const [label, setLabel] = useState(slice.label);
  const [icon, setIcon] = useState(slice.icon ?? '');
  const [color, setColor] = useState(slice.color ?? '#9ca3af');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pos, setPos] = useState({ left: '50%', top: '50%' });
  const inputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Compute position from SVG centroid
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const { x, y } = labelAnchorInside(slice);
    const screenX = ctm.a * x + ctm.c * y + ctm.e;
    const screenY = ctm.b * x + ctm.d * y + ctm.f;
    setPos({ left: `${screenX}px`, top: `${screenY}px` });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount; position doesn't change while editor is open

  // Auto-focus
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, []);

  const commit = useCallback(() => {
    const truncated = truncateLabel(label);
    dispatch({
      type: 'REPLACE_SLICE',
      id: sliceId,
      patch: { label: truncated, icon, color },
    });
    onClose();
  }, [dispatch, sliceId, label, icon, color, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [commit, onClose],
  );

  // Close on outside click — commits (saves) like Enter, so edits aren't lost.
  // The icon picker is a separate modal portal with its own backdrop; while it's
  // open we suspend this so clicking inside the picker doesn't close the editor.
  // Attachment is deferred one macrotask so the opening double-click can't
  // immediately re-close the editor.
  useEffect(() => {
    if (pickerOpen) return;
    let attached = false;
    function onDocPointerDown(e: PointerEvent) {
      const el = editorRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return; // inside editor
      commit();
    }
    const id = window.setTimeout(() => {
      document.addEventListener('pointerdown', onDocPointerDown, true);
      attached = true;
    }, 0);
    return () => {
      window.clearTimeout(id);
      if (attached) document.removeEventListener('pointerdown', onDocPointerDown, true);
    };
  }, [pickerOpen, commit]);

  const overLimit = isOverLimit(label);

  return createPortal(
    <div
      ref={editorRef}
      role="dialog"
      aria-label="슬라이스 편집"
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        width: 280,
      }}
      className="rounded-xl border bg-background shadow-2xl p-3 flex flex-col gap-2"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Label input */}
      <div className="flex flex-col gap-1">
        <Input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="예: 수면, 오전 업무"
          aria-invalid={overLimit}
          className={cn(
            'h-8 text-sm',
            overLimit && 'border-red-500 focus-visible:ring-red-500',
          )}
        />
        {overLimit && (
          <p className="text-xs text-red-500">
            {hasKorean(label)
              ? `한글 12자 초과 (현재 ${getGraphemeCount(label)}자)`
              : `24자 초과 (현재 ${label.length}자)`}
          </p>
        )}
      </div>

      {/* Icon chips */}
      <IconChips
        query={label}
        selectedIcon={icon}
        onPick={(emoji, lucideId) => {
          setIcon(emoji);
          void lucideId;
        }}
        onOpenPicker={() => setPickerOpen(true)}
      />

      {/* Color swatches */}
      <ColorSwatch selectedColor={color} onPick={setColor} />

      {/* Hint */}
      <p className="text-[10px] text-muted-foreground">
        Enter 저장 · ESC 취소
      </p>

      {/* Icon picker dialog */}
      <IconPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedIcon={icon}
        onPick={(emoji, lucideId) => {
          setIcon(emoji);
          void lucideId;
        }}
      />
    </div>,
    document.body,
  );
}

// ─── Outer shell — guards null sliceId ───────────────────────────────────────

export function SliceEditor({ sliceId, svgRef, onClose }: SliceEditorProps) {
  const slice = useStoreSelector((s) =>
    sliceId ? s.history.present.slices.find((sl) => sl.id === sliceId) : undefined,
  );

  if (!sliceId || !slice) return null;

  return (
    <SliceEditorInner
      key={sliceId}
      slice={slice}
      sliceId={sliceId}
      svgRef={svgRef}
      onClose={onClose}
    />
  );
}
