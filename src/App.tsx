import { useState, useEffect } from 'react';
import './index.css';
import { Sparkles, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuid } from 'uuid';
import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/AppShell/AppHeader';
import { EnablePushBanner } from '@/components/EnablePushBanner/EnablePushBanner';
import { AppFooter } from '@/components/AppShell/AppFooter';
import { ResetDialog } from '@/components/AppShell/ResetDialog';
import { ShareImportDialog } from '@/components/AppShell/ShareImportDialog';
import { TimePaletteDialog } from '@/components/TimePalette/TimePaletteDialog';
import { useSliceAlarms } from '@/hooks/useSliceAlarms';
import { usePushAlarms } from '@/hooks/usePushAlarms';
import { track } from '@/lib/track';
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
import { SliceAlarmPopup } from '@/components/SliceAlarmPopup/SliceAlarmPopup';
import { DayBar } from '@/components/Days/DayBar';
import { AddToHomeDialog, type BeforeInstallPromptEvent } from '@/components/AddToHomeDialog/AddToHomeDialog';
import { AboutDialog } from '@/components/About/AboutDialog';
import { requestPersistentStorage } from '@/lib/persistent-storage';
import { useTranslation, useChartView } from '@/hooks/usePreferences';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useDayChange } from '@/hooks/useDayChange';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { useSliceInteraction } from '@/hooks/useSliceInteraction';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useShareActions } from '@/hooks/useShareActions';
import { useSyncStatus } from '@/hooks/useSync';
import { useAuth } from '@/hooks/useAuth';
import { E2eeDialog } from '@/components/Sync/E2eeDialog';
import { UpgradeDialog } from '@/components/Billing/UpgradeDialog';
import { StatsDialog } from '@/components/Admin/StatsDialog';
import { OPEN_UPGRADE_EVENT } from '@/lib/pro';
import { WelcomeOverlay } from '@/components/Onboarding/WelcomeOverlay';
import { readSharedFromHash, clearShareHash } from '@/lib/share-link';
import { AnalyticsDialog } from '@/components/Analytics/AnalyticsDialog';
import { DiaryDialog } from '@/components/Diary/DiaryDialog';
import { DiaryNotePanel } from '@/components/Diary/DiaryNotePanel';
import { GoalsDialog } from '@/components/Goals/GoalsDialog';
import { GoalsWidget } from '@/components/Goals/GoalsWidget';
import { DiaryViewSync } from '@/components/DiaryViewSync';
import { RecordView } from '@/components/Record/RecordView';
import { WeekdayScheduleDialog } from '@/components/Weekday/WeekdayScheduleDialog';
import { WeekdayPromptDialog } from '@/components/Weekday/WeekdayPromptDialog';
import { loadWeekdayMap, weekdayName, STORAGE_KEY_WEEKDAY_PROMPTED } from '@/lib/weekday-schedules';
import { loadSlots } from '@/lib/slots';
import { dateKey } from '@/hooks/useDiary';
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
  const [paletteOpen, setPaletteOpen] = useState(false);
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
  const [statsOpen, setStatsOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [timeBlockOpen, setTimeBlockOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [e2eeOpen, setE2eeOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [weekdayOpen, setWeekdayOpen] = useState(false);
  // On opening the app on a weekday that has an assigned default schedule, ask
  // once (per local day) whether to load it. Skipped when arriving via a share
  // link. Reads the slot up front so the prompt has its name.
  const [weekdaySlot, setWeekdaySlot] = useState<Slot | null>(() => {
    try {
      if (readSharedFromHash()) return null;
      if (localStorage.getItem(STORAGE_KEY_WEEKDAY_PROMPTED) === dateKey()) return null;
      const slotId = loadWeekdayMap()[new Date().getDay()];
      return slotId ? (loadSlots()[slotId] ?? null) : null;
    } catch {
      return null;
    }
  });
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [editingSliceId, setEditingSliceId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
  const { t, lang } = useTranslation();
  // Ticks over at local midnight so an untitled hub date rolls to the new day
  // while the app is left open (no reload needed); drives displayTitle below.
  const todayKey = useDayChange();
  // In plain edit mode (no diary loaded), an untitled schedule shows today's date
  // as its hub title, formatted by each country's own convention — Intl decides
  // the field order + separators (ko "8월 4일 (화)", en "Tue, Aug 4",
  // en-GB "Tue, 4 Aug", de "Di., 4. Aug.", ja "8月4日(火)"). Prefer the browser's
  // full regional locale when it shares the chosen UI language's base, else fall
  // back to the UI language so the date never clashes with the surrounding UI.
  // The real, editable schedule name — empty when the schedule is "untitled"
  // (blank or a default placeholder). The hub title editor opens with THIS, so an
  // untitled schedule shows an empty box (not the date) and saving the date as a
  // frozen name can't happen.
  const editableTitle = (() => {
    const nm = present.name?.trim() ?? '';
    return nm === '내 시간표' || nm === '내 하루' ? '' : nm;
  })();
  const displayTitle = (() => {
    const nm = present.name?.trim() ?? '';
    if (diaryDate || (nm !== '' && nm !== '내 시간표' && nm !== '내 하루')) return present.name;
    const nav = typeof navigator !== 'undefined' ? navigator.language : '';
    const dateLocale = nav && nav.split('-')[0] === lang ? nav : lang;
    // Build from todayKey (local YYYY-MM-DD) so the value is reactive to the
    // midnight tick — parsed with an explicit time so it's local, not UTC.
    return new Date(`${todayKey}T00:00:00`).toLocaleDateString(dateLocale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  })();
  const isMobile = useIsMobile();
  const chartView = useChartView();
  const { refresh: refreshAuth } = useAuth();

  // One-time toast for OAuth (/?login=ok|…) and Polar checkout (/?checkout=success)
  // round-trips. Show feedback, re-read the session (entitlement may have just
  // changed), then strip the param so a refresh doesn't repeat it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasLogin = params.has('login') || params.has('login_error');
    const hasCheckout = params.has('checkout');
    if (!hasLogin && !hasCheckout) return;
    if (hasLogin) {
      if (params.get('login') === 'ok') toast.success(t('auth.welcome'));
      else toast.error(t('auth.loginFailed'));
    }
    if (hasCheckout) {
      if (params.get('checkout') === 'success') {
        toast.success(t('billing.checkoutSuccess'));
        void refreshAuth(); // webhook may have already flipped us to Pro
      }
    }
    params.delete('login');
    params.delete('login_error');
    params.delete('checkout');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any gated surface can request the paywall via requestUpgrade() (a window event).
  // `#coupons` also opens it — the entry point for admins (who are auto-Pro and
  // never hit a gate) to reach the coupon-issuing panel, and for anyone with a code.
  useEffect(() => {
    const onUpgrade = () => setUpgradeOpen(true);
    const onHash = () => {
      if (window.location.hash === '#coupons') setUpgradeOpen(true);
      if (window.location.hash === '#stats') setStatsOpen(true); // admin-only (endpoint 403s others)
    };
    onHash();
    window.addEventListener(OPEN_UPGRADE_EVENT, onUpgrade);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener(OPEN_UPGRADE_EVENT, onUpgrade);
      window.removeEventListener('hashchange', onHash);
    };
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

  // "시간표가 곧 알람": crossing into the next slice fires a browser notification
  // (opt-in via 설정 → 타임라인; needs this device's Notification permission).
  useSliceAlarms();
  // Pro tier of the same feature: server-sent Web Push, arrives tab-closed.
  usePushAlarms();

  // Share actions (PNG via native sheet / read-only /s#d= link incl. the note).
  const { shareImage, copyLink } = useShareActions(svgRef);

  // E2EE: when the cloud copy is ciphertext this device can't read, sync reports
  // 'locked' — surface the unlock dialog automatically so the user isn't stuck.
  const syncStatus = useSyncStatus().status;
  useEffect(() => {
    if (syncStatus !== 'locked') return;
    // Defer to the next frame: opening a Radix modal synchronously from the same
    // commit as the status change can be dismissed by its focus scope. The user
    // can always open it from Settings → 종단간 암호화 too.
    const id = requestAnimationFrame(() => setE2eeOpen(true));
    return () => cancelAnimationFrame(id);
  }, [syncStatus]);

  // Ask the browser to keep our localStorage from being auto-evicted, so a
  // user's schedule/memos/backups survive storage-pressure cleanups. Best-effort.
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  // Mark today as prompted the moment a weekday prompt is shown, so a reload
  // before the user answers doesn't ask again this day.
  useEffect(() => {
    if (weekdaySlot) {
      try { localStorage.setItem(STORAGE_KEY_WEEKDAY_PROMPTED, dateKey()); } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div data-app-root className="min-h-screen flex flex-col overflow-x-clip">
      <AppHeader
        onOpenAbout={() => setAboutOpen(true)}
        onOpenSlots={() => setSlotSheetOpen(true)}
        onOpenSaveAs={() => setSaveAsOpen(true)}
        onOpenSavePreset={() => setSavePresetOpen(true)}
        onOpenDiary={() => setDiaryOpen(true)}
        onOpenAnalytics={() => setAnalyticsOpen(true)}
        onOpenGoals={() => setGoalsOpen(true)}
        onOpenWeekday={() => setWeekdayOpen(true)}
        onOpenPresets={() => setPresetOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenSettings={setSettingsSection}
        onOpenExport={() => setExportOpen(true)}
        onShareImage={shareImage}
        onCopyLink={copyLink}
        onOpenHome={() => setHomeOpen(true)}
        onOpenTransfer={() => setTransferOpen(true)}
        onOpenReset={() => setResetOpen(true)}
        onOpenE2ee={() => setE2eeOpen(true)}
        onOpenUpgrade={() => setUpgradeOpen(true)}
      />

      <EnablePushBanner />

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
            // …and mark 00:00 with a dashed seam so it reads as a closed snapshot.
            diaryLoaded={!!diaryDate}
          />
          {/* Rim annotation memos (hover near the edge → leader line + note). */}
          <RimMemoLayer />

          {/* Empty-state hero — a value-prop CTA when the circle is empty
              (e.g. after a reset). Sits in the lower band, clear of the hub. */}
          {isEmptyState && !welcomeOpen && (
            <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-[14%]">
              <div
                className="pointer-events-auto flex flex-col items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-center shadow-lg"
              >
                <p className="text-sm font-semibold text-foreground">
                  {t('empty.heroTitle')}
                </p>
                <Button
                  onClick={() => setPresetOpen(true)}
                  className="gap-1.5 bg-primary text-primary-foreground"
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
              <div className="flex items-center justify-center gap-2">
                <Button
                  onClick={() => (locked ? toast(t('diary.locked')) : setTimeBlockOpen(true))}
                  className="gap-1.5 bg-primary text-primary-foreground"
                >
                  <Plus className="h-4 w-4" />
                  {t('block.add')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    locked
                      ? toast(t('diary.locked'))
                      : window.dispatchEvent(new Event('rimmemo:add'))
                  }
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  {t('rim.add')}
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground/85">
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
        currentName={editableTitle}
        onClose={() => setEditingTitle(false)}
      />

      {/* T19: Settings dialog */}
      <SettingsDialog section={settingsSection} onClose={() => setSettingsSection(null)} />

      {/* T9: Export dialog */}
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        svgRef={svgRef}
        scheduleName={present.name || t('shareview.untitled')}
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

      {/* End-to-end encryption for cloud sync (enable / unlock / manage). */}
      <E2eeDialog open={e2eeOpen} onOpenChange={setE2eeOpen} />
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      <StatsDialog open={statsOpen} onOpenChange={setStatsOpen} />
      <TimePaletteDialog open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Assign a saved schedule to each weekday. */}
      <WeekdayScheduleDialog open={weekdayOpen} onOpenChange={setWeekdayOpen} />

      {/* On opening the app on a weekday with an assigned default → confirm load. */}
      <WeekdayPromptDialog
        slot={weekdaySlot}
        dayName={weekdayName(new Date().getDay(), lang)}
        onKeep={() => setWeekdaySlot(null)}
        onLoad={(slot) => { handleSlotLoad(slot); setWeekdaySlot(null); }}
      />

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
        onImport={(s) => {
          track('schedule_import', { name: s.name ?? '' });
          dispatch({ type: 'LOAD_SCHEDULE', schedule: s });
        }}
      />

      {/* Desktop only: floating post-it memos (bottom-right) + clock tools
          (bottom-left). On mobile these move into the stacked sections under the
          chart (MobileMemoSection / MobileClockSection inside <main>). */}
      <DiaryViewSync />
      {!isMobile && <MemoLayer />}
      {!isMobile && <GoalsWidget />}
      {!isMobile && <ClockToolsLayer />}

      {/* In-app slice-start popup (bottom-right / bottom, 5s, above everything).
          Fires from useSliceAlarms on a block boundary — shows even without OS
          notification permission. */}
      <SliceAlarmPopup />
    </div>
  );
}

export default App;
