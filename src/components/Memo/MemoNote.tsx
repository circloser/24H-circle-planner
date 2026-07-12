import { type PointerEvent as ReactPointerEvent } from 'react';
import { X, GripHorizontal, AlignLeft, AlignCenter } from 'lucide-react';
import { useMemos, MEMO_COLORS, type Memo } from '@/hooks/useMemos';
import { FONT_FAMILIES, useTranslation } from '@/hooks/usePreferences';
import { anchoredStyle, dragFloor } from '@/components/ClockTools/clock-utils';

const SIZE = 200; // fixed (size not adjustable, by request)
const FOLD = 26; // folded-corner size (px)
const MAX_CHARS = 140; // keep the text within the note (no scrollbar)

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

/** Resolve a stored font value (which may be quote-stripped from older notes) to
 *  the canonical CSS family (with quotes for multi-word names like 'Noto Sans KR'). */
function resolveFontCss(stored: string): string {
  const norm = (s: string) => s.replace(/['"]/g, '').trim();
  const match = FONT_FAMILIES.find((f) => norm(f.css) === norm(stored));
  return match ? match.css : stored;
}

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

export function MemoNote({ memo }: { memo: Memo }) {
  const { updateMemo, archiveMemo } = useMemos();
  const { t } = useTranslation();
  const fontCss = resolveFontCss(memo.fontFamily);
  const align = memo.align === 'left' ? 'left' : 'center';

  // Drag the note from ANYWHERE on the paper (incl. the text) when it isn't being
  // edited. A press that doesn't move is treated as a click → focus the text to
  // edit; a press that moves → reposition. While the text IS focused (editing),
  // pointer-downs pass through so the caret/selection work normally.
  function onPaperPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const target = e.target as Element;
    if (target.closest('.memo-del')) return; // delete button handles itself
    const el = e.currentTarget;
    const textEl = el.querySelector('.memo-text') as HTMLElement | null;
    if (textEl && document.activeElement === textEl) return; // editing → don't hijack
    e.preventDefault(); // stop the paper/text from grabbing focus on a would-be drag
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = memo.x;
    const origY = memo.y;
    const { minX, minY } = dragFloor();
    let moved = false;
    // Window-level listeners (not pointer-capture): capture on the paper isn't
    // reliably delivered when the press starts over the contentEditable text.
    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
      moved = true;
      updateMemo(memo.id, {
        x: Math.max(minX, origX + (ev.clientX - startX)),
        y: Math.max(minY, origY + (ev.clientY - startY)),
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      // A tap/click that didn't move → enter edit mode.
      if (!moved && textEl) {
        textEl.focus();
        placeCaretAtEnd(textEl);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // Bottom-right corner is cut diagonally; the fold flap fills the cut.
  const cornerCut = `polygon(0 0, 100% 0, 100% calc(100% - ${FOLD}px), calc(100% - ${FOLD}px) 100%, 0 100%)`;
  const alignBtn = (a: 'left' | 'center', icon: React.ReactNode, label: string) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={align === a}
      onClick={() => updateMemo(memo.id, { align: a })}
      className="grid h-5 w-5 place-items-center rounded text-foreground"
      style={{
        backgroundColor: align === a ? 'hsl(var(--accent) / 0.2)' : 'transparent',
      }}
    >
      {icon}
    </button>
  );

  return (
    <div
      className="memo-note group"
      style={{ ...anchoredStyle(memo.x, memo.y), width: SIZE, height: SIZE, zIndex: 20 }}
    >
      {/* Hover toolbar — colour + alignment + font, above the note (not clipped). */}
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
        <div className="flex items-center gap-0.5">
          {alignBtn('left', <AlignLeft className="h-3.5 w-3.5" />, t('memo.alignLeft'))}
          {alignBtn('center', <AlignCenter className="h-3.5 w-3.5" />, t('memo.alignCenter'))}
        </div>
        <select
          value={fontCss}
          onChange={(e) => updateMemo(memo.id, { fontFamily: e.target.value })}
          className="h-6 rounded border border-black/15 bg-white/80 text-[11px] px-1 max-w-[88px]"
          aria-label={t('settings.fontFamily')}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.id} value={f.css}>
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
          fontFamily: `${fontCss}, system-ui, sans-serif`,
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

        {/* Editable text — font/alignment applied directly so the choice always sticks. */}
        <div
          className="memo-text"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label={t('memo.placeholder')}
          data-placeholder={t('memo.placeholder')}
          style={{
            fontFamily: `${fontCss}, system-ui, sans-serif`,
            textAlign: align,
            alignItems: align === 'left' ? 'flex-start' : 'center',
          }}
          ref={(el) => {
            if (el && document.activeElement !== el && el.innerText !== memo.text) {
              el.innerText = memo.text;
            }
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            let text = el.innerText;
            if (text.length > MAX_CHARS) {
              text = text.slice(0, MAX_CHARS);
              el.innerText = text;
              placeCaretAtEnd(el);
            }
            updateMemo(memo.id, { text });
          }}
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
