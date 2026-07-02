import { useState, useEffect } from 'react';
import './index.css';
import { Sparkles, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuid } from 'uuid';
import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/AppShell/AppHeader';
import { AppFooter } from '@/components/AppShell/AppFooter';
import { ResetDialog } from '@/components/AppShell/ResetDialog';
import { ShareImportDialog } from '@/components/AppShell/ShareImportDialog';
import { CircleTimeline } from '@/components/CircleTimeline/CircleTimeline';
import { ScheduleTable } from '@/components/ScheduleTable/ScheduleTable';
import { DeviceTransferDialog } from '@/components/DeviceTransferDialog/DeviceTransferDialog';
import { PresetGallery } from '@/components/PresetGallery/PresetGallery';
import { SliceEditor } from '@/components/SliceEditor/SliceEditor';
import { HubTitleEditor } from '@/components/HubTitleEditor/HubTitleEditor';
import { SlotSheet } from '@/components/SlotSheet/SlotSheet';
import { SaveAsDialog } from '@/components/SaveAsDialog/SaveAsDialog';
import { SavePresetDialog } from '@/components/SavePresetDialog/SavePresetDialog';
import { ExportDialog } from '@/components/ExportPanel/ExportDialog';
import { SettingsDialog, type SettingsSection } from '@/components/Settings/SettingsDialog';
import { MemoLayer } from '@/components/Memo/MemoLayer';
import { MobileMemoSection } from '@/components/Memo/MobileMemoSection';
import { ClockToolsLayer } from '@/components/ClockTools/ClockToolsLayer';
import { MobileClockSection } from '@/components/ClockTools/MobileClockSection';
import { TimeBlockDialog } from '@/components/TimeBlock/TimeBlockDialog';
import { RimMemoLayer } from '@/components/RimMemo/RimMemoLayer';
import { DayBar } from '@/components/Days/DayBar';
import { AddToHomeDialog, type BeforeInstallPromptEvent } from '@/components/AddToHomeDialog/AddToHomeDialog';
import { AboutDialog } from '@/components/About/AboutDialog';
import { requestPersistentStorage } from '@/lib/persistent-storage';
import { useTranslation, useChartView } from '@/hooks/usePreferences';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { useSliceInteraction } from '@/hooks/useSliceInteraction';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useShareActions } from '@/hooks/useShareActions';
import { WelcomeOverlay } from '@/components/Onboarding/WelcomeOverlay';
import { readSharedFromHash, clearShareHash } from '@/lib/share-link';
import { AnalyticsDialog } from '@/components/Analytics/AnalyticsDialog';
import { DiaryDialog } from '@/components/Diary/DiaryDialog';
import { DiaryNotePanel } from '@/components/Diary/DiaryNotePanel';
import { GoalsDialog } from '@/components/Goals/GoalsDialog';
import { GoalsWidget } from '@/components/Goals/GoalsWidget';
import { DiaryViewSync } from '@/components/DiaryViewSync';
import { RecordView } from '@/components/Record/RecordView';
import { PRESETS } from '@/data/presets';
import type { Slot } from '@/types/slot';
import type { Schedule } from '@/types/schedule';
import type { Preset } from '@/types/preset';

// First-visit onboarding flag. When absent, we show the one-time welcome overlay
// (the day-1 schedule is seeded with a demo example by useDays so the circle is
// never empty). Set once the welcome is dismissed.
const ONBOARDED_KEY = '24h-circle-planner.onboarded';

function isFirstVisit(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === null;
  } catch {
    return false;
  }
}

function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    // storage unavailable — the welcome may show again, which is harmless
  }
}

