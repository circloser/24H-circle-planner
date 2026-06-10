import { useRef, useCallback, useEffect } from 'react';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { angleToHhmm, hhmmToAngle, sliceWidthMinutes } from '@/lib/time-utils';
import { slicePath, RING, polarToCartesian } from '@/lib/svg-geometry';
import type { TimeSlice } from '@/types/time-slice';
import type { Schedule } from '@/types/schedule';
import type { DragRef } from '@/types/drag';

// ─── Public interface ─────────────────────────────────────────────────────────

export interface UseSliceInteractionResult {
  liveDragGroupRef: React.RefObject<SVGGElement | null>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  handlers: {
    onPointerDownHandle: (e: React.PointerEvent<SVGElement>, boundaryIndex: number) => void;
    onSliceDoubleClick: (sliceId: string) => void;
    /** Call on SVG background click to split a slice at the clicked position. */
    onBackgroundClick: (e: React.MouseEvent<SVGElement>) => void;
  };
  isDragging: boolean;
}

// ─── Internal scratch ─────────────────────────────────────────────────────────

interface DragScratch {
  startX: number;
  startY: number;
  pointerId: number;
  pendingBoundaryIndex: number;
  thresholdCrossed: boolean;
  lastHHmm: string;
}

const DRAG_THRESHOLD_PX = 4;

// ─── SVG coordinate helpers ───────────────────────────────────────────────────

function clientToSvgPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  if (typeof svg.getScreenCTM !== 'function') return { x: clientX, y: clientY };
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  if (typeof svg.createSVGPoint !== 'function') return { x: clientX, y: clientY };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(ctm.inverse());
}

function svgPointToAngleDeg(x: number, y: number): number {
  const { cx, cy } = RING;
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
}

function recomputeAdjacentPaths(
  slices: TimeSlice[],
  boundaryIndex: number,
  newHHmm: string,
): { ccwD: string; cwD: string } {
  const len = slices.length;
  const ccwSlice = slices[boundaryIndex];
  const cwSlice = slices[(boundaryIndex + 1) % len];
  const modifiedCcw: TimeSlice = { ...ccwSlice, endTime: newHHmm };
  const modifiedCw: TimeSlice = { ...cwSlice, startTime: newHHmm };
  if (sliceWidthMinutes(modifiedCcw) <= 0 || sliceWidthMinutes(modifiedCw) <= 0) {
    return { ccwD: slicePath(ccwSlice, RING), cwD: slicePath(cwSlice, RING) };
  }
  return { ccwD: slicePath(modifiedCcw, RING), cwD: slicePath(modifiedCw, RING) };
}

// ─── Boundary handle imperative move ─────────────────────────────────────────

/**
 * Imperatively move the circles inside a boundary handle group to a new position.
 * Mirrors the same pattern as the path `d` writes — no React re-render during drag.
 * Called from the pointermove handler to keep the handle circle tracking the cursor.
 */
