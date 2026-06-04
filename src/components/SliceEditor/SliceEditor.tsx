import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { labelAnchorInside, truncateLabel } from '@/lib/svg-geometry';
import { hhmmToMinutes, minutesToHhmm, sliceWidthMinutes } from '@/lib/time-utils';
import { IconChips } from './IconChips';
import { ColorSwatch } from './ColorSwatch';
import { IconPickerDialog } from '@/components/IconPicker/IconPickerDialog';
import { cn } from '@/lib/utils';
import type { TimeSlice } from '@/types/time-slice';
import type { Schedule } from '@/types/schedule';

// ─── Slice split / delete helpers ────────────────────────────────────────────

/** Compute the midpoint HH:mm for a slice (handles midnight wrap). */
function sliceMidpointHhmm(slice: TimeSlice): string {
  const startMin = hhmmToMinutes(slice.startTime);
  const widthMin = sliceWidthMinutes(slice);
  const midMin = (startMin + Math.floor(widthMin / 2)) % 1440;
  // Snap to 10-minute boundary
  const snapped = Math.round(midMin / 10) * 10 % 1440;
  return minutesToHhmm(snapped);
}

/**
 * Find the CCW (previous / earlier-in-time) neighbor of the given slice.
 * Slices are ordered by startTime; the CCW neighbor is the one whose endTime
 * equals this slice's startTime (handles wrap around midnight).
 */
function findCcwNeighbor(sliceId: string, schedule: Schedule): TimeSlice | undefined {
  const { slices } = schedule;
  const idx = slices.findIndex((s) => s.id === sliceId);
  if (idx === -1) return undefined;
  // Previous index wrapping around
  const prevIdx = (idx - 1 + slices.length) % slices.length;
  return slices[prevIdx];
}

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
  onTab?: () => void;
}

// ─── Inner editor (remounts when sliceId changes via key prop) ────────────────

interface SliceEditorInnerProps {
  slice: TimeSlice;
  sliceId: string;
  schedule: Schedule;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onClose: () => void;
  onTab?: () => void;
}

function SliceEditorInner({ slice, sliceId, schedule, svgRef, onClose, onTab }: SliceEditorInnerProps) {
  const dispatch = useStoreDispatch();

  // State initializes from slice on mount; key={sliceId} forces remount on change
  const [label, setLabel] = useState(slice.label);
  const [icon, setIcon] = useState(slice.icon ?? '');
  const [color, setColor] = useState(slice.color ?? '#9ca3af');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pos, setPos] = useState({ left: '50%', top: '50%' });
  const inputRef = useRef<HTMLInputElement>(null);

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
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commit();
        onTab?.();
      }
    },
    [commit, onClose, onTab],
  );

  const overLimit = isOverLimit(label);

  // ── 분할 (split) logic ──────────────────────────────────────────────────────
  const widthMin = sliceWidthMinutes(slice);
  // Can only split if slice is ≥ 20 min (each half ≥ 10 min after split)
  const canSplit = widthMin >= 20;
  const splitTooltip = canSplit ? undefined : '너무 짧아 분할할 수 없습니다';

  const handleSplit = useCallback(() => {
    if (!canSplit) return;
    const midHhmm = sliceMidpointHhmm(slice);
    // Commit current edits first, then split
    const truncated = truncateLabel(label);
    dispatch({ type: 'REPLACE_SLICE', id: sliceId, patch: { label: truncated, icon, color } });
    dispatch({ type: 'SPLIT', hhmm: midHhmm });
    onClose();
  }, [canSplit, slice, label, icon, color, sliceId, dispatch, onClose]);

  // ── 삭제 (delete) logic ─────────────────────────────────────────────────────
  const isOnlySlice = schedule.slices.length <= 1;
  const deleteTooltip = isOnlySlice ? '마지막 일정은 삭제할 수 없습니다' : undefined;
  const ccwNeighbor = findCcwNeighbor(sliceId, schedule);

  const handleDelete = useCallback(() => {
    if (isOnlySlice || !ccwNeighbor) return;
    dispatch({ type: 'MERGE', idCw: sliceId, idCcw: ccwNeighbor.id });
    onClose();
  }, [isOnlySlice, ccwNeighbor, sliceId, dispatch, onClose]);

  return createPortal(
    <div
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
      className="rounded-xl border bg-background/95 backdrop-blur-sm shadow-2xl p-3 flex flex-col gap-2"
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

      {/* 분할 / 삭제 action buttons */}
      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          disabled={!canSplit}
          title={splitTooltip}
          onClick={handleSplit}
          aria-label="슬라이스 분할"
        >
          분할
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="flex-1 text-xs"
          disabled={isOnlySlice}
          title={deleteTooltip}
          onClick={handleDelete}
          aria-label="슬라이스 삭제"
        >
          삭제
        </Button>
      </div>

      {/* Hint */}
      <p className="text-[10px] text-muted-foreground">
        Enter 저장 · ESC 취소 · Tab 다음 · 더블클릭으로 편집
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

export function SliceEditor({ sliceId, svgRef, onClose, onTab }: SliceEditorProps) {
  const slice = useStoreSelector((s) =>
    sliceId ? s.history.present.slices.find((sl) => sl.id === sliceId) : undefined,
  );
  const schedule = useStoreSelector((s) => s.history.present);

  if (!sliceId || !slice) return null;

  return (
    <SliceEditorInner
      key={sliceId}
      slice={slice}
      sliceId={sliceId}
      schedule={schedule}
      svgRef={svgRef}
      onClose={onClose}
      onTab={onTab}
    />
  );
}
