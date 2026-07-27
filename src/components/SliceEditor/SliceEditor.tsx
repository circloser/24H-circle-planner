import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { labelAnchorInside, truncateLabel } from '@/lib/svg-geometry';
import { IconChips } from './IconChips';
import { ColorSwatch } from './ColorSwatch';
import { IconPickerDialog } from '@/components/IconPicker/IconPickerDialog';
import { useTimePalette } from '@/hooks/useTimePalette';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useTranslation } from '@/hooks/usePreferences';
import { idealTextColor } from '@/lib/contrast';
import { track } from '@/lib/track';
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

// ─── Text styling ─────────────────────────────────────────────────────────────

// Matches LABEL_TEXT_DEFAULT in SliceLabel — the readable default on pastels.
const TEXT_DEFAULT = '#1f2937';
const TEXT_COLORS = ['#1f2937', '#ffffff', '#ef4444', '#f59e0b', '#16a34a', '#2563eb', '#7c3aed'];

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
  const { items: palette } = useTimePalette();
  const dispatch = useStoreDispatch();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  // Boundary indices for direct time editing (mobile): boundary i sits at the
  // END of slices[i], so this slice's end = its own index, start = previous.
  const sliceCount = useStoreSelector((s) => s.history.present.slices.length);
  const sliceIndex = useStoreSelector((s) =>
    s.history.present.slices.findIndex((x) => x.id === sliceId),
  );

  // State initializes from slice on mount; key={sliceId} forces remount on change
  const [label, setLabel] = useState(slice.label);
  const [icon, setIcon] = useState(slice.icon ?? '');
  const [color, setColor] = useState(slice.color ?? '#9ca3af');
  const [textColor, setTextColor] = useState(slice.textColor ?? '');
  const [bold, setBold] = useState(slice.bold ?? false);
  const [italic, setItalic] = useState(slice.italic ?? false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Editor centre in viewport px; null until computed (renders centred meanwhile).
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Compute position from the SVG centroid, CLAMPED into the viewport — on
  // mobile an edge slice would otherwise push half the 280px editor off-screen
  // (untappable inputs). Vertical clamp uses an estimate; the effect below
  // measures the real box after paint and nudges the remainder.
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const { x, y } = labelAnchorInside(slice);
    const screenX = ctm.a * x + ctm.c * y + ctm.e;
    const screenY = ctm.b * x + ctm.d * y + ctm.f;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const halfW = 148; // 280/2 + 8px margin
    setPos({
      left: Math.min(Math.max(screenX, halfW), Math.max(halfW, vw - halfW)),
      top: Math.min(Math.max(screenY, 200), Math.max(200, vh - 210)),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount; position doesn't change while editor is open

  // Second pass: the editor's height varies (palette chips, warnings), so after
  // the first paint measure the actual rect and shift it fully on-screen.
  const adjustedRef = useRef(false);
  useEffect(() => {
    if (!pos || adjustedRef.current) return;
    adjustedRef.current = true;
    requestAnimationFrame(() => {
      const el = editorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let dx = 0;
      let dy = 0;
      if (r.left < 8) dx = 8 - r.left;
      else if (r.right > vw - 8) dx = vw - 8 - r.right;
      if (r.top < 60) dy = 60 - r.top;
      else if (r.bottom > vh - 8) dy = vh - 8 - r.bottom;
      if (dx || dy) setPos((p) => (p ? { left: p.left + dx, top: p.top + dy } : p));
    });
  }, [pos]);

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
      patch: { label: truncated, icon, color, textColor: textColor || undefined, bold, italic },
    });
    onClose();
  }, [dispatch, sliceId, label, icon, color, textColor, bold, italic, onClose]);

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
      aria-label={t('editor.aria')}
      style={{
        position: 'fixed',
        left: pos ? `${pos.left}px` : '50%',
        top: pos ? `${pos.top}px` : '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        width: 280,
      }}
      className="rounded-xl border bg-background shadow-2xl p-3 flex flex-col gap-2"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Time-palette chips — one tap fills label + colour + icon with a saved
          recurring item (managed in 디자인 → 타임 팔레트). Hidden when empty. */}
      {palette.length > 0 && (
        <div className="flex max-h-16 flex-wrap gap-1 overflow-y-auto">
          {palette.map((it) => (
            <button
              key={it.id}
              type="button"
              data-palette-chip
              title={it.label}
              onClick={() => {
                setLabel(it.label);
                setColor(it.color);
                setIcon(it.icon);
                track('palette_apply');
              }}
              className="inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-xs transition-transform hover:scale-105"
              style={{ backgroundColor: it.color, color: idealTextColor(it.color) }}
            >
              {it.icon && <span aria-hidden>{it.icon}</span>}
              <span className="truncate">{it.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Label input */}
      <div className="flex flex-col gap-1">
        <Input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('editor.namePlaceholder')}
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

      {/* Start/end time editing — mobile only (desktop adjusts by dragging the
          boundary handles). Changes apply live via RESIZE_BOUNDARY; invalid
          values are rejected by the schedule model (no-op). Hidden for a
          single-slice day (no boundaries to move). */}
      {isMobile && sliceCount > 1 && sliceIndex >= 0 && (
        <div className="flex items-stretch gap-2">
          {/* min-w-0 lets the flex items shrink below the native time picker's
              intrinsic width; without it the second input overflows the 280px
              editor and hangs off the screen edge. */}
          <label className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[11px] font-medium text-muted-foreground">{t('block.start')}</span>
            <input
              type="time"
              step={300}
              value={slice.startTime === '24:00' ? '00:00' : slice.startTime}
              onChange={(e) => {
                if (!e.target.value) return;
                dispatch({
                  type: 'RESIZE_BOUNDARY',
                  boundaryIndex: (sliceIndex - 1 + sliceCount) % sliceCount,
                  newHHmm: e.target.value,
                });
              }}
              className="w-full min-w-0 rounded-md border border-border bg-background px-1.5 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[11px] font-medium text-muted-foreground">{t('block.end')}</span>
            <input
              type="time"
              step={300}
              value={slice.endTime === '24:00' ? '00:00' : slice.endTime}
              onChange={(e) => {
                if (!e.target.value) return;
                dispatch({
                  type: 'RESIZE_BOUNDARY',
                  boundaryIndex: sliceIndex,
                  newHHmm: e.target.value,
                });
              }}
              className="w-full min-w-0 rounded-md border border-border bg-background px-1.5 py-1.5 text-sm text-foreground"
            />
          </label>
        </div>
      )}

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

      {/* Text style: bold / italic / colour */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={t('editor.bold')}
          aria-pressed={bold}
          onClick={() => setBold((v) => !v)}
          className="opt-chip h-8 w-8 rounded-md text-sm font-bold flex items-center justify-center"
        >
          B
        </button>
        <button
          type="button"
          aria-label={t('editor.italic')}
          aria-pressed={italic}
          onClick={() => setItalic((v) => !v)}
          className="opt-chip h-8 w-8 rounded-md text-sm italic flex items-center justify-center"
        >
          I
        </button>
        <span className="w-px h-5 mx-0.5 bg-border" />
        <div className="flex items-center gap-1">
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`${t('editor.textColor')} ${c}`}
              data-selected={(textColor || TEXT_DEFAULT) === c}
              onClick={() => setTextColor(c)}
              className="opt-pick h-5 w-5 rounded-full"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Color swatches */}
      <ColorSwatch selectedColor={color} onPick={setColor} />

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
