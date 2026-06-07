import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { useStoreDispatch } from '@/hooks/useScheduleStore';
import { RING } from '@/lib/svg-geometry';

export interface HubTitleEditorProps {
  open: boolean;
  svgRef: React.RefObject<SVGSVGElement | null>;
  currentName: string;
  onClose: () => void;
}

/**
 * Inline editor for the center-hub schedule title. Opens when the hub is
 * clicked. Mirrors SliceEditor: portal, auto-focus, Enter=save, Esc=cancel,
 * click-outside=save.
 */
export function HubTitleEditor({ open, svgRef, currentName, onClose }: HubTitleEditorProps) {
  if (!open) return null;
  return (
    <HubTitleEditorInner
      key={currentName}
      svgRef={svgRef}
      currentName={currentName}
      onClose={onClose}
    />
  );
}

function HubTitleEditorInner({
  svgRef,
  currentName,
  onClose,
}: Omit<HubTitleEditorProps, 'open'>) {
  const dispatch = useStoreDispatch();
  const [name, setName] = useState(currentName);
  const [pos, setPos] = useState({ left: '50%', top: '50%' });
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Position over the SVG center (the hub).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const screenX = ctm.a * RING.cx + ctm.c * RING.cy + ctm.e;
    const screenY = ctm.b * RING.cx + ctm.d * RING.cy + ctm.f;
    setPos({ left: `${screenX}px`, top: `${screenY}px` });
  }, [svgRef]);

  // Auto-focus + select.
  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);
    return () => clearTimeout(t);
  }, []);

  const commit = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed !== '') {
      dispatch({ type: 'SET_SCHEDULE_NAME', name: trimmed });
    }
    onClose();
  }, [dispatch, name, onClose]);

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

  // Click outside → save (deferred attach so the opening click doesn't close it).
  useEffect(() => {
    let attached = false;
    function onDocPointerDown(e: PointerEvent) {
      const el = boxRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
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
  }, [commit]);

  return createPortal(
    <div
      ref={boxRef}
      role="dialog"
      aria-label="시간표 제목 편집"
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        width: 240,
      }}
      className="rounded-xl border bg-background shadow-2xl p-3 flex flex-col gap-1"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <label className="text-[11px] text-muted-foreground">시간표 제목</label>
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="예: 평일 루틴"
        className="h-8 text-sm"
      />
      <p className="text-[10px] text-muted-foreground">Enter 저장 · ESC 취소</p>
    </div>,
    document.body,
  );
}
