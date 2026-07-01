import { useState } from 'react';
import { Plus, X, Copy, FileText, LayoutGrid, Lock, Unlock, CalendarDays, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { v4 as uuid } from 'uuid';
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
import { PresetGallery } from '@/components/PresetGallery/PresetGallery';
import { slicePath } from '@/lib/svg-geometry';
import { useDays, MAX_DAYS } from '@/hooks/useDays';
import { useDiary } from '@/hooks/useDiary';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { useTranslation } from '@/hooks/usePreferences';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';
import { useIsMobile } from '@/hooks/useIsMobile';
import { PRESETS } from '@/data/presets';
import type { Schedule } from '@/types/schedule';
import type { Preset } from '@/types/preset';
import type { TimeSlice } from '@/types/time-slice';

const THUMB = 46;

/** "2026-06-21" → a locale-friendly date for the loaded-diary indicator. */
function formatDiaryDate(key: string, lang: string): string {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' });
}

/** A tiny donut thumbnail of a day's schedule — wedges only, no labels/ticks. */
function DayThumb({ schedule, size }: { schedule: Schedule; size: number }) {
  return (
    <svg viewBox="0 0 1000 1000" width={size} height={size} style={{ display: 'block' }} aria-hidden="true">
      {schedule.slices.map((s) => (
        <path key={s.id} d={slicePath(s)} fill={s.color} />
      ))}
      {/* Hub fill so the centre reads as a clean disc, matching the main chart. */}
      <circle cx={500} cy={500} r={100} fill="hsl(var(--surface))" />
      <circle cx={500} cy={500} r={460} fill="none" stroke="hsl(var(--border) / 0.6)" strokeWidth={6} />
    </svg>
  );
}

/**
 * Multi-day switcher.
 *  - One day: a single, semi-transparent + at top-centre (no thumbnail / no
 *    indicator — "Day 1 of 1" is noise).
 *  - Two+ days: a thumbnail per day (click to switch, × to delete) plus the +,
 *    and a "Day M of N" indicator at bottom-centre.
 * The + asks whether to duplicate the current schedule or start empty.
 */
export function DayBar() {
  const { days, activeId, activeIndex, switchTo, addDay, addDayFromSlices, deleteDay } = useDays();
  const { t, lang } = useTranslation();
  const coarse = useCoarsePointer();
  const isMobile = useIsMobile();
  const diaryDate = useStoreSelector((s) => s.diaryDate);
  const locked = useStoreSelector((s) => s.locked);
  const dispatch = useStoreDispatch();
  const { entries: diaryEntries } = useDiary();

  // Saved diary dates in chronological order (YYYY-MM-DD sorts lexicographically),
  // for prev/next navigation while a diary is loaded.
  const diaryDates = Object.keys(diaryEntries).sort();
  const curDiaryIdx = diaryDate ? diaryDates.indexOf(diaryDate) : -1;
  const prevDiaryDate = curDiaryIdx > 0 ? diaryDates[curDiaryIdx - 1] : null;
  const nextDiaryDate = curDiaryIdx >= 0 && curDiaryIdx < diaryDates.length - 1 ? diaryDates[curDiaryIdx + 1] : null;

  function loadDiaryByDate(dKey: string | null) {
    if (!dKey) return;
    const e = diaryEntries[dKey];
    if (!e) return;
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
  }

  // Leave diary-view mode: restore the working day's timetable (LOAD_SCHEDULE
  // also clears diaryDate + locked) so editing resumes where it left off.
  function exitDiaryMode() {
    const active = activeId ? days.find((d) => d.id === activeId) : null;
    if (!active) return;
    dispatch({ type: 'LOAD_SCHEDULE', schedule: active.schedule });
    toast(t('diary.exited'));
  }

  const [addOpen, setAddOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const recolor = (slices: TimeSlice[], themeColors: string[] | null): TimeSlice[] =>
    themeColors ? slices.map((s, i) => ({ ...s, color: themeColors[i % themeColors.length] })) : slices;

  // Add a NEW day from a built-in preset (looked up by name).
  function addDayFromPreset(presetName: string, themeColors: string[] | null) {
    const preset = PRESETS.find((p) => p.name === presetName);
    if (preset) addDayFromSlices(recolor(preset.slices, themeColors), presetName);
  }
  // Add a NEW day from a user-saved preset (carries its own slices).
  function addDayFromUserPreset(preset: Preset, themeColors: string[] | null) {
    addDayFromSlices(recolor(preset.slices, themeColors), preset.name);
  }

  const multi = days.length >= 2;
  const atMax = days.length >= MAX_DAYS;

  function openAdd() {
    if (atMax) {
      toast(t('day.max'));
      return;
    }
    setAddOpen(true);
  }

  function confirmDelete() {
    if (pendingDelete) deleteDay(pendingDelete);
    setPendingDelete(null);
  }

  const pillStyle = {
    backgroundColor: 'hsl(var(--surface) / 0.92)',
    border: '1px solid hsl(var(--border))',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  } as React.CSSProperties;

  function choose(mode: 'empty' | 'duplicate') {
    addDay(mode);
    setAddOpen(false);
  }

  return (
    <>
      {/* Day strip — pinned in-flow at the top on mobile; floating top-centre on desktop. */}
      <div className={isMobile ? 'z-20 mb-1 flex w-full justify-center' : 'fixed left-1/2 top-16 z-20 -translate-x-1/2'}>
        <div
          className="flex items-center gap-2 overflow-x-auto rounded-full px-2 py-1.5 shadow-md max-w-[88vw]"
          style={multi ? pillStyle : { background: 'transparent', border: 'none', boxShadow: 'none' }}
        >
          {/* Thumbnails only when there are 2+ days. */}
          {multi &&
            days.map((d, i) => {
              const isActive = d.id === activeId;
              return (
                <div key={d.id} className="group relative shrink-0">
                  <button
                    type="button"
                    onClick={() => switchTo(d.id)}
                    aria-label={t('day.thumb', { m: String(i + 1) })}
                    aria-pressed={isActive}
                    className="block overflow-hidden rounded-full"
                    style={{
                      boxShadow: isActive ? '0 0 0 2px hsl(var(--primary))' : '0 0 0 1px hsl(var(--border))',
                    }}
                  >
                    <DayThumb schedule={d.schedule} size={THUMB} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDelete(d.id);
                    }}
                    aria-label={t('day.delete')}
                    title={t('day.delete')}
                    className={`absolute -right-1 -top-1 z-10 grid h-[18px] w-[18px] place-items-center rounded-full transition-opacity ${
                      coarse ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                    }`}
                    style={{
                      backgroundColor: 'hsl(var(--surface))',
                      color: 'hsl(var(--foreground))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

          {/* Add button — always present; faded when it's the lone control. */}
          <button
            type="button"
            onClick={openAdd}
            disabled={atMax}
            aria-label={t('day.add')}
            title={atMax ? t('day.max') : t('day.add')}
            className="grid place-items-center rounded-full shrink-0 transition-transform hover:scale-105 disabled:cursor-not-allowed"
            style={{
              width: THUMB,
              height: THUMB,
              backgroundColor: 'hsl(var(--muted) / 0.6)',
              color: 'hsl(var(--foreground))',
              border: '1px dashed hsl(var(--border))',
              opacity: atMax ? 0.3 : multi ? 1 : 0.5,
            }}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Bottom-centre indicator: a loaded diary's date + lock toggle takes
          priority; otherwise the "Day M of N" counter (2+ days only). */}
      {diaryDate ? (
        <div
          className="fixed bottom-20 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5 text-xs font-medium shadow"
          style={{
            backgroundColor: 'hsl(var(--surface) / 0.94)',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => loadDiaryByDate(prevDiaryDate)}
              disabled={!prevDiaryDate}
              aria-label={t('diary.prevDay')}
              title={t('diary.prevDay')}
              className="grid h-5 w-5 place-items-center rounded-full transition-colors hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="flex items-center gap-1 px-0.5">
              <CalendarDays className="h-3.5 w-3.5" style={{ color: 'hsl(var(--text-muted))' }} />
              {formatDiaryDate(diaryDate, lang)}
            </span>
            <button
              type="button"
              onClick={() => loadDiaryByDate(nextDiaryDate)}
              disabled={!nextDiaryDate}
              aria-label={t('diary.nextDay')}
              title={t('diary.nextDay')}
              className="grid h-5 w-5 place-items-center rounded-full transition-colors hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <span className="h-3.5 w-px" style={{ backgroundColor: 'hsl(var(--border))' }} />
          <button
            type="button"
            onClick={() => {
              const next = !locked;
              dispatch({ type: 'SET_LOCKED', value: next });
              toast(next ? t('diary.relocked') : t('diary.unlockedToast'));
            }}
            aria-pressed={locked}
            title={locked ? t('diary.unlock') : t('diary.lock')}
            className="flex items-center gap-1 rounded-full px-2 py-1 font-semibold transition-colors"
            style={
              locked
                ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }
                : { backgroundColor: 'hsl(var(--muted) / 0.6)', color: 'hsl(var(--foreground))' }
            }
          >
            {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            {locked ? t('diary.unlock') : t('diary.lock')}
          </button>
          <button
            type="button"
            onClick={exitDiaryMode}
            title={t('diary.exit')}
            className="flex items-center gap-1 rounded-full px-2 py-1 font-semibold transition-colors hover:bg-black/10"
            style={{ border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
          >
            <LogOut className="h-3 w-3" />
            {t('diary.exit')}
          </button>
        </div>
      ) : multi && activeIndex >= 0 ? (
        <div
          className="fixed bottom-20 left-1/2 z-20 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium shadow"
          style={{
            backgroundColor: 'hsl(var(--surface) / 0.92)',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {t('day.indicator', { m: String(activeIndex + 1), n: String(days.length) })}
        </div>
      ) : null}

      {/* Add-day choice: duplicate current schedule or start empty. */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('day.addTitle')}</DialogTitle>
            <DialogDescription>{t('day.addBody')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-1">
            <Button
              variant="default"
              className="w-full justify-start gap-2"
              style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
              onClick={() => choose('duplicate')}
            >
              <Copy className="h-4 w-4" />
              {t('day.addDuplicate')}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              style={{ backgroundColor: 'hsl(var(--surface))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}
              onClick={() => choose('empty')}
            >
              <FileText className="h-4 w-4" />
              {t('day.addEmpty')}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              style={{ backgroundColor: 'hsl(var(--surface))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}
              onClick={() => { setAddOpen(false); setPresetOpen(true); }}
            >
              <LayoutGrid className="h-4 w-4" />
              {t('day.addPreset')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add a new day from a preset (append mode — no overwrite confirm). */}
      <PresetGallery
        open={presetOpen}
        onOpenChange={setPresetOpen}
        mode="append"
        onConfirm={addDayFromPreset}
        onLoadUserPreset={addDayFromUserPreset}
      />

      {/* Delete-day confirmation */}
      <Dialog open={pendingDelete !== null} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('day.deleteTitle')}</DialogTitle>
            <DialogDescription>{t('day.deleteBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={confirmDelete}
              style={{ backgroundColor: 'hsl(var(--destructive))', color: 'hsl(var(--destructive-foreground))' }}
            >
              {t('day.deleteConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
