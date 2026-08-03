import { useRef, useCallback, useEffect } from 'react';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { sliceWidthMinutes, snapMinutes, minutesToHhmm, hhmmToMinutes } from '@/lib/time-utils';
import { slicePath, RING, polarToCartesian, labelAnchorInside } from '@/lib/svg-geometry';
import { useChartView } from '@/hooks/usePreferences';
import { viewSpec, minForAngle, angleForMin, visibleSegments, FULL_SPEC, type ViewSpec } from '@/lib/chart-view';
import { resizeBoundary } from '@/lib/schedule';
import type { TimeSlice } from '@/types/time-slice';
import type { Schedule } from '@/types/schedule';
import type { DragRef } from '@/types/drag';

/** Chart angle (deg) → snapped "HH:mm" under the active view window. For the full
 *  24h view this matches the legacy angleToHhmm exactly. */
function angleToHhmmView(deg: number, spec: ViewSpec): string {
  return minutesToHhmm(snapMinutes(minForAngle(deg, spec)));
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface UseSliceInteractionResult {
  liveDragGroupRef: React.RefObject<SVGGElement | null>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  handlers: {
    onPointerDownHandle: (e: React.PointerEvent<SVGElement>, boundaryIndex: number) => void;
    onSliceDoubleClick: (sliceId: string) => void;
    /** Call on SVG background click to split a slice at the clicked position. */
    onBackgroundClick: (e: React.MouseEvent<SVGElement>) => void;
    /** Click a slice body (cut mode) to split it at the cursor; debounced so a
     *  double-click edits instead of splitting twice. */
    onSliceSplit: (e: React.MouseEvent<SVGElement>) => void;
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
  spec: ViewSpec,
): void {
  const { innerR, outerR, cx, cy } = RING;
  const midR = (innerR + outerR) / 2;
  // View-aware angle so the handle + pill track the cursor in the 12h views too.
  const angleDeg = angleForMin(hhmmToMinutes(hhmm), spec);
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

/**
 * Re-anchor a slice's label to the centroid of the given (modified) slice
 * geometry, so the label tracks its wedge live during a boundary drag without a
 * React re-render. 'inside' labels are positioned via transform (one attribute);
 * 'inside-narrow' icon-only labels via x/y; 'outside' labels are left alone.
 * Queried from the svg root so it resolves to null gracefully under test mocks.
 */
function moveSliceLabelImperative(
  svg: SVGSVGElement,
  slice: TimeSlice,
  radialOffset = 0,
  spec: ViewSpec = FULL_SPEC,
): void {
  if (sliceWidthMinutes(slice) <= 0) return;
  const el = svg.querySelector<SVGGraphicsElement>(`[data-label-id="${slice.id}"]`);
  if (!el) return;
  const { x, y } = labelAnchorInside(slice, RING, spec, radialOffset);
  const kind = el.getAttribute('data-label-kind');
  if (kind === 'inside') {
    el.setAttribute('transform', `translate(${x} ${y})`);
  } else if (kind === 'inside-narrow') {
    el.setAttribute('x', String(x));
    el.setAttribute('y', String(y));
  }
}

// ─── 12h-view live drag preview (clipped areas + labels) ──────────────────────

/** The largest visible segment of a slice within the view window, as a slice
 *  trimmed to that segment — mirrors CircleTimeline's labelSlices anchor. Null
 *  when the slice has no visible part in the window. */
function largestVisibleSegment(slice: TimeSlice, spec: ViewSpec): TimeSlice | null {
  const parts = visibleSegments(hhmmToMinutes(slice.startTime), sliceWidthMinutes(slice), spec);
  if (parts.length === 0) return null;
  const largest = parts.reduce((a, b) => (b.widthMin > a.widthMin ? b : a));
  return { ...slice, startTime: minutesToHhmm(largest.startMin), endTime: minutesToHhmm(largest.endMin) };
}

/** Rewrite a clipped slice's visible-segment path(s) to its modified geometry.
 *  Clipped segments of one slice share data-slice-id; surplus paths are blanked. */
function updateClippedSlicePaths(svg: SVGSVGElement, slice: TimeSlice, spec: ViewSpec): void {
  const paths = svg.querySelectorAll<SVGPathElement>(`path[data-slice-id="${slice.id}"]`);
  if (paths.length === 0) return;
  const segs = visibleSegments(hhmmToMinutes(slice.startTime), sliceWidthMinutes(slice), spec).map((p) => ({
    ...slice,
    startTime: minutesToHhmm(p.startMin),
    endTime: minutesToHhmm(p.endMin),
  }));
  paths.forEach((path, i) => {
    path.setAttribute('d', i < segs.length ? slicePath(segs[i], RING, spec) : '');
  });
}

// ─── Full boundary-resize live preview ───────────────────────────────────────

/** `resizeBoundary`, but null instead of throwing on an illegal (would-collapse)
 *  target — the caller keeps the last valid preview. */
function tryResize(snapshot: Schedule, boundaryIndex: number, hhmm: string): Schedule | null {
  try {
    return resizeBoundary(snapshot, boundaryIndex, hhmm);
  } catch {
    return null;
  }
}

/**
 * Render a boundary-drag preview imperatively, straight from the schedule that
 * `resizeBoundary` would commit for this cursor time. Every surviving slice is
 * redrawn to its new geometry and its label re-anchored; a slice the drag has
 * swept PAST is absorbed — its wedge is blanked and its label hidden — so
 * over-dragging a boundary visibly deletes the neighbour and the division keeps
 * tracking the cursor, exactly matching the eventual commit. (Replaces the old
 * 2-adjacent-slices-only preview, which fell apart the moment the boundary
 * crossed an adjacent slice.) Works in the full 24h and both 12h windows.
 *
 * Returns the ids whose labels were hidden, so drag-end can un-hide any that
 * survive (React won't reset an inline `display` it never set).
 */
export function applyResizePreview(
  svg: SVGSVGElement,
  snapshotSlices: TimeSlice[],
  preview: Schedule,
  spec: ViewSpec,
): Set<string> {
  const byId = new Map(preview.slices.map((s) => [s.id, s]));
  const hidden = new Set<string>();
  for (const orig of snapshotSlices) {
    const pv = byId.get(orig.id);
    // Wedge path(s): survivor → new geometry; absorbed → blanked.
    if (spec.view === 'full') {
      svg
        .querySelector<SVGPathElement>(`path[data-slice-id="${orig.id}"]`)
        ?.setAttribute('d', pv ? slicePath(pv, RING) : '');
    } else if (pv) {
      updateClippedSlicePaths(svg, pv, spec);
    } else {
      svg
        .querySelectorAll<SVGPathElement>(`path[data-slice-id="${orig.id}"]`)
        .forEach((p) => p.setAttribute('d', ''));
    }
    // Label: survivor re-anchored + shown; absorbed hidden.
    const labelEl = svg.querySelector<SVGGraphicsElement>(`[data-label-id="${orig.id}"]`);
    if (!pv) {
      if (labelEl) labelEl.style.display = 'none';
      hidden.add(orig.id);
      continue;
    }
    if (labelEl) labelEl.style.display = '';
    const labelSlice = spec.view === 'full' ? pv : largestVisibleSegment(pv, spec);
    if (labelSlice) moveSliceLabelImperative(svg, labelSlice, 0, spec);
  }
  return hidden;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSliceInteraction(opts: {
  onRequestEdit: (sliceId: string) => void;
}): UseSliceInteractionResult {
  const dispatch = useStoreDispatch();
  const isDraggingBoundary = useStoreSelector((s) => s.isDraggingBoundary);

  // Active view window (full 24h / 12h day / 12h night). All angle↔time uses this
  // so editing stays correct in any view; a ref keeps the window handlers current.
  const spec = viewSpec(useChartView());
  const specRef = useRef<ViewSpec>(spec);
  useEffect(() => {
    specRef.current = spec;
  });

  // DOM refs
  const liveDragGroupRef = useRef<SVGGElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const scratchRef = useRef<DragScratch | null>(null);
  // Ids whose labels the live preview has hidden (their slice is being absorbed
  // by an over-drag). Tracked so drag-end can un-hide any that end up surviving.
  const hiddenLabelIdsRef = useRef<Set<string>>(new Set());

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
      const dragRef = dragRefStoreRef.current;
      const svgEl = svgRef.current;
      // Cancel leaves `present` unchanged, so React won't re-render the affected
      // paths/labels — restore them to their snapshot geometry imperatively.
      if (dragRef && svgEl) {
        const sp = specRef.current;
        const ccwSlice = dragRef.snapshot.slices[dragRef.boundaryIndex];
        // Original endTime of the CCW slice defines the original boundary angle.
        const originalHhmm = ccwSlice.endTime === '24:00' ? '00:00' : ccwSlice.endTime;
        moveBoundaryHandleImperative(svgEl, dragRef.boundaryIndex, originalHhmm, sp);
        // Cancel leaves `present` unchanged, so React won't re-render the paths to
        // fix them — restore EVERY wedge + label from the snapshot (identity
        // preview also un-hides any labels an over-drag preview had hidden).
        applyResizePreview(svgEl, dragRef.snapshot.slices, dragRef.snapshot, sp);
      }
      hiddenLabelIdsRef.current = new Set();
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
          initialHHmm = angleToHhmmView(svgPointToAngleDeg(x, y), specRef.current);
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
        hhmm = angleToHhmmView(svgPointToAngleDeg(x, y), specRef.current);
      } else {
        hhmm = scratch.lastHHmm;
      }

      if (hhmm === scratch.lastHHmm) return;
      scratch.lastHHmm = hhmm;

      const sp = specRef.current;
      const svgEl = svgRef.current;
      if (!svgEl) return;

      // The boundary handle (dot) + time pill follow the cursor in EVERY view
      // (view-aware angle), so the division reads correctly while dragging in 12h.
      moveBoundaryHandleImperative(svgEl, dragRef.boundaryIndex, hhmm, sp);

      // Preview the ACTUAL resize result: dragging past a neighbour absorbs it
      // live (delete + redraw the division), instead of the old 2-slice-only
      // preview that broke apart once the boundary crossed an adjacent slice.
      // Works in the full and both 12h windows. Illegal moves (would collapse)
      // keep the last valid preview. Commits on release with the same math.
      const preview = tryResize(dragRef.snapshot, dragRef.boundaryIndex, hhmm);
      if (preview) {
        hiddenLabelIdsRef.current = applyResizePreview(svgEl, dragRef.snapshot.slices, preview, sp);
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
        finalHHmm = angleToHhmmView(svgPointToAngleDeg(x, y), specRef.current);
      }

      // Absorbed slices' labels were hidden imperatively; the RESIZE_BOUNDARY
      // re-render drops the deleted ones but won't reset an inline `display` on a
      // survivor (e.g. a snap-back drag). Clear the hide before committing.
      if (svg) {
        hiddenLabelIdsRef.current.forEach((id) => {
          const el = svg.querySelector<SVGGraphicsElement>(`[data-label-id="${id}"]`);
          if (el) el.style.display = '';
        });
      }
      hiddenLabelIdsRef.current = new Set();

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

  // ── onSliceDoubleClick / onSliceSplit ─────────────────────────────────────

  // Pending single-click split, so a double-click can cancel it and edit instead.
  const splitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSliceDoubleClick = useCallback((sliceId: string) => {
    if (splitTimerRef.current) {
      clearTimeout(splitTimerRef.current);
      splitTimerRef.current = null;
    }
    optsRef.current.onRequestEdit(sliceId);
  }, []);

  const onSliceSplit = useCallback(
    (e: React.MouseEvent<SVGElement>) => {
      if (isDraggingRef.current) return;
      const svg = svgRef.current;
      if (!svg) return;
      const { clientX, clientY } = e;
      if (splitTimerRef.current) clearTimeout(splitTimerRef.current);
      // Wait out the double-click window: if a dblclick lands it edits and
      // cancels this; otherwise we split at the clicked time.
      splitTimerRef.current = setTimeout(() => {
        splitTimerRef.current = null;
        const { x, y } = clientToSvgPoint(svg, clientX, clientY);
        const hhmm = angleToHhmmView(svgPointToAngleDeg(x, y), specRef.current);
        // Empty the smaller half so the larger keeps the original name + colour.
        dispatch({ type: 'SPLIT', hhmm, newSlotSide: 'smaller' });
      }, 220);
    },
    [dispatch],
  );

  // ── onBackgroundClick ─────────────────────────────────────────────────────

  const onBackgroundClick = useCallback(
    (e: React.MouseEvent<SVGElement>) => {
      if (isDraggingRef.current) return;
      const svg = svgRef.current;
      if (!svg) return;
      const { x, y } = clientToSvgPoint(svg, e.clientX, e.clientY);
      const hhmm = angleToHhmmView(svgPointToAngleDeg(x, y), specRef.current);
      dispatch({ type: 'SPLIT', hhmm, newSlotSide: 'smaller' });
    },
    [dispatch],
  );

  return {
    liveDragGroupRef,
    svgRef,
    handlers: { onPointerDownHandle, onSliceDoubleClick, onBackgroundClick, onSliceSplit },
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
