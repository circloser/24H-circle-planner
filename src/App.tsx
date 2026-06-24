import { useState, useEffect } from 'react';
import './index.css';
import { ChevronDown, Settings as SettingsIcon, FolderOpen, Sparkles, Download, Share2, Smartphone, Languages, Type, Smile, Ruler, Image as ImageIcon, Palette, RotateCcw, Plus, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuid } from 'uuid';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { resetAllData } from '@/lib/backup';
import { CircleTimeline } from '@/components/CircleTimeline/CircleTimeline';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
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
import { SaveIndicator } from '@/components/SaveIndicator/SaveIndicator';
import { ChartViewToggle } from '@/components/ChartViewToggle/ChartViewToggle';
import { AddToHomeDialog, type BeforeInstallPromptEvent } from '@/components/AddToHomeDialog/AddToHomeDialog';
import { AboutDialog } from '@/components/About/AboutDialog';
import { shareChartImage } from '@/lib/share';
import { requestPersistentStorage } from '@/lib/persistent-storage';
import { useTranslation } from '@/hooks/usePreferences';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { useSliceInteraction } from '@/hooks/useSliceInteraction';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { WelcomeOverlay } from '@/components/Onboarding/WelcomeOverlay';
import { buildShareUrl, readSharedFromHash, clearShareHash, copyToClipboard } from '@/lib/share-link';
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
  const [timeBlockOpen, setTimeBlockOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [editingSliceId, setEditingSliceId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
  const { t } = useTranslation();
  const isMobile = useIsMobile();

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
      setEditingSliceId(id);
    },
  });

  // Suppress unused isDragging warning (useful for consumers/debug)
  void isDragging;

  // T4: keyboard shortcuts (undo/redo + drag-cancel)
  useKeyboardShortcuts({ liveDragGroupRef });

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

  // Copy a shareable link encoding the current schedule (the "today's routine" link).
  async function handleCopyLink() {
    const ok = await copyToClipboard(buildShareUrl(present));
    if (ok) toast.success(t('sharelink.copied'));
    else toast.error(t('sharelink.copyFail'));
  }

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

  // Share the current timetable as an image (native share sheet on mobile →
  // Instagram etc.; image download as the desktop fallback).
  async function handleShare() {
    if (!svgRef.current) {
      toast.error(t('share.noChart'));
      return;
    }
    try {
      const outcome = await shareChartImage(svgRef.current, present.name, t('share.text'));
      if (outcome === 'downloaded') toast.success(t('share.saved'));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // user cancelled
      toast.error(`${t('share.fail')}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          backgroundColor: 'hsl(var(--surface) / 0.85)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderColor: 'hsl(var(--border) / 0.7)',
          boxShadow: '0 1px 3px hsl(220 30% 15% / 0.08), 0 1px 2px hsl(220 30% 15% / 0.04)',
        }}
      >
        <div className="container mx-auto grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-3 sm:gap-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="min-w-0 shrink truncate font-semibold text-sm sm:text-base">
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                title={t('about.open')}
                aria-label={t('about.open')}
                className="rounded transition-opacity hover:opacity-70"
              >
                24Houring
              </button>
            </h1>
            <SaveIndicator />
          </div>
          {/* Centred view toggle — independent, page-centred between the side groups */}
          <div className="flex items-center justify-center">
            <ChartViewToggle />
          </div>
          <div className="flex min-w-0 shrink items-center justify-end gap-1 sm:gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="px-2 sm:px-3" aria-label={t('header.mySchedules')}>
                  <FolderOpen className="h-4 w-4 sm:hidden" />
                  <span className="hidden sm:inline">{t('header.mySchedules')}</span>
                  <ChevronDown className="ml-1 hidden h-4 w-4 sm:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSlotSheetOpen(true)}>
                  {t('header.viewSlots')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSaveAsOpen(true)}>
                  {t('header.saveAs')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSavePresetOpen(true)}>
                  {t('header.savePreset')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="default"
              size="sm"
              className="px-2 sm:px-3"
              onClick={() => setPresetOpen(true)}
              aria-label={t('header.presets')}
            >
              <Sparkles className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">{t('header.presets')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="px-2 sm:px-3"
              onClick={() => setExportOpen(true)}
              aria-label={t('header.export')}
            >
              <Download className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">{t('header.export')}</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('header.settings')}>
                  <SettingsIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[12rem]">
                <DropdownMenuItem onClick={() => setSettingsSection('language')} className="gap-2">
                  <Languages className="h-4 w-4" />
                  {t('settings.language')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsSection('font')} className="gap-2">
                  <Type className="h-4 w-4" />
                  {t('settings.font')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsSection('icons')} className="gap-2">
                  <Smile className="h-4 w-4" />
                  {t('settings.icons')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsSection('timeline')} className="gap-2">
                  <Ruler className="h-4 w-4" />
                  {t('settings.timeline')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsSection('background')} className="gap-2">
                  <ImageIcon className="h-4 w-4" />
                  {t('settings.background')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsSection('theme')} className="gap-2">
                  <Palette className="h-4 w-4" />
                  {t('settings.colorTheme')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShare} className="gap-2">
                  <Share2 className="h-4 w-4" />
                  {t('share.button')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyLink} className="gap-2">
                  <Link2 className="h-4 w-4" />
                  {t('sharelink.copy')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setHomeOpen(true)} className="gap-2">
                  <Smartphone className="h-4 w-4" />
                  {t('home.button')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setResetOpen(true)}
                  className="gap-2"
                  style={{ color: 'hsl(var(--destructive))' }}
                >
                  <RotateCcw className="h-4 w-4" />
                  {t('settings.reset')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        className={
          isMobile
            ? 'flex-1 container mx-auto flex flex-col items-center gap-6 px-3 pb-12 pt-12'
            : 'flex-1 container mx-auto py-8 flex items-center justify-center px-4'
        }
      >
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
            onSliceSplit={handlers.onSliceSplit}
            showEmptyHint={false}
            selectedSliceId={editingSliceId}
            title={present.name}
            onHubClick={() => setEditingTitle(true)}
            mobileNoChartDrag={isMobile}
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

        {/* Mobile: stacked sections below the chart. Editing stays enabled (touch
            + long-press); only the desktop floating overlays are replaced. */}
        {isMobile && (
          <>
            <div className="-mt-2 flex flex-col items-center gap-1.5">
              <Button
                onClick={() => setTimeBlockOpen(true)}
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
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('settings.reset')}</DialogTitle>
            <DialogDescription>{t('settings.resetBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              style={{ backgroundColor: 'hsl(var(--destructive))', color: 'hsl(var(--destructive-foreground))' }}
              onClick={() => {
                resetAllData();
                setResetOpen(false);
                // Reload so every provider re-initialises to first-launch defaults.
                setTimeout(() => window.location.reload(), 100);
              }}
            >
              {t('settings.resetConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        currentName={present.name}
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

      {/* About / manual + Circloser brand (opened from the title) */}
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />

      {/* Mobile: add a time block by typing start/end (instead of finger-dragging). */}
      <TimeBlockDialog open={timeBlockOpen} onOpenChange={setTimeBlockOpen} />

      {/* One-time first-visit welcome over the seeded demo schedule. */}
      <WelcomeOverlay
        open={welcomeOpen}
        onOpenChange={(o) => { if (!o) dismissWelcome(); }}
        onPickPreset={() => setPresetOpen(true)}
        isMobile={isMobile}
      />

      {/* Incoming share link (#p=…) → confirm before replacing the schedule. */}
      <Dialog open={shareImport !== null} onOpenChange={(o) => { if (!o) setShareImport(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('sharelink.importTitle')}</DialogTitle>
            <DialogDescription>{t('sharelink.importBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareImport(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (shareImport) dispatch({ type: 'LOAD_SCHEDULE', schedule: shareImport });
                setShareImport(null);
              }}
              style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
            >
              {t('sharelink.importConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multi-day switcher (top thumbnails + bottom day indicator) */}
      <DayBar />

      {/* Desktop only: floating post-it memos (bottom-right) + clock tools
          (bottom-left). On mobile these move into the stacked sections under the
          chart (MobileMemoSection / MobileClockSection inside <main>). */}
      {!isMobile && <MemoLayer />}
      {!isMobile && <ClockToolsLayer />}
    </div>
  );
}

export default App;
