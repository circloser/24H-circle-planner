import { StickyNote, Eye, EyeOff } from 'lucide-react';
import { useMemos } from '@/hooks/useMemos';
import { useTranslation } from '@/hooks/usePreferences';
import { MemoNote } from './MemoNote';

/**
 * Renders every post-it memo (when visible) plus floating controls:
 *  - a show/hide toggle that hides the notes from view without deleting them,
 *  - an "add memo" button (only while visible).
 */
export function MemoLayer() {
  const { memos, visible, addMemo, toggleVisible } = useMemos();
  const { t } = useTranslation();

  const fabBase =
    'fixed right-5 z-20 grid place-items-center rounded-full shadow-lg transition-transform hover:scale-105';

  return (
    <>
      {visible && memos.map((m) => <MemoNote key={m.id} memo={m} />)}

      {/* Show/hide toggle — sits above the add button when visible, alone when hidden. */}
      <button
        type="button"
        onClick={toggleVisible}
        aria-label={visible ? t('memo.hide') : t('memo.show')}
        title={visible ? t('memo.hide') : t('memo.show')}
        className={`${fabBase} h-10 w-10 ${visible ? 'bottom-[76px]' : 'bottom-5'}`}
        style={{ backgroundColor: 'hsl(var(--surface))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}
      >
        {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>

      {visible && (
        <button
          type="button"
          onClick={addMemo}
          aria-label={t('memo.add')}
          title={t('memo.add')}
          className={`${fabBase} bottom-5 h-12 w-12`}
          style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
        >
          <StickyNote className="h-5 w-5" />
        </button>
      )}
    </>
  );
}
