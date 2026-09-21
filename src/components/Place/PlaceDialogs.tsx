import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe, ImagePlus, Loader2, Lock, MapPin, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/usePreferences';
import { requestUpgrade } from '@/lib/pro';
import { deletePhoto, newPhotoId, savePhoto, shrinkPhoto } from '@/lib/calendar-photos';
import {
  MAX_PLACE_NAME, MAX_PLACE_NOTE, PIN_CATEGORIES, isPlaceDate,
  type Pin, type PinCategory,
} from '@/lib/place';
import { searchCities, type CityRow } from '@/lib/place-world';
import { lookupPlace, type FoundPlace } from '@/lib/place-geocode';
import type { PinDraft } from '@/hooks/usePlace';
import { PIN_ICON, PIN_LABEL } from './palette';

const field = 'text-sm font-medium text-foreground';
const area = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const PHOTO_EDGE = 960;

export type PinTarget =
  | { mode: 'add'; lat: number; lng: number; countryCode?: string }
  | { mode: 'edit'; pin: Pin };

/** A picture for a pin (Pro), kept on this device like every other. */
function PhotoField({ value, original, pro, onChange }: {
  value: string | undefined;
  original: string | undefined;
  pro: boolean;
  onChange: (id: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await shrinkPhoto(file, PHOTO_EDGE);
      if (!url || !alive.current) return;
      const id = newPhotoId();
      if (await savePhoto(id, url)) {
        if (value && value !== original) void deletePhoto(value);
        onChange(id);
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  if (!pro) {
    return (
      <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" data-place-photo-pro
        onClick={() => requestUpgrade('place')}>
        <Lock aria-hidden className="h-4 w-4" />
        {t('place.field.photo')}
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={input} type="file" accept="image/*" className="sr-only" data-place-photo-input
        onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={busy}
        onClick={() => input.current?.click()}>
        <ImagePlus aria-hidden className="h-4 w-4" />
        {t('place.field.photo')}
      </Button>
      {value && (
        <Button type="button" variant="ghost" size="sm" className="gap-1.5"
          onClick={() => { if (value !== original) void deletePhoto(value); onChange(undefined); }}>
          <X aria-hidden className="h-4 w-4" />
          {t('common.remove')}
        </Button>
      )}
    </div>
  );
}

/** Add or edit one pin. */
export function PinDialog({ target, pro, syncing, people, onClose, onSave, onDelete }: {
  target: PinTarget | null;
  pro: boolean;
  syncing: boolean;
  /** The relation map's people, to say who was there. */
  people: ReadonlyArray<{ id: string; name: string }>;
  onClose: () => void;
  onSave: (draft: PinDraft, id?: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const pin = target?.mode === 'edit' ? target.pin : null;
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PinCategory>('other');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [who, setWho] = useState<string[]>([]);

  useEffect(() => {
    if (!target) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(pin?.name ?? '');
    setCategory(pin?.category ?? 'other');
    setDate(pin?.date && pin.date.length === 10 ? pin.date : '');
    setNote(pin?.note ?? '');
    setPhoto(pin?.photo);
    setWho(pin?.personIds ? [...pin.personIds] : []);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const at = target?.mode === 'add' ? target : null;
  const lat = pin?.lat ?? at?.lat ?? 0;
  const lng = pin?.lng ?? at?.lng ?? 0;
  const country = pin?.countryCode ?? at?.countryCode;
  const valid = !!name.trim();
  const close = () => {
    if (photo && photo !== pin?.photo) void deletePhoto(photo);
    onClose();
  };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto" data-place-pin-dialog>
        <DialogHeader>
          <DialogTitle>{t(pin ? 'place.pin.editTitle' : 'place.pin.addTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('place.subtitle')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onSave({
            name: name.trim(),
            category,
            lat,
            lng,
            ...(country ? { countryCode: country } : {}),
            ...(isPlaceDate(date) ? { date } : {}),
            ...(pin?.endDate ? { endDate: pin.endDate } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
            ...(photo ? { photo } : {}),
            ...(who.length ? { personIds: who } : {}),
            ...(pin?.lifeMilestoneId ? { lifeMilestoneId: pin.lifeMilestoneId } : {}),
          }, pin?.id);
        }}>
          <label className="flex flex-col gap-1.5">
            <span className={field}>{t('place.field.name')}</span>
            <Input data-place-name-input value={name} maxLength={MAX_PLACE_NAME} required
              onChange={(e) => setName(e.target.value)} />
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className={field}>{t('place.field.category')}</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PIN_CATEGORIES.map((c) => {
                const Icon = PIN_ICON[c];
                const on = category === c;
                return (
                  <button key={c} type="button" data-place-cat={c} aria-pressed={on}
                    onClick={() => setCategory(c)}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] ${
                      on ? 'border-foreground bg-accent/20 text-foreground' : 'border-border text-muted-foreground'}`}>
                    <Icon aria-hidden className="h-3.5 w-3.5" />
                    {t(PIN_LABEL[c])}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className={field}>{t('place.field.date')}</span>
            <Input type="date" data-place-date-input value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={field}>{t('place.field.note')}</span>
            <textarea data-place-note-input value={note} maxLength={MAX_PLACE_NOTE} rows={2}
              onChange={(e) => setNote(e.target.value)} className={area} />
          </label>

          {people.length > 0 && (
            <fieldset className="flex flex-col gap-1.5">
              <legend className={field}>{t('place.withPeople')}</legend>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {people.map((p) => {
                  const on = who.includes(p.id);
                  return (
                    <button key={p.id} type="button" data-place-who={p.id} aria-pressed={on}
                      onClick={() => setWho((was) => (on ? was.filter((x) => x !== p.id) : [...was, p.id]))}
                      className={`inline-flex min-h-9 items-center rounded-full border px-3 text-[13px] ${
                        on ? 'border-foreground bg-accent/20 text-foreground' : 'border-border text-muted-foreground'}`}>
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="flex flex-col gap-1.5">
            <span className={field}>{t('place.field.photo')}</span>
            <PhotoField value={photo} original={pin?.photo} pro={pro} onChange={setPhoto} />
          </div>

          <p className="rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground"
            data-place-privacy>
            {t('place.privacy.hint')}
            {syncing ? ` ${t('relation.privacy.sync')}` : ''}
          </p>

          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground" data-place-coords>
            <MapPin aria-hidden className="h-3.5 w-3.5" />
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </p>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {pin && (
              <Button type="button" variant="ghost" size="sm" className="mr-auto gap-1.5 text-destructive"
                data-place-delete onClick={() => onDelete(pin.id)}>
                <Trash2 aria-hidden className="h-4 w-4" />
                {t('common.delete')}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={close}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={!valid} data-place-save className="bg-primary text-primary-foreground">
              {t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Find a city by name, from the list that ships with the app. No search
 * service is called: the names are already here.
 */
export function CityPicker({ rows, code, onPick, label }: {
  rows: readonly CityRow[];
  /** Narrow the search to one country, when there is one in mind. */
  code?: string;
  onPick: (city: CityRow) => void;
  label: string;
}) {
  const { t, lang } = useTranslation();
  const [query, setQuery] = useState('');
  const found = useMemo(() => searchCities(rows, query, 6, code), [rows, query, code]);
  // What the wider world says, when it has been asked — and it is only ever
  // asked by pressing the button, never by typing.
  const [asked, setAsked] = useState<{ q: string; places: FoundPlace[] } | null>(null);
  const [asking, setAsking] = useState(false);
  const q = query.trim();
  const online = asked && asked.q === q ? asked.places : null;

  const ask = async () => {
    if (!q || asking) return;
    setAsking(true);
    const places = await lookupPlace(q, lang);
    setAsked({ q, places });
    setAsking(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Input value={query} data-place-city-search placeholder={label}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          // Inside a form, Enter would submit it; here it is how you search.
          e.preventDefault();
          void ask();
        }} />
      {found.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {found.map((city) => (
            <li key={city.id}>
              <button type="button" data-place-city-option={city.id}
                className="min-h-9 w-full rounded-md px-2 text-left text-sm hover:bg-accent/20"
                onClick={() => { onPick(city); setQuery(''); setAsked(null); }}>
                {city.name}
                <span className="ml-1.5 text-muted-foreground">{city.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* The list that ships with the app is seven thousand places named in
          English; a life happens in smaller ones, called what they are called.
          Asking the wider world is one press, never a keystroke. */}
      {q.length > 1 && (
        <button type="button" data-place-city-online disabled={asking} onClick={() => void ask()}
          className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-md px-2 text-[13px] text-primary hover:bg-accent/20 disabled:opacity-60">
          {asking
            ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
            : <Globe aria-hidden className="h-3.5 w-3.5" />}
          {t('place.searchOnline', { q })}
        </button>
      )}
      {online && online.length > 0 && (
        <ul className="flex flex-col gap-0.5" data-place-city-online-list>
          {online.map((city) => (
            <li key={city.id}>
              <button type="button" data-place-city-option={city.id}
                className="min-h-9 w-full rounded-md px-2 text-left text-sm hover:bg-accent/20"
                onClick={() => { onPick(city); setQuery(''); setAsked(null); }}>
                {city.name}
                <span className="ml-1.5 text-[12px] text-muted-foreground">{city.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {((q && found.length === 0 && !online) || (online && online.length === 0)) && (
        <p className="px-2 text-[13px] text-muted-foreground">{t('place.noCity')}</p>
      )}
      {online && online.length > 0 && (
        <p className="px-2 text-[11px] text-muted-foreground" data-place-city-credit>
          {t('place.searchCredit')}
        </p>
      )}
    </div>
  );
}
