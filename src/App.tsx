import { useState } from 'react';
import './index.css';
import { ChevronDown, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuid } from 'uuid';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CircleTimeline } from '@/components/CircleTimeline/CircleTimeline';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { PresetGallery } from '@/components/PresetGallery/PresetGallery';
import { SliceEditor } from '@/components/SliceEditor/SliceEditor';
import { HubTitleEditor } from '@/components/HubTitleEditor/HubTitleEditor';
import { SlotSheet } from '@/components/SlotSheet/SlotSheet';
import { SaveAsDialog } from '@/components/SaveAsDialog/SaveAsDialog';
import { ExportDialog } from '@/components/ExportPanel/ExportDialog';
import { SettingsDialog, type SettingsSection } from '@/components/Settings/SettingsDialog';
import { MemoLayer } from '@/components/Memo/MemoLayer';
import { useTranslation } from '@/hooks/usePreferences';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { useSliceInteraction } from '@/hooks/useSliceInteraction';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { STORAGE_KEY_SCHEDULE } from '@/lib/storage';
import { PRESETS } from '@/data/presets';
import type { Slot } from '@/types/slot';
import type { Schedule } from '@/types/schedule';

/**
 * F6: Returns true if this is a genuine first launch —
 * no saved schedule exists in localStorage.
 * Called as a lazy useState initializer so it runs once on first render.
 */
function checkIsFirstLaunch(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_SCHEDULE) === null;
  } catch {
    return false;
  }
}

function App() {
  const present = useStoreSelector((s) => s.history.present);
  const dispatch = useStoreDispatch();

  // F6: lazy initializer opens preset gallery on genuine first launch
  const [presetOpen, setPresetOpen] = useState<boolean>(checkIsFirstLaunch);

  const handlePresetLoad = (name: string, themeColors: string[] | null) => {
    const preset = PRESETS.find((p) => p.name === name);
    if (preset) {
      // Apply the chosen colour theme (if any) to the preset at load time, so
      // content + palette are chosen together in one undoable step.
      const themed = themeColors
        ? {
            ...preset,
            slices: preset.slices.map((s, i) => ({
              ...s,
              color: themeColors[i % themeColors.length],
            })),
          }
        : preset;
      dispatch({ type: 'LOAD_PRESET', preset: themed, presetName: name });
    }
    setPresetOpen(false);
  };
  const [slotSheetOpen, setSlotSheetOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [editingSliceId, setEditingSliceId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
  const { t } = useTranslation();

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
        <div className="container mx-auto h-14 flex items-center justify-between px-4">
          <h1 className="font-semibold text-base">24H Circle Planner</h1>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost">
                  {t('header.mySchedules')} <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSlotSheetOpen(true)}>
                  {t('header.viewSlots')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSaveAsOpen(true)}>
                  {t('header.saveAs')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="default" onClick={() => setPresetOpen(true)}>
              {t('header.presets')}
            </Button>
            <Button variant="outline" onClick={() => setExportOpen(true)}>
              {t('header.export')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('header.settings')}>
                  <SettingsIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSettingsSection('language')}>
                  {t('settings.language')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsSection('font')}>
                  {t('settings.font')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsSection('icons')}>
                  {t('settings.icons')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsSection('clock')}>
                  {t('settings.clock')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsSection('background')}>
                  {t('settings.background')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsSection('theme')}>
                  {t('settings.colorTheme')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto py-8 flex items-center justify-center px-4">
        <div className="max-w-[720px] w-full mx-auto aspect-square">
          <CircleTimeline
            slices={present.slices}
            mode="interactive"
            interactionMode="interactive"
            dragGroupRef={liveDragGroupRef}
            svgRef={svgRef}
            onPointerDownHandle={handlers.onPointerDownHandle}
            onSliceDoubleClick={handlers.onSliceDoubleClick}
            onBackgroundClick={handlers.onBackgroundClick}
            showEmptyHint={isEmptyState}
            selectedSliceId={editingSliceId}
            title={present.name}
            onHubClick={() => setEditingTitle(true)}
          />
        </div>
      </main>

      <PresetGallery open={presetOpen} onOpenChange={setPresetOpen} onConfirm={handlePresetLoad} />

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

      {/* Post-it memo layer (floating add button + notes) */}
      <MemoLayer />
    </div>
  );
}

export default App;
