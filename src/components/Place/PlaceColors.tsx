import { Check, Heart, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/usePreferences';
import { PIN_CATEGORIES, type PinCategory, type PlacePalette } from '@/lib/place';
import { PLACE_SWATCHES, type PlaceColors as Colors } from '@/lib/place-colors';
import type { TKey } from '@/i18n/translations';
import { PIN_ICON, PIN_LABEL } from './palette';

/** One thing that has a colour: what it is, what it is drawn in now, and the
 *  dozen it may be given instead. */
function Row({ label, icon, chosen, showing, reset, onPick, onClear }: {
  label: string;
  icon: React.ReactNode;
  chosen: string | undefined;
  showing: string;
  reset: string;
  onPick: (colour: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5" data-place-color-row={label}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
          style={{ background: showing, color: '#fff' }}>
          {icon}
        </span>
        <span className="text-[13px] text-foreground">{label}</span>
        {chosen && (
          <button type="button" data-place-color-clear
            className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[12px] text-muted-foreground hover:bg-accent/20"
            onClick={onClear}>
            <RotateCcw aria-hidden className="h-3.5 w-3.5" />
            {reset}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PLACE_SWATCHES.map((colour) => (
          <button key={colour} type="button" data-place-swatch={colour}
            aria-label={colour} aria-pressed={chosen === colour}
            className={`grid h-7 w-7 place-items-center rounded-full border transition-transform hover:scale-110 ${
              chosen === colour ? 'border-foreground' : 'border-border'}`}
            style={{ background: colour }}
            onClick={() => onPick(colour)}>
            {chosen === colour && <Check aria-hidden className="h-3.5 w-3.5 text-white" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The colours of the map, chosen.
 *
 * Two for the countries and one a kind of pin — the map keeps to few colours
 * whatever is chosen here, because what a country's colour means is "been" or
 * "meaning to", and a pin is told apart by its icon first.
 *
 * Nothing is written until a swatch is pressed, and every row can be put back
 * to the colour the theme gives it.
 */
export function PlaceColorsDialog({ open, onOpenChange, palette, colors, onChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What has been chosen so far (a row with nothing chosen is the theme's). */
  palette: PlacePalette | undefined;
  /** What the map is drawing with right now, chosen or not. */
  colors: Colors;
  onChange: (patch: PlacePalette) => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] max-w-md overflow-y-auto" data-place-colors-dialog>
        <DialogHeader>
          <DialogTitle>{t('place.colors.title')}</DialogTitle>
          <DialogDescription>{t('place.colors.hint')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Row reset={t('place.colors.reset')} label={t('place.visited')} icon={<Check className="h-3.5 w-3.5" />}
            chosen={palette?.visited} showing={colors.visited}
            onPick={(visited) => onChange({ visited })}
            onClear={() => onChange({ visited: undefined })} />
          <Row reset={t('place.colors.reset')} label={t('place.wish')} icon={<Heart className="h-3.5 w-3.5" />}
            chosen={palette?.wished} showing={colors.wished}
            onPick={(wished) => onChange({ wished })}
            onClear={() => onChange({ wished: undefined })} />
          <hr className="border-border" />
          <p className="text-[13px] font-medium text-muted-foreground">{t('place.colors.pins')}</p>
          {PIN_CATEGORIES.map((category: PinCategory) => {
            const Icon = PIN_ICON[category];
            return (
              <Row key={category} reset={t('place.colors.reset')} label={t(PIN_LABEL[category] as TKey)}
                icon={<Icon className="h-3.5 w-3.5" />}
                chosen={palette?.pins?.[category]} showing={colors.pin[category]}
                onPick={(colour) => onChange({ pins: { [category]: colour } })}
                onClear={() => onChange({ pins: { [category]: undefined } })} />
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
