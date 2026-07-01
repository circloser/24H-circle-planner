import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AdSlot } from '@/components/Ads/AdSlot';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { useDiary, dateKey, type DiaryEntry } from '@/hooks/useDiary';
import { useTranslation } from '@/hooks/usePreferences';
import { MiniChart } from './MiniChart';

interface DiaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Timetable diary — a month calendar where each saved day shows a mini-chart of
 * that day's timetable (saved vs unsaved days are visually distinct). "Save today"
 * (or tapping any date) snapshots the current schedule under that date; tapping a
 * saved day loads it back into the editor.
 */
export function DiaryDialog({ open, onOpenChange }: DiaryDialogProps) {
  const present = useStoreSelector((s) => s.history.present);
  const dispatch = useStoreDispatch();
  const { entries, saveEntry, setEntryNote, removeEntry } = useDiary();
  const { t, lang } = useTranslation();

  const today = new Date();
  const todayKey = dateKey(today);
  const [view, setView] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }));

  const first = new Date(view.y, view.m, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const monthLabel = first.toLocaleDateString(lang, { year: 'numeric', month: 'long' });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 7 + i).toLocaleDateString(lang, { weekday: 'narrow' }),
  );
  const keyOf = (day: number) => `${view.y}-${pad2(view.m + 1)}-${pad2(day)}`;
  const shift = (d: number) =>
    setView(({ y, m }) => {
      const nm = m + d;
      return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });

  function saveToDate(key: string) {
    if (key > todayKey) { toast(t('diary.noFuture')); return; } // future dates aren't loggable
    saveEntry(present, key);
    toast.success(t('diary.saved'));
  }
  function loadEntry(e: DiaryEntry) {
    // Load as a protected, locked diary view (carries the record's date so the
    // day bar can show it and gate edits). Editing requires explicit unlock.
    dispatch({
      type: 'LOAD_DIARY',
      date: e.date,
      schedule: {
        id: uuid(),
        version: 1,
        name: e.name || '내 시간표',
        presetSource: null,
        updatedAt: new Date().toISOString(),
        slices: e.slices.map((s) => ({ ...s, id: uuid() })),
      },
    });
    toast.success(t('diary.loaded'));
    onOpenChange(false);
  }

  // A confirmation step gates both saving and loading (loading replaces the
  // current timetable; saving can overwrite an existing entry).
  type Pending = { kind: 'save'; key: string } | { kind: 'load'; entry: DiaryEntry };
  const [pending, setPending] = useState<Pending | null>(null);
  // After a timetable is saved we offer a free-form note step for that date.
  const [noteStep, setNoteStep] = useState<{ key: string; draft: string } | null>(null);
  const NOTE_MAX = 20000; // ~A4 2 pages

  const fmtDate = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    if (!y || !m || !d) return key;
    return new Date(y, m - 1, d).toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  function confirmPending() {
    if (!pending) return;
    if (pending.kind === 'save') {
      const key = pending.key;
      saveToDate(key);
      setPending(null);
      // Save the timetable first, then offer to add a note for that date.
      setNoteStep({ key, draft: entries[key]?.note ?? '' });
      return;
    }
    loadEntry(pending.entry);
    setPending(null);
  }

  function saveNote() {
    if (!noteStep) return;
    setEntryNote(noteStep.key, noteStep.draft);
    setNoteStep(null);
    toast.success(t('diary.noteSaved'));
  }

  const cells: Array<number | null> = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('diary.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <button type="button" aria-label="prev" onClick={() => shift(-1)} className="grid h-7 w-7 place-items-center rounded transition-colors hover:bg-black/10">
              <ChevronLeft className="h-4 w-4" style={{ color: 'hsl(var(--foreground))' }} />
            </button>
            <button type="button" aria-label="next" onClick={() => shift(1)} className="grid h-7 w-7 place-items-center rounded transition-colors hover:bg-black/10">
              <ChevronRight className="h-4 w-4" style={{ color: 'hsl(var(--foreground))' }} />
            </button>
            <span className="ml-1 text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{monthLabel}</span>
          </div>
          <Button
            size="sm"
            onClick={() => setPending({ kind: 'save', key: todayKey })}
            style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            {t('diary.saveToday')}
          </Button>
        </div>

        <p className="text-xs" style={{ color: 'hsl(var(--text-muted) / 0.85)' }}>{t('diary.empty')}</p>

        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdays.map((w, i) => (
            <div key={`wd-${i}`} className="pb-0.5 text-[11px] font-semibold" style={{ color: i === 0 ? '#EF4444' : 'hsl(var(--text-muted))' }}>
              {w}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={`b-${i}`} />;
            const key = keyOf(day);
            const entry = entries[key];
            const isToday = key === todayKey;
            const isFuture = key > todayKey; // YYYY-MM-DD compares chronologically
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (entry) { setPending({ kind: 'load', entry }); return; }
                  if (isFuture) { toast(t('diary.noFuture')); return; } // can't log a day that hasn't happened
                  setPending({ kind: 'save', key });
                }}
                className={`group relative grid aspect-square place-items-center rounded-md p-0.5 transition-colors ${isFuture && !entry ? 'cursor-not-allowed opacity-35' : 'hover:bg-black/5'}`}
                style={isToday ? { outline: '2px solid hsl(var(--primary))', outlineOffset: '-2px' } : undefined}
                title={key}
              >
                {entry ? (
                  <>
                    <MiniChart slices={entry.slices} />
                    <span className="absolute left-0.5 top-0 text-[10px] font-bold" style={{ color: 'hsl(var(--foreground))' }}>{day}</span>
                    <span
                      role="button"
                      aria-label={t('diary.delete')}
                      onClick={(e) => { e.stopPropagation(); removeEntry(key); toast(t('diary.deleted')); }}
                      className="absolute right-0 top-0 hidden h-4 w-4 place-items-center rounded-full group-hover:grid"
                      style={{ backgroundColor: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))' }}
                    >
                      <X className="h-2.5 w-2.5" style={{ color: 'hsl(var(--text-muted))' }} />
                    </span>
                    {entry.note?.trim() && (
                      <span
                        className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full"
                        style={{ backgroundColor: 'hsl(var(--primary))', border: '1px solid hsl(var(--surface))' }}
                        title={t('diary.hasNote')}
                        aria-label={t('diary.hasNote')}
                      />
                    )}
                  </>
                ) : (
                  <span className="text-xs" style={{ color: 'hsl(var(--text-muted) / 0.85)' }}>{day}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Reserved ad space (consistent with the other dialogs). */}
        <AdSlot slot="diary" className="mt-3" />
      </DialogContent>
    </Dialog>

    {/* Save / load confirmation step. */}
    <Dialog open={pending !== null} onOpenChange={(o) => { if (!o) setPending(null); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{pending?.kind === 'load' ? t('diary.confirmLoadTitle') : t('diary.confirmSaveTitle')}</DialogTitle>
          <DialogDescription>
            {pending?.kind === 'load' ? t('diary.confirmLoad') : t('diary.confirmSave')}
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs" style={{ color: 'hsl(var(--text-muted))' }}>
          {pending?.kind === 'load'
            ? t('diary.confirmLoadBody', { date: fmtDate(pending.entry.date) })
            : pending
              ? t(entries[pending.key] ? 'diary.confirmOverwriteBody' : 'diary.confirmSaveBody', { date: fmtDate(pending.key) })
              : ''}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPending(null)}>{t('common.cancel')}</Button>
          <Button
            onClick={confirmPending}
            style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            {pending?.kind === 'load' ? t('diary.confirmLoadCta') : t('diary.confirmSaveCta')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Note step — offered right after the timetable is saved (A4 ~2 pages). */}
    <Dialog open={noteStep !== null} onOpenChange={(o) => { if (!o) setNoteStep(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('diary.addNoteTitle')}</DialogTitle>
          <DialogDescription>
            {noteStep ? t('diary.addNotePrompt', { date: fmtDate(noteStep.key) }) : ''}
          </DialogDescription>
        </DialogHeader>
        <textarea
          autoFocus
          value={noteStep?.draft ?? ''}
          maxLength={NOTE_MAX}
          onChange={(e) => setNoteStep((s) => (s ? { ...s, draft: e.target.value } : s))}
          placeholder={t('diary.notePlaceholder')}
          className="min-h-[40vh] w-full resize-y rounded-md p-3 text-sm leading-relaxed outline-none"
          style={{ backgroundColor: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
        />
        <div className="text-right text-[11px]" style={{ color: 'hsl(var(--text-muted))' }}>
          {t('diary.noteChars', { n: String(noteStep?.draft.length ?? 0) })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setNoteStep(null)}>{t('diary.noteSkip')}</Button>
          <Button onClick={saveNote} style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
            {t('diary.noteSave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
