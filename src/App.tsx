import { useState, useCallback, useRef, useEffect } from 'react';
import './index.css';
import { ChevronDown } from 'lucide-react';
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
import { SlotSheet } from '@/components/SlotSheet/SlotSheet';
import { SaveAsDialog } from '@/components/SaveAsDialog/SaveAsDialog';
import { ExportDialog } from '@/components/ExportPanel/ExportDialog';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { useSliceInteraction } from '@/hooks/useSliceInteraction';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { STORAGE_KEY_SCHEDULE } from '@/lib/storage';
import { PRESETS } from '@/data/presets';
import { hhmmToMinutes, minutesToHhmm, sliceWidthMinutes } from '@/lib/time-utils';
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

  // ── "+ 일정 추가" handler ────────────────────────────────────────────────────
  // Finds the slice containing "now" (or the largest slice as fallback),
  // splits it at its midpoint, then opens the editor on the new CW slice.
  //
  // The SPLIT reducer is synchronous. We store the target startTime in a ref,
  // then a useEffect that watches present.slices reads the new slice id and
  // calls setEditingSliceId. The ref (not state) avoids the effect firing
  // on every render; it is read-and-cleared once in the effect.

  const pendingEditStartTimeRef = useRef<string | null>(null);

  useEffect(() => {
    const targetTime = pendingEditStartTimeRef.current;
    if (!targetTime) return;
    const newSlice = present.slices.find((s) => s.startTime === targetTime);
    if (newSlice) {
      pendingEditStartTimeRef.current = null;
      setEditingSliceId(newSlice.id);
    }
  }, [present.slices]);

  const handleAddSlice = useCallback(() => {
    const slices = present.slices;
    if (slices.length === 0) return;

    // Find the slice covering "now"
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    let targetSlice = slices[0];
    for (const s of slices) {
      const startMin = hhmmToMinutes(s.startTime);
      const endStr = s.endTime === '24:00' ? '00:00' : s.endTime;
      const endMin = hhmmToMinutes(endStr);
      const wraps = endMin <= startMin;
      const contains = wraps
        ? nowMin >= startMin || nowMin < endMin
        : nowMin >= startMin && nowMin < endMin;
      if (contains) { targetSlice = s; break; }
    }

    // Fallback to widest slice when the now-slice is too narrow to split
    if (sliceWidthMinutes(targetSlice) < 20) {
      let widest = slices[0];
      for (const s of slices) {
        if (sliceWidthMinutes(s) > sliceWidthMinutes(widest)) widest = s;
      }
      targetSlice = widest;
    }

    if (sliceWidthMinutes(targetSlice) < 20) {
      toast.error('분할할 수 있는 일정이 없습니다 (최소 20분 필요)');
      return;
    }

    // Compute midpoint, snapped to nearest 10 min
    const startMin = hhmmToMinutes(targetSlice.startTime);
    const widthMin = sliceWidthMinutes(targetSlice);
    const midMin = (startMin + Math.floor(widthMin / 2)) % 1440;
    const snapped = (Math.round(midMin / 10) * 10) % 1440;
    const midHhmm = minutesToHhmm(snapped);

    // Store target startTime in ref before dispatching so the effect can find
    // the new slice on the next render after the store update.
    pendingEditStartTimeRef.current = midHhmm;
    dispatch({ type: 'SPLIT', hhmm: midHhmm });
  }, [present.slices, dispatch]);

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
            {/* "+ 일정 추가" — splits the now-slice at its midpoint and opens the editor */}
            <Button
              variant="secondary"
              onClick={handleAddSlice}
              aria-label="일정 추가"
            >
              + 일정 추가
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost">
                  내 시간표 <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSlotSheetOpen(true)}>
                  내 시간표 보기
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSaveAsOpen(true)}>
                  다른 이름으로 저장…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="default"
              onClick={() => setPresetOpen(true)}
            >
              프리셋
            </Button>
            <Button
              variant="outline"
              onClick={() => setExportOpen(true)}
            >
              내보내기
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
