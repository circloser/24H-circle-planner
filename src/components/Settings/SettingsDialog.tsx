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
  FONT_SCALES,
  BACKGROUNDS,
} from '@/hooks/usePreferences';
import { LANGUAGES, type Lang } from '@/i18n/translations';
import type { TKey } from '@/i18n/translations';

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SIZE_LABEL: Record<string, TKey> = {
  small: 'size.small',
  medium: 'size.medium',
  large: 'size.large',
};

const BG_LABEL: Record<string, TKey> = {
  none: 'bg.none',
  dots: 'bg.dots',
  grid: 'bg.grid',
  diagonal: 'bg.diagonal',
  gradient: 'bg.gradient',
  paper: 'bg.paper',
};

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { prefs, setPreference } = usePreferences();
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm border transition-colors',
                    prefs.language === l.code
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input hover:bg-muted',
                  )}
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
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm border transition-colors',
                    prefs.fontFamily === f.css
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input hover:bg-muted',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </section>

          {/* Font size */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t('settings.fontSize')}</h3>
            <div className="flex gap-1.5">
              {FONT_SCALES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setPreference('fontScale', s.value)}
                  aria-pressed={prefs.fontScale === s.value}
                  className={cn(
                    'flex-1 px-3 py-1.5 rounded-md text-sm border transition-colors',
                    prefs.fontScale === s.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input hover:bg-muted',
                  )}
                >
                  {t(SIZE_LABEL[s.id])}
                </button>
              ))}
            </div>
          </section>

          {/* Background */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t('settings.background')}</h3>
            <div className="flex flex-wrap gap-1.5">
              {BACKGROUNDS.map((bg) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => setPreference('background', bg)}
                  aria-pressed={prefs.background === bg}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm border transition-colors',
                    prefs.background === bg
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input hover:bg-muted',
                  )}
                >
                  {t(BG_LABEL[bg])}
                </button>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
