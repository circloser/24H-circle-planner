import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CircleTimeline } from '@/components/CircleTimeline/CircleTimeline';
import { PRESETS } from '@/data/presets';
import type { Preset } from '@/types/preset';

/**
 * T6 + T15: Lifestyle preset gallery with a confirmation step.
 *
 * The two dialogs (gallery + confirm) are shown SEQUENTIALLY, never nested:
 * clicking a card closes the gallery and opens the confirm dialog alone. Nested
 * Radix dialogs fight over z-index/stacking and the confirm rendered behind the
 * gallery (nearly invisible). Sequential dialogs render cleanly on top.
 */

interface PresetGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (presetName: string) => void;
}

export function PresetGallery({ open, onOpenChange, onConfirm }: PresetGalleryProps) {
  const [pendingPreset, setPendingPreset] = useState<Preset | null>(null);

  function handleCardClick(preset: Preset) {
    setPendingPreset(preset);
    onOpenChange(false); // close the gallery so the confirm shows alone (no nesting)
  }

  function handleConfirm() {
    if (pendingPreset) onConfirm(pendingPreset.name);
    setPendingPreset(null);
  }

  // Cancel (취소 button, Escape, backdrop) just closes the confirm and returns
  // to the timetable. Reopen the gallery via the 프리셋 button to pick another.
  function closeConfirm() {
    setPendingPreset(null);
  }

  return (
    <>
      {/* ── Gallery dialog ───────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>라이프스타일 프리셋</DialogTitle>
            <DialogDescription>
              원하는 루틴을 선택하면 적용 여부를 확인한 뒤 현재 시간표에 반영됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                className="glass-card p-4 rounded-2xl text-left hover:ring-2 hover:ring-primary transition"
                onClick={() => handleCardClick(preset)}
              >
                <h3 className="font-semibold mb-1">{preset.name}</h3>
                <p className="text-sm text-muted-foreground mb-3">{preset.description}</p>
                <CircleTimeline slices={preset.slices} interactionMode="view" size={240} />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation dialog (shown alone, after the gallery closes) ──── */}
      <Dialog open={pendingPreset !== null} onOpenChange={(o) => { if (!o) closeConfirm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingPreset?.name} 적용</DialogTitle>
            <DialogDescription>
              &apos;{pendingPreset?.name}&apos; 프리셋을 현재 시간표에 적용할까요? 기존 시간표는
              덮어쓰여집니다.
            </DialogDescription>
          </DialogHeader>

          {pendingPreset && (
            <div className="flex justify-center py-1">
              <CircleTimeline slices={pendingPreset.slices} interactionMode="view" size={200} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeConfirm}>
              취소
            </Button>
            <Button onClick={handleConfirm}>현재 창에 적용</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
