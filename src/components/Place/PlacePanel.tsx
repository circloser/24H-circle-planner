import { useEffect, useState } from 'react';
import { Check, House, MapPin, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/usePreferences';
import { loadPhoto } from '@/lib/calendar-photos';
import type { CityRow } from '@/lib/place-world';
import type { CityVisit, CountryShape, CountryVisit, Pin, PlaceData } from '@/lib/place';
import { PIN_ICON, PIN_LABEL, continentName } from './palette';
import { CityPicker } from './PlaceDialogs';

/**
 * The country card: whether it has been walked on, when first, whether it was
 * ever home, which of its cities, and a line of one's own about it.
 */
export function CountryCard({
  shape, visit, data, cityRows, name, onToggle, onPatch, onAddCity, onRemoveCity, onClose, onOpenPin,
}: {
  shape: CountryShape;
  visit: CountryVisit | undefined;
  data: PlaceData;
  cityRows: readonly CityRow[];
  name: string;
  onToggle: () => void;
  onPatch: (patch: Partial<CountryVisit>) => void;
  onAddCity: (city: CityVisit) => void;
  onRemoveCity: (id: string) => void;
  onClose: () => void;
  onOpenPin: (id: string) => void;
}) {
  const { t } = useTranslation();
  const been = !!visit;
  const cities = data.cities.filter((c) => c.countryCode === shape.code);
  const pins = data.pins.filter((p) => p.countryCode === shape.code);

  return (
    <aside data-place-panel data-country={shape.code}
      className="flex w-full flex-col gap-4 border-t border-border bg-surface p-4 min-[900px]:w-[360px] min-[900px]:border-l min-[900px]:border-t-0">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-foreground" data-place-panel-name>{name}</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{continentName(shape.continent, t)}</p>
        </div>
        <button type="button" aria-label={t('common.close')} data-place-panel-close
          className="-m-1 grid h-9 w-9 shrink-0 place-items-center rounded-md hover:bg-accent/20" onClick={onClose}>
          <X aria-hidden className="h-4 w-4" />
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={been ? 'default' : 'outline'} className="gap-1.5" aria-pressed={been}
          data-place-visited-toggle onClick={onToggle}>
          <Check aria-hidden className="h-4 w-4" />
          {t('place.visited')}
        </Button>
        {been && (
          <Button size="sm" variant={visit?.lived ? 'default' : 'outline'} className="gap-1.5"
            aria-pressed={visit?.lived === true} data-place-lived-toggle
            onClick={() => onPatch({ lived: !visit?.lived })}>
            <House aria-hidden className="h-4 w-4" />
            {t('place.lived')}
          </Button>
        )}
      </div>

      {been && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">{t('place.field.firstYear')}</span>
            <Input type="number" inputMode="numeric" min={1800} max={2200} className="w-32"
              data-place-first-year value={visit?.firstYear ?? ''}
              onChange={(e) => {
                const n = Number(e.target.value);
                onPatch({ firstYear: Number.isInteger(n) && n >= 1800 && n <= 2200 ? n : undefined });
              }} />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">{t('place.addCity')}</span>
            <CityPicker rows={cityRows} code={shape.code} label={t('place.searchCity')}
              onPick={(city) => onAddCity({
                id: city.id, name: city.name, countryCode: city.code, lat: city.lat, lng: city.lng,
              })} />
            {cities.length > 0 && (
              <ul className="mt-1 flex flex-wrap gap-1.5" data-place-city-list>
                {cities.map((city) => (
                  <li key={city.id}>
                    <span className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border px-2.5 text-[13px]">
                      {city.name}
                      <button type="button" aria-label={t('common.remove')} data-place-city-remove={city.id}
                        className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-accent/20"
                        onClick={() => onRemoveCity(city.id)}>
                        <X aria-hidden className="h-3 w-3" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {pins.length > 0 && (
            <ul className="flex flex-col gap-0.5" data-place-country-pins>
              {pins.map((pin) => {
                const Icon = PIN_ICON[pin.category];
                return (
                  <li key={pin.id}>
                    <button type="button" data-place-country-pin={pin.id}
                      className="flex min-h-8 w-full items-center gap-1.5 rounded-md px-2 text-left text-sm hover:bg-accent/20"
                      onClick={() => onOpenPin(pin.id)}>
                      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{pin.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}

/** The pin card: what it is, when, who was there, and the note. */
export function PinCard({ pin, people, onClose, onEdit, onDelete }: {
  pin: Pin;
  people: ReadonlyArray<{ id: string; name: string }>;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const Icon = PIN_ICON[pin.category];
  // The picture lives in this device's store, so it is fetched when shown.
  const [photo, setPhoto] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    let alive = true;
    if (!pin.photo) return;
    void loadPhoto(pin.photo).then((url) => {
      if (alive && url) setPhoto({ id: pin.photo!, url });
    });
    return () => { alive = false; };
  }, [pin.photo]);
  const withThem = (pin.personIds ?? [])
    .map((id) => people.find((p) => p.id === id)?.name)
    .filter((n): n is string => !!n);

  return (
    <aside data-place-panel data-pin={pin.id}
      className="flex w-full flex-col gap-4 border-t border-border bg-surface p-4 min-[900px]:w-[360px] min-[900px]:border-l min-[900px]:border-t-0">
      <header className="flex items-start gap-3">
        <Icon aria-hidden className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-foreground" data-place-panel-name>{pin.name}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
            <span>{t(PIN_LABEL[pin.category])}</span>
            {pin.date && <span>{pin.date.replace(/-/g, '.')}</span>}
          </p>
        </div>
        <button type="button" aria-label={t('common.close')} data-place-panel-close
          className="-m-1 grid h-9 w-9 shrink-0 place-items-center rounded-md hover:bg-accent/20" onClick={onClose}>
          <X aria-hidden className="h-4 w-4" />
        </button>
      </header>

      {photo && photo.id === pin.photo && (
        <img src={photo.url} alt="" data-place-panel-photo
          className="max-h-56 w-full rounded-lg object-cover" />
      )}

      {pin.note && <p className="whitespace-pre-wrap text-sm text-foreground">{pin.note}</p>}

      {withThem.length > 0 && (
        <p className="text-[13px] text-muted-foreground" data-place-panel-people>
          {t('place.withPeople')} · {withThem.join(', ')}
        </p>
      )}

      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <MapPin aria-hidden className="h-3.5 w-3.5" />
        {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" data-place-pin-edit onClick={onEdit}>
          <Pencil aria-hidden className="h-4 w-4" />
          {t('common.edit')}
        </Button>
        <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" data-place-pin-delete onClick={onDelete}>
          <Trash2 aria-hidden className="h-4 w-4" />
          {t('common.delete')}
        </Button>
      </div>
    </aside>
  );
}
