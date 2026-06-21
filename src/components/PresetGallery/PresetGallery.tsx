import { useState } from 'react';
import { X } from 'lucide-react';
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
import { COLOR_THEMES } from '@/data/color-themes';
import { useTranslation } from '@/hooks/usePreferences';
import { useUserPresets } from '@/hooks/useUserPresets';
import { translatePresetName, translatePresetDesc } from '@/i18n/content';
import type { Preset } from '@/types/preset';
import type { TimeSlice } from '@/types/time-slice';

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
  onConfirm: (presetName: string, themeColors: string[] | null) => void;
  /** Load a user-saved preset (carries its own slices — not in PRESETS). */
  onLoadUserPreset?: (preset: Preset, themeColors: string[] | null) => void;
}

export function PresetGallery({ open, onOpenChange, onConfirm, onLoadUserPreset }: PresetGalleryProps) {
  const { t, lang } = useTranslation();
  const { presets: userPresets, removePreset } = useUserPresets();
  const [pendingPreset, setPendingPreset] = useState<Preset | null>(null);
  // Whether the pending card is a user preset (loaded by object) vs a built-in
  // (loaded by name via onConfirm).
  const [pendingIsUser, setPendingIsUser] = useState(false);
  // Pick the content (preset) AND the colour theme before starting. null = the
  // preset's own original colours.
  const [themeId, setThemeId] = useState<string | null>(null);

  const themeColors = themeId
    ? (COLOR_THEMES.find((c) => c.id === themeId)?.colors ?? null)
    : null;
  const recolor = (slices: TimeSlice[]): TimeSlice[] =>
    themeColors
      ? slices.map((s, i) => ({ ...s, color: themeColors[i % themeColors.length] }))
      : slices;

  function handleCardClick(preset: Preset, isUser = false) {
    setPendingPreset(preset);
    setPendingIsUser(isUser);
    onOpenChange(false); // close the gallery so the confirm shows alone (no nesting)
  }

  function handleConfirm() {
    if (pendingPreset) {
      if (pendingIsUser && onLoadUserPreset) onLoadUserPreset(pendingPreset, themeColors);
      else onConfirm(pendingPreset.name, themeColors);
    }
    setPendingPreset(null);
    setPendingIsUser(false);
  }

  // Cancel (취소 button, Escape, backdrop) just closes the confirm and returns
  // to the timetable. Reopen the gallery via the 프리셋 button to pick another.
  function closeConfirm() {
    setPendingPreset(null);
    setPendingIsUser(false);
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

          {/* Colour theme picker — recolours every preview live so the user
              chooses both content and palette before starting. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">{t('settings.colorTheme')}</span>
            <button
              type="button"
              aria-pressed={themeId === null}
              onClick={() => setThemeId(null)}
              className="opt-chip px-2.5 py-1 rounded-md text-xs"
            >
              {t('preset.themeOriginal')}
            </button>
            {COLOR_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                aria-pressed={themeId === theme.id}
                onClick={() => setThemeId(theme.id)}
                className="opt-chip px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1"
              >
                <span className="flex gap-0.5">
                  {theme.colors.slice(0, 4).map((c, i) => (
                    <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </span>
                {lang === 'ko' ? theme.ko : theme.en}
              </button>
            ))}
          </div>

          {/* User-saved presets (with a delete affordance). Built from the
              current schedule via "Save as preset". */}
          {userPresets.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">{t('preset.myPresets')}</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {userPresets.map((up) => (
                  <div key={up.id} className="relative">
                    <button
                      className="glass-card w-full p-4 rounded-2xl text-left hover:ring-2 hover:ring-primary transition"
                      onClick={() => handleCardClick({ name: up.name, description: '', slices: up.slices }, true)}
                    >
                      <h3 className="font-semibold mb-1 pr-6 truncate">{up.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {new Date(up.createdAt).toLocaleDateString(lang === 'ko' ? 'ko-KR' : undefined)}
                      </p>
                      <CircleTimeline slices={recolor(up.slices)} interactionMode="view" size={240} />
                    </button>
                    <button
                      type="button"
                      aria-label={t('preset.deletePreset')}
                      title={t('preset.deletePreset')}
                      onClick={(e) => { e.stopPropagation(); removePreset(up.id); }}
                      className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full"
                      style={{ backgroundColor: 'hsl(var(--surface))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                <CircleTimeline slices={recolor(preset.slices)} interactionMode="view" size={240} />
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
              <CircleTimeline slices={recolor(pendingPreset.slices)} interactionMode="view" size={200} />
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
