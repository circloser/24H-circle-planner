import { StickyNote } from 'lucide-react';
import { useMemos } from '@/hooks/useMemos';
import { useTranslation } from '@/hooks/usePreferences';
import { MemoNote } from './MemoNote';

/**
 * Renders every post-it memo (fixed-positioned over the app) plus a floating
 * "add memo" button. Memos live in the whitespace around the timetable and can
 * be dragged anywhere.
 */
export function MemoLayer() {
  const { memos, addMemo } = useMemos();
  const { t } = useTranslation();

  return (
    <>
      {memos.map((m) => (
        <MemoNote key={m.id} memo={m} />
      ))}

      <button
        type="button"
        onClick={addMemo}
        aria-label={t('memo.add')}
        title={t('memo.add')}
        className="fixed bottom-5 right-5 z-20 h-12 w-12 grid place-items-center rounded-full shadow-lg transition-transform hover:scale-105"
        style={{
          backgroundColor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
        }}
      >
        <StickyNote className="h-5 w-5" />
      </button>
    </>
  );
}
