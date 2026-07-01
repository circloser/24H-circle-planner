import { useRef, useCallback, useEffect } from 'react';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { sliceWidthMinutes, snapMinutes, minutesToHhmm, hhmmToMinutes } from '@/lib/time-utils';
import { slicePath, RING, polarToCartesian, labelAnchorInside } from '@/lib/svg-geometry';
import { useChartView } from '@/hooks/usePreferences';
import { viewSpec, minForAngle, angleForMin, visibleSegments, FULL_SPEC, type ViewSpec } from '@/lib/chart-view';
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

/**
 * Live preview for a 12h-view boundary drag: redraw the two adjacent slices'
 * clipped areas and re-anchor their labels so the division, areas, and names all
 * track the cursor — matching the full-view behaviour. Fully recomputable from
 * the snapshot, so the cancel path reuses it with the original boundary time.
 */
function update12hClippedPreview(
  svg: SVGSVGElement,
  snapshotSlices: TimeSlice[],
  boundaryIndex: number,
  hhmm: string,
  spec: ViewSpec,
): void {
  const len = snapshotSlices.length;
  const ccwSlice = snapshotSlices[boundaryIndex];
  const cwIdx = (boundaryIndex + 1) % len;
  const cwSlice = snapshotSlices[cwIdx];
  const ccwMod: TimeSlice = { ...ccwSlice, endTime: hhmm };
  const cwMod: TimeSlice = { ...cwSlice, startTime: hhmm };
  if (sliceWidthMinutes(ccwMod) <= 0 || sliceWidthMinutes(cwMod) <= 0) return;

  updateClippedSlicePaths(svg, ccwMod, spec);
  updateClippedSlicePaths(svg, cwMod, spec);

  const ccwLabel = largestVisibleSegment(ccwMod, spec);
  const cwLabel = largestVisibleSegment(cwMod, spec);
  // radialOffset 0 → labels stay on the single clean ring (no staggering), matching the render.
  if (ccwLabel) {
    moveSliceLabelImperative(svg, ccwLabel, 0, spec);
  }
  if (cwLabel) {
    moveSliceLabelImperative(svg, cwLabel, 0, spec);
  }
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
        const len = dragRef.snapshot.slices.length;
        const ccwSlice = dragRef.snapshot.slices[dragRef.boundaryIndex];
        const cwSlice = dragRef.snapshot.slices[(dragRef.boundaryIndex + 1) % len];
        // Original endTime of the CCW slice defines the original boundary angle.
        const originalHhmm = ccwSlice.endTime === '24:00' ? '00:00' : ccwSlice.endTime;
        moveBoundaryHandleImperative(svgEl, dragRef.boundaryIndex, originalHhmm, sp);

        if (sp.view !== 'full') {
          // 12h: redraw the clipped areas + labels at the original boundary.
          update12hClippedPreview(svgEl, dragRef.snapshot.slices, dragRef.boundaryIndex, originalHhmm, sp);
        } else {
          // 24h: restore the dragged paths in the live drag group, then the labels.
          const g = liveDragGroupRef.current;
          if (g) {
            g.querySelectorAll<SVGPathElement>('[data-slice-id]').forEach((child) => {
              const id = child.getAttribute('data-slice-id');
              if (id && dragRef.originalSlicePaths[id] !== undefined) {
                child.setAttribute('d', dragRef.originalSlicePaths[id]);
              }
            });
          }
          moveSliceLabelImperative(svgEl, ccwSlice, 0);
          moveSliceLabelImperative(svgEl, cwSlice, 0);
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

      // The boundary handle (dot) + time pill follow the cursor in EVERY view
      // (view-aware angle), so the division reads correctly while dragging in 12h.
      if (svgEl) moveBoundaryHandleImperative(svgEl, dragRef.boundaryIndex, hhmm, sp);

      // 12h views: the slices are rendered window-clipped, so the live preview is
      // redrawn imperatively here (areas + division + labels), matching the full
      // view. The final resize still commits on release.
      if (sp.view !== 'full') {
        if (svgEl) update12hClippedPreview(svgEl, dragRef.snapshot.slices, dragRef.boundaryIndex, hhmm, sp);
        return;
      }

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

      // Re-anchor the two adjacent slice labels so they track their wedge centroid
      // live, mirroring the path update above (full view only).
      if (svgEl) {
        const ccwModified: TimeSlice = { ...ccwSlice, endTime: hhmm };
        const cwModified: TimeSlice = { ...cwSlice, startTime: hhmm };
        if (sliceWidthMinutes(ccwModified) > 0 && sliceWidthMinutes(cwModified) > 0) {
          moveSliceLabelImperative(svgEl, ccwModified, 0);
          moveSliceLabelImperative(svgEl, cwModified, 0);
        }
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
