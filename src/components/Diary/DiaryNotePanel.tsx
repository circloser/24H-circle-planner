import { useState } from 'react';
import { BookOpen, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { useDiary } from '@/hooks/useDiary';
import { useTranslation } from '@/hooks/usePreferences';

const NOTE_MAX = 20000; // ~A4 2 pages

/** Inline note editor. Keyed by date so it remounts (resetting the draft) when a
 *  different diary is loaded. Saves on blur. */
function NoteEditor({ initial, onSave }: { initial: string; onSave: (value: string) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initial);

  const commit = () => {
    if (draft !== initial) {
      onSave(draft);
      toast.success(t('diary.noteSaved'));
    }
  };

  return (
    <textarea
      value={draft}
      maxLength={NOTE_MAX}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      placeholder={t('diary.notePlaceholder')}
      className="min-h-[30vh] w-full resize-y rounded-md border border-border bg-background p-3 text-sm leading-relaxed text-foreground outline-none"
    />
  );
}

/**
 * The free-form note for the day, shown under the chart. Displays the loaded
 * diary date's note (when a past record is open) or today's saved note while
 * editing today.
 *
 * Read-only by default; when a past diary is loaded AND unlocked (via the date
 * pill's lock toggle), the note becomes inline-editable and saves on blur.
 */
export function DiaryNotePanel() {
  const diaryDate = useStoreSelector((s) => s.diaryDate);
  const locked = useStoreSelector((s) => s.locked);
  const { entries, setEntryNote } = useDiary();
  const { t } = useTranslation();

  // Notes belong to a LOADED diary only. In normal timetable editing (no diary
  // loaded, incl. after "일기 나가기") nothing shows — even if today's saved
  // entry has a note.
  if (!diaryDate) return null;

  const note = entries[diaryDate]?.note ?? '';
  const editable = !locked;

  // Locked diary with no note → nothing to show.
  if (!editable && !note.trim()) return null;

  return (
    <div
      className="w-full max-w-[720px] rounded-xl border border-border bg-surface px-4 py-3"
    >
      <div
        className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground"
      >
        <BookOpen className="h-4 w-4 shrink-0" />
        {t('diary.note')}
        {editable && (
          <span
            className="ml-1 flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary"
          >
            <Pencil className="h-2.5 w-2.5" />
            {t('diary.noteEditable')}
          </span>
        )}
      </div>

      {editable ? (
        <NoteEditor key={diaryDate} initial={note} onSave={(value) => setEntryNote(diaryDate, value)} />
      ) : (
        <div
          className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground"
        >
          {note}
        </div>
      )}
    </div>
  );
}
