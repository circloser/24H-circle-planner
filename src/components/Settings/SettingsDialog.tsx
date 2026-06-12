import { useRef, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
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
import { LANGUAGES, type Lang } from '@/i18n/translations';
import type { TKey } from '@/i18n/translations';

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

const chip = (active: boolean) =>
  cn(
    'px-3 py-1.5 rounded-md text-sm border transition-colors',
    active
      ? 'bg-primary text-primary-foreground border-primary'
      : 'border-input hover:bg-muted',
  );

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { prefs, setPreference } = usePreferences();
  const { t } = useTranslation();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-1">
          {/* Language */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t('settings.language')}</h3>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setPreference('language', l.code as Lang)}
                  aria-pressed={prefs.language === l.code}
                  className={chip(prefs.language === l.code)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </section>

          {/* Font family */}
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
                  className={chip(prefs.fontFamily === f.css)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </section>

          {/* Font size — continuous slider */}
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

          {/* Background */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{t('settings.background')}</h3>

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
                    className={chip(prefs.bgType === 'pattern' && prefs.background === bg)}
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
                className={cn(
                  'inline-flex items-center gap-2 w-fit px-2 py-1.5 rounded-md border cursor-pointer transition-colors',
                  prefs.bgType === 'color'
                    ? 'border-primary ring-2 ring-primary/40'
                    : 'border-input hover:bg-muted',
                )}
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
                    className={cn(
                      'h-12 w-20 rounded-md border bg-cover bg-center',
                      prefs.bgType === 'image' ? 'border-primary ring-2 ring-primary/40' : 'border-input',
                    )}
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
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
