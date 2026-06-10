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
import { SettingsDialog } from '@/components/Settings/SettingsDialog';
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

  const handlePresetLoad = (name: string) => {
    const preset = PRESETS.find((p) => p.name === name);
    if (preset) dispatch({ type: 'LOAD_PRESET', preset, presetName: name });
    setPresetOpen(false);
  };
  const [slotSheetOpen, setSlotSheetOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [editingSliceId, setEditingSliceId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    toast.success(`${slot.name}을(를) 불러왔습니다`);
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
      <header className="border-b" style={{ borderColor: 'hsl(var(--border) / 0.6)' }}>
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
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('header.settings')}
              onClick={() => setSettingsOpen(true)}
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
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
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* T9: Export dialog */}
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        svgRef={svgRef}
        scheduleName={present.name}
        schedule={present}
        onImport={(s: Schedule) => dispatch({ type: 'LOAD_SCHEDULE', schedule: s })}
      />
    </div>
  );
}

export default App;
