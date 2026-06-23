import { useState } from 'react';
import { Plus, X, List } from 'lucide-react';
import { useMemos, MEMO_COLORS, type Memo } from '@/hooks/useMemos';
import { useTranslation } from '@/hooks/usePreferences';
import { MemoListDialog } from './MemoListDialog';

/** One editable memo card in the mobile grid. */
function MemoCard({
  memo,
  onChange,
  onArchive,
}: {
  memo: Memo;
  onChange: (patch: Partial<Memo>) => void;
  onArchive: () => void;
}) {
  return (
    <div
      className="relative flex flex-col rounded-lg p-2.5 shadow-sm"
      style={{ backgroundColor: memo.color }}
    >
      <button
        type="button"
        onClick={onArchive}
        aria-label="✕"
        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full transition-colors hover:bg-black/10"
      >
        <X className="h-3.5 w-3.5" style={{ color: '#1f2937' }} />
      </button>
      <textarea
        value={memo.text}
        onChange={(e) => onChange({ text: e.target.value })}
        rows={3}
        className="w-full resize-none bg-transparent pr-5 text-sm outline-none"
        style={{ color: '#1f2937', fontFamily: memo.fontFamily, textAlign: memo.align }}
      />
      <div className="mt-1.5 flex flex-wrap gap-1">
        {MEMO_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange({ color: c })}
            aria-label={c}
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: c, border: memo.color === c ? '2px solid #1f2937' : '1px solid rgba(0,0,0,0.2)' }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Mobile memos — a responsive grid of editable cards below the chart (replaces
 * the desktop floating post-it notes + FAB). Add / edit text / recolour /
 * archive inline; the full archive (restore + permanent delete) opens the same
 * MemoListDialog used on desktop.
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
            <MemoCard
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
