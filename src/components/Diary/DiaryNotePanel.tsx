import { BookOpen } from 'lucide-react';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { useDiary, dateKey } from '@/hooks/useDiary';
import { useTranslation } from '@/hooks/usePreferences';

/**
 * The free-form note for the day, shown under the chart. Displays the loaded
 * diary date's note (when a past record is open) or today's saved note while
 * editing today. Read-only here — notes are written via the diary save flow.
 */
export function DiaryNotePanel() {
  const diaryDate = useStoreSelector((s) => s.diaryDate);
  const { entries } = useDiary();
  const { t } = useTranslation();

  const target = diaryDate ?? dateKey();
  const note = entries[target]?.note;
  if (!note || !note.trim()) return null;

  return (
    <div
      className="w-full max-w-[720px] rounded-xl px-4 py-3"
      style={{ backgroundColor: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))' }}
    >
      <div
        className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold"
        style={{ color: 'hsl(var(--foreground))' }}
      >
        <BookOpen className="h-4 w-4 shrink-0" />
        {t('diary.note')}
      </div>
      <div
        className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed"
        style={{ color: 'hsl(var(--foreground))' }}
      >
        {note}
      </div>
    </div>
  );
}
