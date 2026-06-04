import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import type { DragRef } from '@/types/drag';

export interface UseKeyboardShortcutsOpts {
  liveDragGroupRef: React.RefObject<SVGGElement | null>;
}

/**
 * Attaches a keydown listener to window.
 *
 * Priority order (C10 contract):
 * 1. isDraggingBoundary + Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y / Escape → drag-cancel
 * 2. Ctrl+Z → UNDO. Ctrl+Shift+Z / Ctrl+Y → REDO.
 * 3. Delete on focused [data-slice-id] → no-op placeholder (delete-slice not in MVP).
 * 4. Tab / Enter → no-op stubs (T5).
 */
export function useKeyboardShortcuts(opts: UseKeyboardShortcutsOpts): void {
  const { liveDragGroupRef } = opts;
  const dispatch = useStoreDispatch();

  const isDraggingBoundary = useStoreSelector((s) => s.isDraggingBoundary);
  const dragRefFromStore = useStoreSelector((s) => s.dragRef);
  const pastLength = useStoreSelector((s) => s.history.past.length);
  const futureLength = useStoreSelector((s) => s.history.future.length);

  // Mutable refs updated via useEffect so event handler always sees fresh values
  const isDraggingRef = useRef(false);
  const dragRefRef = useRef<DragRef | null>(null);
  const pastLengthRef = useRef(0);
  const futureLengthRef = useRef(0);

  useEffect(() => {
    isDraggingRef.current = isDraggingBoundary;
  });
  useEffect(() => {
    dragRefRef.current = dragRefFromStore;
  });
  useEffect(() => {
    pastLengthRef.current = pastLength;
  });
  useEffect(() => {
    futureLengthRef.current = futureLength;
  });

  useEffect(() => {
    function cancelDrag() {
      const g = liveDragGroupRef.current;
      const dragRef = dragRefRef.current;
      if (g && dragRef) {
        g.querySelectorAll<SVGPathElement>('[data-slice-id]').forEach((child) => {
          const id = child.getAttribute('data-slice-id');
          if (id && dragRef.originalSlicePaths[id] !== undefined) {
            child.setAttribute('d', dragRef.originalSlicePaths[id]);
          }
        });
      }
      dispatch({ type: 'SET_DRAG_REF', value: null });
      dispatch({ type: 'SET_IS_DRAGGING_BOUNDARY', value: false });
    }

    function handleKeyDown(e: KeyboardEvent) {
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      // ── Branch 1: drag-cancel shortcuts ──────────────────────────────────
      if (isDraggingRef.current) {
        const isCancelKey =
          (isCtrl && !isShift && e.key === 'z') ||
          (isCtrl && isShift && e.key === 'z') ||
          (isCtrl && (e.key === 'y' || e.key === 'Y')) ||
          e.key === 'Escape';

        if (isCancelKey) {
          e.preventDefault();
          cancelDrag();
          return;
        }

        // Block all other undo/redo during drag
        if (isCtrl && (e.key === 'z' || e.key === 'y' || e.key === 'Y')) {
          e.preventDefault();
          return;
        }

        return; // ignore other keys during drag
      }

      // ── Branch 2: UNDO / REDO ─────────────────────────────────────────────
      if (isCtrl && !isShift && e.key === 'z') {
        e.preventDefault();
        if (pastLengthRef.current > 0) {
          dispatch({ type: 'UNDO' });
          toast.info('실행 취소했습니다');
        }
        return;
      }

      if (isCtrl && isShift && e.key === 'z') {
        e.preventDefault();
        if (futureLengthRef.current > 0) {
          dispatch({ type: 'REDO' });
          toast.info('다시 실행했습니다');
        }
        return;
      }

      if (isCtrl && !isShift && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        if (futureLengthRef.current > 0) {
          dispatch({ type: 'REDO' });
          toast.info('다시 실행했습니다');
        }
        return;
      }

      // ── Branch 3: Delete focused slice ────────────────────────────────────
      // Delete-key merge is not in MVP scope; the slice editor (double-click) is
      // the primary editing path. This branch is a no-op placeholder.
      if (e.key === 'Delete') {
        const active = document.activeElement;
        if (active) {
          const sliceId = active.getAttribute('data-slice-id');
          void sliceId; // reserved for future delete-slice UX
        }
        return;
      }

      // ── Branch 4: Tab / Enter stubs ───────────────────────────────────────
      // No-op (T5 wires editor)
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dispatch, liveDragGroupRef]);
}