function moveBoundaryHandleImperative(
  svg: SVGSVGElement,
  boundaryIndex: number,
  hhmm: string,
): void {
  const { innerR, outerR, cx, cy } = RING;
  const midR = (innerR + outerR) / 2;
  const angleDeg = hhmmToAngle(hhmm);
  const { x, y } = polarToCartesian(cx, cy, midR, angleDeg);

  const handleGroup = svg.querySelector<SVGGElement>(`[data-boundary-index="${boundaryIndex}"]`);
  if (!handleGroup) return;

  handleGroup.querySelectorAll('circle').forEach((circle) => {
    circle.setAttribute('cx', String(x));
    circle.setAttribute('cy', String(y));
  });

  // Boundary time pill — reposition + relabel to the live cursor time so it
  // tracks the division exactly during the drag (no React re-render). Queried
  // from the svg root with a compound selector so it resolves to null gracefully
  // when the pill isn't mounted (e.g. unit-test mocks).
  const pillRect = svg.querySelector<SVGRectElement>(
    `[data-boundary-index="${boundaryIndex}"] [data-time-pill-rect]`,
  );
  const pillText = svg.querySelector<SVGTextElement>(
    `[data-boundary-index="${boundaryIndex}"] [data-time-pill-text]`,
  );
  if (pillRect && pillText) {
    const t = polarToCartesian(cx, cy, midR + 50, angleDeg);
    pillRect.setAttribute('x', String(t.x - 26));
    pillRect.setAttribute('y', String(t.y - 13));
    pillText.setAttribute('x', String(t.x));
    pillText.setAttribute('y', String(t.y));
    pillText.textContent = hhmm === '24:00' ? '00:00' : hhmm;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSliceInteraction(opts: {
  onRequestEdit: (sliceId: string) => void;
}): UseSliceInteractionResult {
  const dispatch = useStoreDispatch();
  const isDraggingBoundary = useStoreSelector((s) => s.isDraggingBoundary);

  // DOM refs
  const liveDragGroupRef = useRef<SVGGElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const scratchRef = useRef<DragScratch | null>(null);

  // Stable refs updated via useEffect — avoid mutating during render
  const presentRef = useRef<Schedule | null>(null);
  const dragRefStoreRef = useRef<DragRef | null>(null);
  const isDraggingRef = useRef(false);
  const optsRef = useRef(opts);

  const presentFromStore = useStoreSelector((s) => s.history.present);
  const dragRefFromStore = useStoreSelector((s) => s.dragRef);

  // Update refs after render (useEffect runs after paint, which is fine for event handlers)
  useEffect(() => {
    presentRef.current = presentFromStore;
  });
  useEffect(() => {
    dragRefStoreRef.current = dragRefFromStore;
  });
  useEffect(() => {
    isDraggingRef.current = isDraggingBoundary;
  });
  useEffect(() => {
    optsRef.current = opts;
  });

  // ── Window-level event handlers — created once, stored in refs ────────────

  // We use lazy init via useRef(null) + populate inside a one-time useEffect.
  const windowMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const windowUpRef = useRef<((e: PointerEvent) => void) | null>(null);
  const windowCancelRef = useRef<((e: PointerEvent) => void) | null>(null);

  // cancelDragRef must be stable so useKeyboardShortcuts can call it
  const cancelDragRef = useRef<() => void>(() => {});

  useEffect(() => {
    function detach() {
      if (windowMoveRef.current) window.removeEventListener('pointermove', windowMoveRef.current);
      if (windowUpRef.current) window.removeEventListener('pointerup', windowUpRef.current);
      if (windowCancelRef.current) window.removeEventListener('pointercancel', windowCancelRef.current);
    }

    function performCancelDrag() {
      detach();
      const g = liveDragGroupRef.current;
      const dragRef = dragRefStoreRef.current;
      if (g && dragRef) {
        g.querySelectorAll<SVGPathElement>('[data-slice-id]').forEach((child) => {
          const id = child.getAttribute('data-slice-id');
          if (id && dragRef.originalSlicePaths[id] !== undefined) {
            child.setAttribute('d', dragRef.originalSlicePaths[id]);
          }
        });
        // Issue T13 / Issue 2: restore boundary handle to original position on cancel.
        // Original endTime of the CCW slice defines the original boundary angle.
        const svgEl = svgRef.current;
        if (svgEl) {
          const ccwSlice = dragRef.snapshot.slices[dragRef.boundaryIndex];
          const originalHhmm = ccwSlice.endTime === '24:00' ? '00:00' : ccwSlice.endTime;
          moveBoundaryHandleImperative(svgEl, dragRef.boundaryIndex, originalHhmm);
        }
      }
      dispatch({ type: 'SET_DRAG_REF', value: null });
      dispatch({ type: 'SET_IS_DRAGGING_BOUNDARY', value: false });
      scratchRef.current = null;
    }

    cancelDragRef.current = performCancelDrag;

    windowMoveRef.current = function handleWindowPointerMove(e: PointerEvent) {
      const scratch = scratchRef.current;
      if (!scratch || e.pointerId !== scratch.pointerId) return;

      if (!scratch.thresholdCrossed) {
        const dx = e.clientX - scratch.startX;
        const dy = e.clientY - scratch.startY;
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD_PX) return;

        const present = presentRef.current;
        if (!present) return;

        const slices = present.slices;
        const len = slices.length;
        const bi = scratch.pendingBoundaryIndex;
        if (bi < 0 || bi >= len) return;

        const ccwSlice = slices[bi];
        const cwSlice = slices[(bi + 1) % len];
        const affectedSliceIds = new Set([ccwSlice.id, cwSlice.id]);

        const originalSlicePaths: Record<string, string> = {};
        const g = liveDragGroupRef.current;
        if (g) {
          affectedSliceIds.forEach((id) => {
            const el = g.querySelector<SVGPathElement>(`[data-slice-id="${id}"]`);
            if (el) originalSlicePaths[id] = el.getAttribute('d') ?? '';
          });
        }

        const svg = svgRef.current;
        let initialHHmm: string;
        if (svg) {
          const { x, y } = clientToSvgPoint(svg, e.clientX, e.clientY);
          initialHHmm = angleToHhmm(svgPointToAngleDeg(x, y));
        } else {
          initialHHmm = ccwSlice.endTime === '24:00' ? '00:00' : ccwSlice.endTime;
        }

        scratch.thresholdCrossed = true;
        scratch.lastHHmm = initialHHmm;

        dispatch({
          type: 'SET_DRAG_REF',
          value: { snapshot: present, boundaryIndex: bi, affectedSliceIds, originalSlicePaths },
        });
        dispatch({ type: 'SET_IS_DRAGGING_BOUNDARY', value: true });
        return;
      }

      // Normal drag move — imperative DOM write
      const dragRef = dragRefStoreRef.current;
      if (!dragRef) return;

      const svg = svgRef.current;
      let hhmm: string;
      if (svg) {
        const { x, y } = clientToSvgPoint(svg, e.clientX, e.clientY);
        hhmm = angleToHhmm(svgPointToAngleDeg(x, y));
      } else {
        hhmm = scratch.lastHHmm;
      }

      if (hhmm === scratch.lastHHmm) return;
      scratch.lastHHmm = hhmm;

      const { ccwD, cwD } = recomputeAdjacentPaths(
        dragRef.snapshot.slices,
        dragRef.boundaryIndex,
        hhmm,
      );

      const g = liveDragGroupRef.current;
      if (!g) return;

      const ccwSlice = dragRef.snapshot.slices[dragRef.boundaryIndex];
      const cwIdx = (dragRef.boundaryIndex + 1) % dragRef.snapshot.slices.length;
      const cwSlice = dragRef.snapshot.slices[cwIdx];

      g.querySelector<SVGPathElement>(`[data-slice-id="${ccwSlice.id}"]`)?.setAttribute('d', ccwD);
      g.querySelector<SVGPathElement>(`[data-slice-id="${cwSlice.id}"]`)?.setAttribute('d', cwD);

      // Issue T13 / Issue 2: also move the boundary handle circle imperatively
      // so it tracks the cursor live (no React re-render during drag).
      const svgEl = svgRef.current;
      if (svgEl) {
        moveBoundaryHandleImperative(svgEl, dragRef.boundaryIndex, hhmm);
      }
    };

    windowUpRef.current = function handleWindowPointerUp(e: PointerEvent) {
      const scratch = scratchRef.current;
      if (!scratch || e.pointerId !== scratch.pointerId) return;

      detach();

      const dragRef = dragRefStoreRef.current;

      if (!scratch.thresholdCrossed || !dragRef) {
        dispatch({ type: 'SET_DRAG_REF', value: null });
        dispatch({ type: 'SET_IS_DRAGGING_BOUNDARY', value: false });
        scratchRef.current = null;
        return;
      }

      const svg = svgRef.current;
      let finalHHmm = scratch.lastHHmm;
      if (svg) {
        const { x, y } = clientToSvgPoint(svg, e.clientX, e.clientY);
        finalHHmm = angleToHhmm(svgPointToAngleDeg(x, y));
      }

      // React 18 batches all three
      dispatch({
        type: 'RESIZE_BOUNDARY',
        boundaryIndex: dragRef.boundaryIndex,
        newHHmm: finalHHmm,
        baseSnapshot: dragRef.snapshot,
      });
      dispatch({ type: 'SET_DRAG_REF', value: null });
      dispatch({ type: 'SET_IS_DRAGGING_BOUNDARY', value: false });
      scratchRef.current = null;
    };

    windowCancelRef.current = function handleWindowPointerCancel(e: PointerEvent) {
      const scratch = scratchRef.current;
      if (!scratch || e.pointerId !== scratch.pointerId) return;
      performCancelDrag();
    };

    // Cleanup on unmount: remove any lingering listeners
    return () => {
      detach();
    };
  }, [dispatch]);

  // ── attach / detach helpers ───────────────────────────────────────────────

  const attach = useCallback(() => {
    if (windowMoveRef.current) window.addEventListener('pointermove', windowMoveRef.current);
    if (windowUpRef.current) window.addEventListener('pointerup', windowUpRef.current);
    if (windowCancelRef.current) window.addEventListener('pointercancel', windowCancelRef.current);
  }, []);

  // ── onPointerDownHandle ───────────────────────────────────────────────────

  const onPointerDownHandle = useCallback(
    (e: React.PointerEvent<SVGElement>, boundaryIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        (e.target as SVGElement).setPointerCapture(e.pointerId);
      } catch {
        // jsdom doesn't support setPointerCapture
      }
      scratchRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
        pendingBoundaryIndex: boundaryIndex,
        thresholdCrossed: false,
        lastHHmm: '00:00',
      };
      attach();
    },
    [attach],
  );

  // ── onSliceDoubleClick ────────────────────────────────────────────────────

  const onSliceDoubleClick = useCallback((sliceId: string) => {
    optsRef.current.onRequestEdit(sliceId);
  }, []);

  // ── onBackgroundClick ─────────────────────────────────────────────────────

  const onBackgroundClick = useCallback(
    (e: React.MouseEvent<SVGElement>) => {
      if (isDraggingRef.current) return;
      const svg = svgRef.current;
      if (!svg) return;
      const { x, y } = clientToSvgPoint(svg, e.clientX, e.clientY);
      const hhmm = angleToHhmm(svgPointToAngleDeg(x, y));
      dispatch({ type: 'SPLIT', hhmm });
    },
    [dispatch],
  );

  return {
    liveDragGroupRef,
    svgRef,
    handlers: { onPointerDownHandle, onSliceDoubleClick, onBackgroundClick },
    isDragging: isDraggingBoundary,
  };
}

/**
 * Exported so useKeyboardShortcuts can invoke the same cancel-drag path.
 * The hook attaches this to cancelDragRef via the returned liveDragGroupRef
 * extended object — but a cleaner approach is a shared cancelDrag ref.
 * useKeyboardShortcuts re-implements cancel inline using the store state.
 */
export type { DragRef };
