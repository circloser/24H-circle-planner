import { type PointerEvent as ReactPointerEvent } from 'react';
import { GripHorizontal, X } from 'lucide-react';
import { useMemos, MEMO_COLORS, type Memo } from '@/hooks/useMemos';
import { FONT_FAMILIES, useTranslation } from '@/hooks/usePreferences';

const SIZE = 200; // fixed (size not adjustable, by request)
const FOLD = 24; // folded-corner size (px)

/** Darken a hex colour by `amt` (0..1) for the folded-corner shading. */
function darken(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const c = (v: number) => Math.max(0, Math.round(v * (1 - amt)));
  const h = (v: number) => c(v).toString(16).padStart(2, '0');
  return `#${h((n >> 16) & 255)}${h((n >> 8) & 255)}${h(n & 255)}`;
}

export function MemoNote({ memo }: { memo: Memo }) {
  const { updateMemo, removeMemo } = useMemos();
  const { t } = useTranslation();

  // Drag the note by its grip bar (pointer capture so it tracks reliably).
  function onGripPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
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

  // The paper's bottom-right corner is cut diagonally; the fold flap fills that
  // cut (a darker→lighter gradient = the curled-up corner).
  const cornerCut = `polygon(0 0, 100% 0, 100% calc(100% - ${FOLD}px), calc(100% - ${FOLD}px) 100%, 0 100%)`;

  return (
    <div
      className="memo-note group"
      style={{ position: 'fixed', left: memo.x, top: memo.y, width: SIZE, height: SIZE, zIndex: 20 }}
    >
      {/* Hover toolbar — colours + font + delete, above the note (not clipped). */}
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
          className="h-6 rounded border border-black/15 bg-white/80 text-[11px] px-1 max-w-[88px]"
          aria-label={t('settings.fontFamily')}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.id} value={f.css.replace(/'/g, '')}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={t('memo.delete')}
          onClick={() => removeMemo(memo.id)}
          className="h-6 w-6 grid place-items-center rounded hover:bg-black/10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* The paper itself — clipped corner + shadow (filter, so the cut is kept). */}
      <div
        className="memo-paper"
        style={{
          backgroundColor: memo.color,
          fontFamily: `${memo.fontFamily}, system-ui, sans-serif`,
          clipPath: cornerCut,
        }}
      >
        <div className="memo-grip" onPointerDown={onGripPointerDown} style={{ touchAction: 'none' }}>
          <GripHorizontal className="h-3.5 w-3.5 text-black/35" />
        </div>

        {/* Centered, editable text (contentEditable so it can centre vertically). */}
        <div
          className="memo-text"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label={t('memo.placeholder')}
          data-placeholder={t('memo.placeholder')}
          ref={(el) => {
            // Sync from store only when not actively editing, to avoid caret jumps.
            if (el && document.activeElement !== el && el.innerText !== memo.text) {
              el.innerText = memo.text;
            }
          }}
          onInput={(e) => updateMemo(memo.id, { text: e.currentTarget.innerText })}
        />
      </div>

      {/* Folded corner (page curl) filling the cut. */}
      <div
        className="memo-fold"
        style={{
          width: FOLD,
          height: FOLD,
          backgroundImage: `linear-gradient(135deg, ${darken(memo.color, 0.22)} 0%, ${darken(memo.color, 0.05)} 100%)`,
        }}
      />
    </div>
  );
}
