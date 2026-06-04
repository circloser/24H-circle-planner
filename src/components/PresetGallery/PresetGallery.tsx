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
 * T6: Lifestyle preset gallery.
 * Uses a nested Dialog (not AlertDialog — alert-dialog not installed) for
 * the overwrite confirmation step. The outer Dialog shows 5 preset cards;
 * clicking a card opens the inner confirmation Dialog.
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
  }

  function handleConfirm() {
    if (pendingPreset) {
      onConfirm(pendingPreset.name);
    }
    setPendingPreset(null);
  }

  function handleCancelConfirm() {
    setPendingPreset(null);
  }

  return (
    <>
      {/* ── Outer gallery dialog ─────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>라이프스타일 프리셋</DialogTitle>
            <DialogDescription>
              원하는 루틴을 선택하면 현재 시간표가 해당 프리셋으로 교체됩니다.
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
                <CircleTimeline
                  slices={preset.slices}
                  interactionMode="view"
                  size={240}
                />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Inner confirmation dialog ────────────────────────────────────── */}
      <Dialog open={pendingPreset !== null} onOpenChange={(o) => { if (!o) setPendingPreset(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>프리셋 로드</DialogTitle>
            <DialogDescription>
              기존 시간표가 덮어쓰여집니다. &apos;{pendingPreset?.name}&apos; 프리셋을 로드할까요?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelConfirm}>
              취소
            </Button>
            <Button onClick={handleConfirm}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
