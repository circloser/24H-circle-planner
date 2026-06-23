import { useLayoutEffect, useRef, useState } from 'react';
import { Plus, X, List } from 'lucide-react';
import { useMemos, type Memo } from '@/hooks/useMemos';
import { useTranslation } from '@/hooks/usePreferences';
import { MemoListDialog } from './MemoListDialog';

// Mobile memos are uniformly yellow (no per-note colour picker, by request).
const MEMO_YELLOW = '#fef08a';
const MEMO_TEXT = '#1f2937';

/** One editable memo card — a tall yellow rectangle whose textarea auto-grows so
 *  it never shows a scrollbar; text matches the desktop note size (14px). */
function MobileMemoCard({
  memo,
  onChange,
  onArchive,
}: {
  memo: Memo;
  onChange: (patch: Partial<Memo>) => void;
  onArchive: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Grow the textarea to fit its content → no inner scrollbar.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [memo.text]);

  return (
    <div
      className="relative flex flex-col rounded-lg p-3 shadow-sm"
      style={{ backgroundColor: MEMO_YELLOW, minHeight: 200 }}
    >
      <button
        type="button"
        onClick={onArchive}
        aria-label="✕"
        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full transition-colors hover:bg-black/10"
      >
        <X className="h-3.5 w-3.5" style={{ color: MEMO_TEXT }} />
      </button>
      <textarea
        ref={ref}
        value={memo.text}
        onChange={(e) => onChange({ text: e.target.value })}
        rows={1}
        className="w-full resize-none overflow-hidden bg-transparent pr-4 outline-none"
        style={{ color: MEMO_TEXT, fontSize: 14, lineHeight: 1.4, textAlign: 'center' }}
      />
    </div>
  );
}

/**
 * Mobile memos — a responsive grid of editable yellow note cards below the chart
 * (replaces the desktop floating post-its + FAB). Add / edit text / archive; the
 * full archive (restore + permanent delete) opens the shared MemoListDialog.
 */
export function MobileMemoSection() {
  const { memos, addMemo, updateMemo, archiveMemo } = useMemos();
  const { t } = useTranslation();
  const [listOpen, setListOpen] = useState(false);
  const cards = memos.filter((m) => m.onScreen);

  const btn =
    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-transform active:scale-95';
  const btnStyle = {
    backgroundColor: 'hsl(var(--surface))',
    color: 'hsl(var(--foreground))',
    border: '1px solid hsl(var(--border))',
  } as React.CSSProperties;

  return (
    <section className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--text-muted))' }}>
          {t('memo.title')}
        </h2>
        <div className="flex items-center gap-2">
          <button type="button" className={btn} style={btnStyle} onClick={() => setListOpen(true)}>
            <List className="h-4 w-4" />
            {t('memo.list')}
          </button>
          <button type="button" className={btn} style={btnStyle} onClick={addMemo}>
            <Plus className="h-4 w-4" />
            {t('memo.add')}
          </button>
        </div>
      </div>

      {cards.length === 0 ? (
        <p className="rounded-lg py-6 text-center text-sm" style={{ color: 'hsl(var(--text-muted) / 0.8)', border: '1px dashed hsl(var(--border))' }}>
          {t('memo.add')}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {cards.map((m) => (
            <MobileMemoCard
              key={m.id}
              memo={m}
              onChange={(patch) => updateMemo(m.id, patch)}
              onArchive={() => archiveMemo(m.id)}
            />
          ))}
        </div>
      )}

      <MemoListDialog open={listOpen} onOpenChange={setListOpen} />
    </section>
  );
}
