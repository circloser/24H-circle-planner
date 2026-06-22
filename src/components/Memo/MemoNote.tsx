import { type PointerEvent as ReactPointerEvent } from 'react';
import { X, GripHorizontal } from 'lucide-react';
import { useMemos, MEMO_COLORS, type Memo } from '@/hooks/useMemos';
import { FONT_FAMILIES, useTranslation } from '@/hooks/usePreferences';

const SIZE = 200; // fixed (size not adjustable, by request)
const FOLD = 26; // folded-corner size (px)

/** Shift a hex colour toward white (amt > 0) or black (amt < 0), amt in 0..1. */
function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const target = amt >= 0 ? 255 : 0;
  const k = Math.abs(amt);
  const ch = (v: number) => Math.round(v + (target - v) * k);
  const h = (v: number) => ch(v).toString(16).padStart(2, '0');
  return `#${h((n >> 16) & 255)}${h((n >> 8) & 255)}${h(n & 255)}`;
}

export function MemoNote({ memo }: { memo: Memo }) {
  const { updateMemo, archiveMemo } = useMemos();
  const { t } = useTranslation();

  // Drag the note from anywhere on the paper EXCEPT the editable text / delete
  // button (so editing and deleting still work). Pointer capture tracks reliably.
  function onPaperPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const target = e.target as Element;
    if (target.closest('.memo-text') || target.closest('.memo-del')) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = memo.x;
    const origY = memo.y;
    const onMove = (ev: PointerEvent) => {
      updateMemo(memo.id, {
        x: Math.max(0, origX + (ev.clientX - startX)),
        y: Math.max(0, origY + (ev.clientY - startY)),
      });
    };
    const onUp = () => {
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  }

  // Bottom-right corner is cut diagonally; the fold flap fills the cut.
  const cornerCut = `polygon(0 0, 100% 0, 100% calc(100% - ${FOLD}px), calc(100% - ${FOLD}px) 100%, 0 100%)`;

  return (
    <div
      className="memo-note group"
      style={{ position: 'fixed', left: memo.x, top: memo.y, width: SIZE, height: SIZE, zIndex: 20 }}
    >
      {/* Hover toolbar — colour + font, above the note (not clipped). */}
      <div className="memo-toolbar">
        <div className="flex items-center gap-1">
          {MEMO_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => updateMemo(memo.id, { color: c })}
              className="h-4 w-4 rounded-full border border-black/20"
              style={{
                backgroundColor: c,
                outline: memo.color === c ? '2px solid rgba(0,0,0,0.45)' : 'none',
                outlineOffset: '1px',
              }}
            />
          ))}
        </div>
        <select
          value={memo.fontFamily}
          onChange={(e) => updateMemo(memo.id, { fontFamily: e.target.value })}
          className="h-6 rounded border border-black/15 bg-white/80 text-[11px] px-1 max-w-[96px]"
          aria-label={t('settings.fontFamily')}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.id} value={f.css.replace(/'/g, '')}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* The paper — clipped corner + soft shadow (filter keeps the cut shape). */}
      <div
        className="memo-paper"
        onPointerDown={onPaperPointerDown}
        style={{
          backgroundColor: memo.color,
          fontFamily: `${memo.fontFamily}, system-ui, sans-serif`,
          clipPath: cornerCut,
        }}
      >
        {/* Hover grip — top centre; shows the note is draggable (the paper-level
            handler does the actual dragging). */}
        <div className="memo-grip" aria-hidden="true">
          <GripHorizontal className="h-3.5 w-3.5 text-black/40" />
        </div>

        {/* Hover delete — top-right corner. */}
        <button
          type="button"
          className="memo-del"
          aria-label={t('memo.delete')}
          onClick={() => archiveMemo(memo.id)}
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Centered, editable text. */}
        <div
          className="memo-text"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label={t('memo.placeholder')}
          data-placeholder={t('memo.placeholder')}
          ref={(el) => {
            if (el && document.activeElement !== el && el.innerText !== memo.text) {
              el.innerText = memo.text;
            }
          }}
          onInput={(e) => updateMemo(memo.id, { text: e.currentTarget.innerText })}
        />
      </div>

      {/* Folded corner (page curl): light lifted edge → shadowed crease. */}
      <div
        className="memo-fold"
        style={{
          width: FOLD,
          height: FOLD,
          backgroundImage: `linear-gradient(135deg, ${shade(memo.color, 0.12)} 0%, ${shade(memo.color, -0.2)} 40%, ${shade(memo.color, -0.04)} 100%)`,
        }}
      />
    </div>
  );
}