function App() {
  const present = useStoreSelector((s) => s.history.present);
  const locked = useStoreSelector((s) => s.locked);
  const diaryDate = useStoreSelector((s) => s.diaryDate);
  const dispatch = useStoreDispatch();

  const [presetOpen, setPresetOpen] = useState(false);
  // A schedule arriving via a share link (#p=…) → confirm before it replaces.
  const [shareImport, setShareImport] = useState<Schedule | null>(() => readSharedFromHash());
  // First visit → one-time welcome over the seeded demo (skipped when opening a link).
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(() => isFirstVisit() && shareImport === null);
  const dismissWelcome = () => {
    markOnboarded();
    setWelcomeOpen(false);
  };

  // Apply the chosen colour theme (if any) to a preset and load it, so content +
  // palette are chosen together in one undoable step. Shared by built-in presets
  // (looked up by name) and user presets (passed as objects).
  const loadPresetObject = (preset: Preset, themeColors: string[] | null, presetName: string) => {
    const themed = themeColors
      ? {
          ...preset,
          slices: preset.slices.map((s, i) => ({
            ...s,
            color: themeColors[i % themeColors.length],
          })),
        }
      : preset;
    dispatch({ type: 'LOAD_PRESET', preset: themed, presetName });
    setPresetOpen(false);
  };

  const handlePresetLoad = (name: string, themeColors: string[] | null) => {
    const preset = PRESETS.find((p) => p.name === name);
    if (preset) loadPresetObject(preset, themeColors, name);
    setPresetOpen(false);
  };

  const handleUserPresetLoad = (preset: Preset, themeColors: string[] | null) => {
    loadPresetObject(preset, themeColors, preset.name);
  };
  const [slotSheetOpen, setSlotSheetOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [homeOpen, setHomeOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [timeBlockOpen, setTimeBlockOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [editingSliceId, setEditingSliceId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
  const { t, lang } = useTranslation();
  // In plain edit mode (no diary loaded), an untitled schedule shows today's date
  // as its hub title — e.g. "7.2.(목)" / "Jul 2 (Thu)".
  const displayTitle = (() => {
    const nm = present.name?.trim() ?? '';
    if (diaryDate || (nm !== '' && nm !== '내 시간표' && nm !== '내 하루')) return present.name;
    const d = new Date();
    const dow = d.toLocaleDateString(lang, { weekday: 'short' });
    return lang === 'ko'
      ? `${d.getMonth() + 1}.${d.getDate()}.(${dow})`
      : `${d.toLocaleDateString(lang, { month: 'short', day: 'numeric' })} (${dow})`;
  })();
  const isMobile = useIsMobile();
  const chartView = useChartView();

  // One-time toast for the OAuth round-trip result: the Worker lands us back on
  // /?login=ok (or /?login_error=…). Show feedback, then strip the param so a
  // refresh doesn't repeat it. The session itself is read by useAuth on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('login') && !params.has('login_error')) return;
    if (params.get('login') === 'ok') toast.success(t('auth.welcome'));
    else toast.error(t('auth.loginFailed'));
    params.delete('login');
    params.delete('login_error');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Called when user confirms loading a slot from SlotSheet.
   * Deep-clones the schedule with fresh UUIDs (same pattern as LOAD_PRESET).
   */
  function handleSlotLoad(slot: Slot) {
    const clonedSchedule = {
      ...slot.schedule,
      id: uuid(),
      updatedAt: new Date().toISOString(),
      slices: slot.schedule.slices.map((s) => ({ ...s, id: uuid() })),
    };
    dispatch({ type: 'LOAD_SCHEDULE', schedule: clonedSchedule });
    toast.success(t('app.loaded', { name: slot.name }));
  }

  // Empty state: single unlabelled slice with no preset loaded
  const isEmptyState =
    present.slices.length === 1 &&
    present.slices[0].label === '' &&
    present.presetSource === null;

  // T4: interaction engine
  const { liveDragGroupRef, svgRef, handlers, isDragging } = useSliceInteraction({
    onRequestEdit: (id: string) => {
      if (locked) {
        toast(t('diary.locked'));
        return;
      }
      setEditingSliceId(id);
    },
  });

  // Suppress unused isDragging warning (useful for consumers/debug)
  void isDragging;

  // T4: keyboard shortcuts (undo/redo + drag-cancel)
  useKeyboardShortcuts({ liveDragGroupRef });

  // Share actions (PNG via native sheet / read-only /s#d= link incl. the note).
  const { shareImage, copyLink } = useShareActions(svgRef);

  // Ask the browser to keep our localStorage from being auto-evicted, so a
  // user's schedule/memos/backups survive storage-pressure cleanups. Best-effort.
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  // A shared schedule was parsed from the URL fragment on init — strip the
  // fragment so a reload doesn't re-prompt; the confirm dialog handles loading.
  useEffect(() => {
    if (shareImport) clearShareHash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capture the browser's install prompt (Chrome/Edge/Android) so the "add to
  // home screen" dialog can offer a one-tap install. Clear it once installed.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        onOpenAbout={() => setAboutOpen(true)}
        onOpenSlots={() => setSlotSheetOpen(true)}
        onOpenSaveAs={() => setSaveAsOpen(true)}
        onOpenSavePreset={() => setSavePresetOpen(true)}
        onOpenDiary={() => setDiaryOpen(true)}
        onOpenAnalytics={() => setAnalyticsOpen(true)}
        onOpenGoals={() => setGoalsOpen(true)}
        onOpenPresets={() => setPresetOpen(true)}
        onOpenSettings={setSettingsSection}
        onOpenExport={() => setExportOpen(true)}
        onShareImage={shareImage}
        onCopyLink={copyLink}
        onOpenHome={() => setHomeOpen(true)}
        onOpenTransfer={() => setTransferOpen(true)}
        onOpenReset={() => setResetOpen(true)}
      />

      <main
        className={
          isMobile
            ? 'flex-1 container mx-auto flex flex-col items-center gap-6 px-3 pb-12 pt-3'
            : 'flex-1 container mx-auto py-8 flex items-center justify-center px-4'
        }
      >
        {/* Multi-day switcher — pinned at the top in-flow on mobile, floating on desktop. */}
        {chartView !== 'record' && <DayBar />}
        <div className="flex w-full flex-col items-center gap-4">
        {chartView === 'record' ? (
          <RecordView />
        ) : chartView === 'table' ? (
          <ScheduleTable
            locked={locked}
            onEditLabel={(id) => { if (locked) { toast(t('diary.locked')); } else { setEditingSliceId(id); } }}
            onAddRow={() => (locked ? toast(t('diary.locked')) : setTimeBlockOpen(true))}
          />
        ) : (
        <div
          className={
            isMobile
              ? 'relative w-full max-w-[560px] aspect-square'
              : 'relative max-w-[720px] w-full mx-auto aspect-square'
          }
        >
          <CircleTimeline
            slices={present.slices}
            mode="interactive"
            interactionMode="interactive"
            dragGroupRef={liveDragGroupRef}
            svgRef={svgRef}
            onPointerDownHandle={handlers.onPointerDownHandle}
            onSliceDoubleClick={handlers.onSliceDoubleClick}
            onBackgroundClick={handlers.onBackgroundClick}
            onSliceSplit={locked ? undefined : handlers.onSliceSplit}
            showEmptyHint={false}
            selectedSliceId={editingSliceId}
            title={displayTitle}
            onHubClick={() => {
              if (locked) {
                toast(t('diary.locked'));
                return;
              }
              setEditingTitle(true);
            }}
            mobileNoChartDrag={isMobile || locked}
            // Viewing a loaded diary = a past saved day → hide the live now-line
            // (and world-clock lines); "current time" is meaningless there.
            hideLiveMarkers={!!diaryDate}
          />
          {/* Rim annotation memos (hover near the edge → leader line + note). */}
          <RimMemoLayer />

          {/* Empty-state hero — a value-prop CTA when the circle is empty
              (e.g. after a reset). Sits in the lower band, clear of the hub. */}
          {isEmptyState && !welcomeOpen && (
            <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-[14%]">
              <div
                className="pointer-events-auto flex flex-col items-center gap-2 rounded-xl px-4 py-3 text-center shadow-lg"
                style={{ backgroundColor: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))' }}
              >
                <p className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
                  {t('empty.heroTitle')}
                </p>
                <Button
                  onClick={() => setPresetOpen(true)}
                  className="gap-1.5"
                  style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                >
                  <Sparkles className="h-4 w-4" />
                  {t('empty.heroCta')}
                </Button>
              </div>
            </div>
          )}
        </div>
        )}
          {/* Day's free-form note, shown directly under the timetable. */}
          {chartView !== 'record' && <DiaryNotePanel />}
        </div>

        {/* Mobile: stacked sections below the chart. Editing stays enabled (touch
            + long-press); only the desktop floating overlays are replaced. */}
        {isMobile && chartView !== 'record' && (
          <>
            <div className="-mt-2 flex flex-col items-center gap-1.5">
              <Button
                onClick={() => (locked ? toast(t('diary.locked')) : setTimeBlockOpen(true))}
                className="gap-1.5"
                style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
              >
                <Plus className="h-4 w-4" />
                {t('block.add')}
              </Button>
              <p className="text-center text-xs" style={{ color: 'hsl(var(--text-muted) / 0.85)' }}>
                {t('mobile.editHint')}
              </p>
            </div>
            <MobileMemoSection />
            <MobileClockSection />
          </>
        )}
      </main>

      <AppFooter />

      <PresetGallery
        open={presetOpen}
        onOpenChange={setPresetOpen}
        onConfirm={handlePresetLoad}
        onLoadUserPreset={handleUserPresetLoad}
      />

      {/* T7: Slot sheet */}
      <SlotSheet
        open={slotSheetOpen}
        onOpenChange={setSlotSheetOpen}
        onLoad={handleSlotLoad}
      />

      {/* T7: Save as dialog */}
      <SaveAsDialog
        open={saveAsOpen}
        onOpenChange={setSaveAsOpen}
        currentSchedule={present}
        onSaved={() => setSaveAsOpen(false)}
      />

      {/* Save current schedule as a reusable preset */}
      <SavePresetDialog
        open={savePresetOpen}
        onOpenChange={setSavePresetOpen}
        currentSchedule={present}
      />

      {/* Full reset — wipes all app data, then reloads to a fresh state. */}
      <ResetDialog open={resetOpen} onOpenChange={setResetOpen} />

      {/* T5: Slice editor portal */}
      <SliceEditor
        sliceId={editingSliceId}
        svgRef={svgRef}
        onClose={() => setEditingSliceId(null)}
      />

      {/* T17: Hub title editor portal */}
      <HubTitleEditor
        open={editingTitle}
        svgRef={svgRef}
        currentName={displayTitle}
        onClose={() => setEditingTitle(false)}
      />

      {/* T19: Settings dialog */}
      <SettingsDialog section={settingsSection} onClose={() => setSettingsSection(null)} />

      {/* T9: Export dialog */}
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        svgRef={svgRef}
        scheduleName={present.name}
        schedule={present}
        onImport={(s: Schedule) => dispatch({ type: 'LOAD_SCHEDULE', schedule: s })}
      />

      {/* Add-to-home-screen helper (install prompt + instructions) */}
      <AddToHomeDialog
        open={homeOpen}
        onOpenChange={setHomeOpen}
        installPrompt={installPrompt}
        onConsumePrompt={() => setInstallPrompt(null)}
      />

      {/* No-backend device transfer: QR of the current timetable (#p=…). */}
      <DeviceTransferDialog open={transferOpen} onOpenChange={setTransferOpen} />

      {/* About / manual + Circloser brand (opened from the title) */}
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />

      {/* Mobile: add a time block by typing start/end (instead of finger-dragging). */}
      <TimeBlockDialog open={timeBlockOpen} onOpenChange={setTimeBlockOpen} />

      {/* Time analysis — categorised daily-average split + per-day trend. */}
      <AnalyticsDialog open={analyticsOpen} onOpenChange={setAnalyticsOpen} />

      {/* Diary — month calendar of saved days, each shown as a mini timetable. */}
      <DiaryDialog open={diaryOpen} onOpenChange={setDiaryOpen} />

      {/* Time-accumulation goals (운동/공부 등) with progress bars. */}
      <GoalsDialog open={goalsOpen} onOpenChange={setGoalsOpen} />

      {/* One-time first-visit welcome over the seeded demo schedule. */}
      <WelcomeOverlay
        open={welcomeOpen}
        onOpenChange={(o) => { if (!o) dismissWelcome(); }}
        onPickPreset={() => setPresetOpen(true)}
        isMobile={isMobile}
      />

      {/* Incoming share link (#p=…) → confirm before replacing the schedule. */}
      <ShareImportDialog
        schedule={shareImport}
        onClose={() => setShareImport(null)}
        onImport={(s) => dispatch({ type: 'LOAD_SCHEDULE', schedule: s })}
      />

      {/* Desktop only: floating post-it memos (bottom-right) + clock tools
          (bottom-left). On mobile these move into the stacked sections under the
          chart (MobileMemoSection / MobileClockSection inside <main>). */}
      <DiaryViewSync />
      {!isMobile && <MemoLayer />}
      {!isMobile && <GoalsWidget />}
      {!isMobile && <ClockToolsLayer />}
    </div>
  );
}

export default App;
