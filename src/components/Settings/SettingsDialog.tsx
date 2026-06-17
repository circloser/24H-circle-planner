import { useRef, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  usePreferences,
  useTranslation,
  FONT_FAMILIES,
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
  FONT_SCALE_STEP,
  BACKGROUNDS,
  type Background,
} from '@/hooks/usePreferences';
import { fileToBackgroundDataUrl } from '@/lib/image-bg';
import { useStoreDispatch } from '@/hooks/useScheduleStore';
import { COLOR_THEMES } from '@/data/color-themes';
import { LANGUAGES, type Lang } from '@/i18n/translations';
import type { TKey } from '@/i18n/translations';

/** Each settings category is its own focused dialog, opened from the gear menu. */
export type SettingsSection = 'language' | 'font' | 'icons' | 'background' | 'theme';

export interface SettingsDialogProps {
  section: SettingsSection | null;
  onClose: () => void;
}

const SECTION_TITLE: Record<SettingsSection, TKey> = {
  language: 'settings.language',
  font: 'settings.font',
  icons: 'settings.icons',
  background: 'settings.background',
  theme: 'settings.colorTheme',
};

const BG_LABEL: Record<Background, TKey> = {
  none: 'bg.none',
  dots: 'bg.dots',
  grid: 'bg.grid',
  diagonal: 'bg.diagonal',
  gradient: 'bg.gradient',
  paper: 'bg.paper',
  checker: 'bg.checker',
  waves: 'bg.waves',
  memo: 'bg.memo',
};

// Selection highlight is driven by aria-pressed via the `.opt-chip` CSS (raw
// vars, since Tailwind semantic color utilities aren't generated here).
const OPT_CHIP = 'opt-chip px-3 py-1.5 rounded-md text-sm';

export function SettingsDialog({ section, onClose }: SettingsDialogProps) {
  const { prefs, setPreference } = usePreferences();
  const { t, lang } = useTranslation();
  const dispatch = useStoreDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectPattern = (bg: Background) => {
    setPreference('background', bg);
    setPreference('bgType', 'pattern');
  };

  const selectColor = (hex: string) => {
    setPreference('bgColor', hex);
    setPreference('bgType', 'color');
  };

  const onImagePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file later
    if (!file) return;
    try {
      const dataUrl = await fileToBackgroundDataUrl(file);
      setPreference('bgImage', dataUrl);
      setPreference('bgType', 'image');
    } catch {
      toast.error(t('settings.bgImage'));
    }
  };

  const removeImage = () => {
    setPreference('bgImage', null);
    setPreference('bgType', 'pattern');
  };

  return (
    <Dialog open={section !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{section ? t(SECTION_TITLE[section]) : ''}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-1">
          {/* Language */}
          {section === 'language' && (
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setPreference('language', l.code as Lang)}
                  aria-pressed={prefs.language === l.code}
                  className={OPT_CHIP}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}

          {/* Font: family + size */}
          {section === 'font' && (
            <>
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{t('settings.fontFamily')}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {FONT_FAMILIES.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setPreference('fontFamily', f.css)}
                      aria-pressed={prefs.fontFamily === f.css}
                      style={{ fontFamily: `${f.css}, system-ui, sans-serif` }}
                      className={OPT_CHIP}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{t('settings.fontSize')}</h3>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={FONT_SCALE_MIN}
                    max={FONT_SCALE_MAX}
                    step={FONT_SCALE_STEP}
                    value={prefs.fontScale}
                    onChange={(e) => setPreference('fontScale', Number(e.target.value))}
                    aria-label={t('settings.fontSize')}
                    className="flex-1 accent-[hsl(var(--primary))] cursor-pointer"
                  />
                  <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                    {Math.round(prefs.fontScale * 100)}%
                  </span>
                </div>
              </section>
            </>
          )}

          {/* Icons on/off */}
          {section === 'icons' && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPreference('showIcons', true)}
                aria-pressed={prefs.showIcons}
                className={OPT_CHIP}
              >
                {t('settings.iconsShow')}
              </button>
              <button
                type="button"
                onClick={() => setPreference('showIcons', false)}
                aria-pressed={!prefs.showIcons}
                className={OPT_CHIP}
              >
                {t('settings.iconsHide')}
              </button>
            </div>
          )}

          {/* Background */}
          {section === 'background' && (
            <div className="flex flex-col gap-3">
              {/* Patterns */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">{t('settings.bgPattern')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {BACKGROUNDS.map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => selectPattern(bg)}
                      aria-pressed={prefs.bgType === 'pattern' && prefs.background === bg}
                      className={OPT_CHIP}
                    >
                      {t(BG_LABEL[bg])}
                    </button>
                  ))}
                </div>
              </div>

              {/* Solid color */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">{t('settings.bgColor')}</span>
                <label
                  data-selected={prefs.bgType === 'color'}
                  className="opt-pick inline-flex items-center gap-2 w-fit px-2 py-1.5 rounded-md cursor-pointer"
                >
                  <span
                    className="h-6 w-6 rounded border border-input"
                    style={{ backgroundColor: prefs.bgColor }}
                  />
                  <span className="text-sm tabular-nums">{prefs.bgColor}</span>
                  <input
                    type="color"
                    value={prefs.bgColor}
                    onChange={(e) => selectColor(e.target.value)}
                    aria-label={t('settings.bgColor')}
                    className="sr-only"
                  />
                </label>
              </div>

              {/* Image upload */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">{t('settings.bgImage')}</span>
                <div className="flex items-center gap-2">
                  {prefs.bgImage ? (
                    <span
                      data-selected={prefs.bgType === 'image'}
                      className="opt-pick h-12 w-20 rounded-md bg-cover bg-center cursor-pointer"
                      style={{ backgroundImage: `url("${prefs.bgImage}")` }}
                      role="img"
                      aria-label={t('settings.bgImage')}
                      onClick={() => setPreference('bgType', 'image')}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-muted transition-colors"
                  >
                    {t('settings.uploadImage')}
                  </button>
                  {prefs.bgImage ? (
                    <button
                      type="button"
                      onClick={removeImage}
                      className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-muted transition-colors"
                    >
                      {t('settings.removeImage')}
                    </button>
                  ) : null}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onImagePick}
                    className="sr-only"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Color theme — recolours all slices (undoable schedule change) */}
          {section === 'theme' && (
            <div className="flex flex-col gap-1.5">
              {COLOR_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => dispatch({ type: 'APPLY_PALETTE', colors: theme.colors })}
                  className="opt-pick flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-muted transition-colors"
                >
                  <span className="flex gap-0.5 shrink-0">
                    {theme.colors.slice(0, 8).map((c, i) => (
                      <span
                        key={i}
                        className="h-4 w-4 rounded-sm"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </span>
                  <span className="text-sm">{lang === 'ko' ? theme.ko : theme.en}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
