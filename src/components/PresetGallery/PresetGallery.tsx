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
import { useTranslation } from '@/hooks/usePreferences';
import { translatePresetName, translatePresetDesc } from '@/i18n/content';
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
  const { t, lang } = useTranslation();
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
            <DialogTitle>{t('preset.galleryTitle')}</DialogTitle>
            <DialogDescription>{t('preset.galleryDesc')}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                className="glass-card p-4 rounded-2xl text-left hover:ring-2 hover:ring-primary transition"
                onClick={() => handleCardClick(preset)}
              >
                <h3 className="font-semibold mb-1">{translatePresetName(preset.name, lang)}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {translatePresetDesc(preset.description, lang)}
                </p>
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
            <DialogTitle>
              {t('preset.applyTitle', {
                name: translatePresetName(pendingPreset?.name ?? '', lang),
              })}
            </DialogTitle>
            <DialogDescription>
              {t('preset.applyBody', {
                name: translatePresetName(pendingPreset?.name ?? '', lang),
              })}
            </DialogDescription>
          </DialogHeader>

          {pendingPreset && (
            <div className="flex justify-center py-1">
              <CircleTimeline slices={pendingPreset.slices} interactionMode="view" size={200} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeConfirm}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleConfirm}>{t('preset.applyConfirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
