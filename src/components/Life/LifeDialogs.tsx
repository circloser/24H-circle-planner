import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Lock, MapPin, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/usePreferences';
import { requestUpgrade } from '@/lib/pro';
import { deletePhoto, newPhotoId, savePhoto, shrinkPhoto } from '@/lib/calendar-photos';
import {
  MAX_DESCRIPTION, MAX_NAME, MAX_NOTE, MAX_TITLE, PICKABLE_CATEGORIES,
  dateFrom, isFullDate, partsFrom, sortKey, type DateParts, type FamilyMember, type LifeCategory, type LifeLine, type LifeProfile, type Milestone, type Relation,
} from '@/lib/life';
import { todayKey } from '@/lib/calendar-grid';
import type { MemberDraft, MilestoneDraft } from '@/hooks/useLife';
import { CATEGORY_ICON, CATEGORY_LABEL, RELATION_LABEL, inkOf } from './categories';
import { loadCities, searchCities, type CityRow } from '@/lib/place-world';
import { LifeDateInput } from './LifeDateInput';
import { LifePhoto } from './LifeTimeline';

/**
 * Where a moment happened. The city list ships with the app, so nothing is
 * asked of a search service; choosing one here colours that country in on the
 * place map (lib/life-place).
 */
function PlaceField({ value, onChange }: {
  value: { countryCode: string; cityId?: string } | undefined;
  onChange: (where: { countryCode: string; cityId?: string } | undefined) => void;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<readonly CityRow[]>([]);
  const [query, setQuery] = useState('');
  useEffect(() => {
    let alive = true;
    void loadCities().then((c) => { if (alive) setRows(c); });
    return () => { alive = false; };
  }, []);
  const found = useMemo(() => searchCities(rows, query, 5), [rows, query]);
  const chosen = value?.cityId ? rows.find((c) => c.id === value.cityId) : undefined;

  if (value) {
    return (
      <span className="inline-flex w-fit min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm"
        data-life-place-chosen={value.cityId ?? value.countryCode}>
        <MapPin aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
        {chosen?.name ?? value.countryCode}
        <button type="button" aria-label={t('common.remove')} data-life-place-clear
          className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-accent/20"
          onClick={() => onChange(undefined)}>
          <X aria-hidden className="h-3 w-3" />
        </button>
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Input value={query} data-life-place-search placeholder={t('place.searchCity')}
        onChange={(e) => setQuery(e.target.value)} />
      {found.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {found.map((city) => (
            <li key={city.id}>
              <button type="button" data-life-place-option={city.id}
                className="min-h-9 w-full rounded-md px-2 text-left text-sm hover:bg-accent/20"
                onClick={() => { onChange({ countryCode: city.code, cityId: city.id }); setQuery(''); }}>
                {city.name}
                <span className="ml-1.5 text-muted-foreground">{city.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const textarea = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const fieldLabel = 'text-sm font-medium text-foreground';
/** Longest edge kept for a life photo — a card-wide 16:9 picture. */
const PHOTO_EDGE = 960;

/**
 * A picture for an entry (Pro). It is stored on this device the moment it is
 * picked; a picture chosen and then dropped again in the same dialog, or left
 * behind by a cancelled dialog, is deleted (see `discardPhoto`).
 */
function PhotoField({ value, original, pro, onChange }: {
  value: string | undefined;
  original: string | undefined;
  pro: boolean;
  onChange: (id: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // A picture still being shrunk when the dialog closes must not be left behind.
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const replace = (next: string | undefined) => {
    if (value && value !== original) void deletePhoto(value);
    onChange(next);
  };
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const url = await shrinkPhoto(file, PHOTO_EDGE);
    const id = newPhotoId();
    const saved = !!url && (await savePhoto(id, url));
    if (!alive.current) {
      if (saved) void deletePhoto(id);
      return;
    }
    if (saved) replace(id);
    setBusy(false);
  };
  if (!pro && !value) {
    return (
      <button type="button" onClick={() => requestUpgrade('life')} data-life-photo-locked
        className="flex min-h-11 items-center gap-2 rounded-md border border-dashed border-border px-3 text-left text-sm text-muted-foreground hover:bg-accent/10">
        <Lock aria-hidden className="h-4 w-4 shrink-0" />
        {t('life.field.photoPro')}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {value && <LifePhoto id={value} className="aspect-video w-full rounded-lg" />}
      <div className="flex flex-wrap gap-2">
        {pro && (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()} className="gap-1.5">
            <ImagePlus aria-hidden className="h-4 w-4" />
            {t(value ? 'life.field.photoChange' : 'life.field.photoAdd')}
          </Button>
        )}
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => replace(undefined)} className="gap-1.5">
            <X aria-hidden className="h-4 w-4" />
            {t('life.field.photoRemove')}
          </Button>
        )}
      </div>
      {value && <p className="text-xs leading-relaxed text-muted-foreground" data-life-photo-local>{t('life.field.photoLocal')}</p>}
      <input ref={input} type="file" accept="image/*" className="hidden" data-life-photo-input
        onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}

/** A photo picked in a dialog that was then cancelled goes away again. */
const discardPhoto = (picked: string | undefined, original: string | undefined) => {
  if (picked && picked !== original) void deletePhoto(picked);
};

/** Delete asks twice: the first press turns into "really delete?". */
function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const { t } = useTranslation();
  const [sure, setSure] = useState(false);
  return (
    <Button type="button" variant="ghost" size="sm" data-life-delete
      onClick={() => (sure ? onDelete() : setSure(true))}
      className={`mr-auto gap-1.5 ${sure ? 'text-destructive' : 'text-muted-foreground'}`}>
      <Trash2 aria-hidden className="h-4 w-4" />
      {t(sure ? 'life.deleteConfirm' : 'life.delete')}
    </Button>
  );
}

export type MomentTarget = { mode: 'add'; preset: Partial<MilestoneDraft> } | { mode: 'edit'; m: Milestone };

export function MilestoneDialog({ target, pro, colors, onSave, onDelete, onClose }: {
  target: MomentTarget | null;
  pro: boolean;
  colors: Record<LifeCategory, string>;
  onSave: (draft: MilestoneDraft, id?: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const base: Partial<Milestone> | null = target ? (target.mode === 'edit' ? target.m : target.preset) : null;
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<DateParts>(partsFrom(null));
  const [end, setEnd] = useState<DateParts>(partsFrom(null));
  const [category, setCategory] = useState<Exclude<LifeCategory, 'birth'>>('other');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [where, setWhere] = useState<Milestone['placeRef']>(undefined);
  const [pinned, setPinned] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  // Fill the form each time the dialog opens on something.
  useEffect(() => {
    if (!base) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setTitle(base.title ?? '');
    setDate(partsFrom(base.date));
    setEnd(partsFrom(base.endDate));
    setCategory(base.category && base.category !== 'birth' ? base.category : 'other');
    setDescription(base.description ?? '');
    setPhoto(base.photo);
    setWhere(base.placeRef);
    setPinned(base.pinned ?? false);
    setEndOpen(!!base.endDate);
    /* eslint-enable react-hooks/set-state-in-effect */
    // A new target is what matters; `base` is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const when = dateFrom(date);
  const until = dateFrom(end);
  const endBad = !!end.y && (!until || (when !== null && sortKey(until) < sortKey(when)));
  // A date still to come is a plan by itself; nothing is marked by hand.
  const future = when !== null && sortKey(when) > todayKey();
  const valid = !!title.trim() && when !== null && !endBad;
  const original = target?.mode === 'edit' ? target.m.photo : undefined;

  const close = () => { discardPhoto(photo, original); onClose(); };
  const save = () => {
    if (!valid || !when) return;
    onSave({
      date: when, ...(until ? { endDate: until } : {}), title: title.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      category, ...(photo ? { photo } : {}), ...(pinned ? { pinned: true } : {}),
      ...(where ? { placeRef: where } : {}),
    }, target?.mode === 'edit' ? target.m.id : undefined);
  };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto" data-life-moment-dialog>
        <DialogHeader>
          <DialogTitle>{t(target?.mode === 'edit' ? 'life.edit.editTitle' : 'life.edit.addTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('life.subtitle')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t('life.field.title')}</span>
            <Input data-life-title-input value={title} maxLength={MAX_TITLE} placeholder={t('life.field.titlePh')}
              onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <LifeDateInput label={t('life.field.date')} value={date} onChange={setDate} idPrefix="life-date" />
          {/* Open or shut by the person — clearing the end year keeps it open. */}
          <details className="group" open={endOpen} onToggle={(e) => setEndOpen(e.currentTarget.open)}>
            <summary className="cursor-pointer text-sm text-muted-foreground">{t('life.field.endDate')}</summary>
            <div className="mt-2">
              <LifeDateInput label={t('life.field.endDate')} value={end} onChange={setEnd} idPrefix="life-end" />
              {endBad && <p className="mt-1 text-xs text-destructive">{t('life.field.endBad')}</p>}
            </div>
          </details>
          <fieldset className="flex flex-col gap-1.5">
            <legend className={`${fieldLabel} mb-1.5`}>{t('life.field.category')}</legend>
            <div className="flex flex-wrap gap-1.5" role="radiogroup">
              {PICKABLE_CATEGORIES.map((c) => {
                const Icon = CATEGORY_ICON[c];
                const on = c === category;
                return (
                  <button key={c} type="button" role="radio" aria-checked={on} data-life-cat={c}
                    onClick={() => setCategory(c)}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${
                      on ? 'border-primary bg-primary/10 font-medium text-foreground' : 'border-border text-muted-foreground hover:bg-accent/10'}`}>
                    <Icon aria-hidden className="h-4 w-4" style={{ color: inkOf(colors[c]) }} />
                    {t(CATEGORY_LABEL[c])}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t('life.field.description')}</span>
            <textarea data-life-desc-input value={description} maxLength={MAX_DESCRIPTION} rows={3}
              onChange={(e) => setDescription(e.target.value)} className={textarea} />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t('life.field.photo')}</span>
            <PhotoField value={photo} original={original} pro={pro} onChange={setPhoto} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t('life.field.place')}</span>
            <PlaceField value={where} onChange={setWhere} />
          </div>
          <div className="flex flex-col gap-2">
            {/* Nothing to tick: a date still to come is already a plan. */}
            {future && <p className="text-xs text-muted-foreground" data-life-plan-auto>{t('life.field.planAuto')}</p>}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" data-life-pin-input checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-4 w-4" />
              {t('life.field.pinned')}
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {target?.mode === 'edit' && <DeleteButton onDelete={() => onDelete(target.m.id)} />}
            <Button type="button" variant="outline" onClick={close}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={!valid} data-life-save className="bg-primary text-primary-foreground">{t('common.save')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type MemberTarget = { mode: 'add'; relation: Relation } | { mode: 'edit'; f: FamilyMember };

/** Adding or editing somebody else's line: a name and a birthday, no more. */
export type LineTarget = { mode: 'add' } | { mode: 'edit'; line: LifeLine };

export function LineDialog({ target, onSave, onDelete, onClose }: {
  target: LineTarget | null;
  onSave: (name: string, birthDate: string, id?: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const base = target?.mode === 'edit' ? target.line : null;
  const [name, setName] = useState('');
  const [parts, setParts] = useState<DateParts>({ y: '', m: '', d: '' });
  // Fill the form each time the dialog opens on somebody.
  useEffect(() => {
    if (!target) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(base?.name ?? '');
    setParts(partsFrom(base?.birthDate ?? ''));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [target, base]);

  const birth = dateFrom(parts);
  // A line is drawn from a day, not from a year: without the whole date there
  // is nowhere to start it, so the form waits for one.
  const valid = !!name.trim() && isFullDate(birth ?? '');
  return (
    <Dialog open={target !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm" data-life-line-dialog>
        <DialogHeader>
          <DialogTitle>{t('life.parallel.add')}</DialogTitle>
          <DialogDescription className="sr-only">{t('life.parallel.none')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault();
          if (!valid || !birth) return;
          onSave(name.trim().slice(0, MAX_NAME), birth, base?.id);
        }}>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">{t('life.parallel.name')}</span>
            <Input autoFocus data-life-line-name value={name} maxLength={MAX_NAME}
              onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">{t('life.parallel.birth')}</span>
            <LifeDateInput label={t('life.parallel.birth')} value={parts} onChange={setParts} idPrefix="life-line-birth" />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {base && (
              <Button type="button" variant="ghost" className="mr-auto text-destructive"
                data-life-line-delete onClick={() => onDelete(base.id)}>
                {t('life.parallel.remove')}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={!valid} data-life-line-save
              className="bg-primary text-primary-foreground">
              {t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FamilyDialog({ target, pro, onSave, onDelete, onClose }: {
  target: MemberTarget | null;
  pro: boolean;
  onSave: (draft: MemberDraft, id: string | undefined) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [birth, setBirth] = useState<DateParts>(partsFrom(null));
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  useEffect(() => {
    if (!target) return;
    const f = target.mode === 'edit' ? target.f : null;
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(f?.name ?? '');
    setBirth(partsFrom(f?.birthDate));
    setNote(f?.note ?? '');
    setPhoto(f?.photo);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [target]);

  // The place opened decides who this is: the mother's or the father's.
  const relation: Relation = target ? (target.mode === 'edit' ? target.f.relation : target.relation) : 'mother';
  const born = dateFrom(birth);
  const birthBad = !!birth.y && !born;
  const valid = !!name.trim() && !birthBad;
  const original = target?.mode === 'edit' ? target.f.photo : undefined;
  const close = () => { discardPhoto(photo, original); onClose(); };
  const save = () => {
    if (!valid) return;
    onSave(
      { relation, name: name.trim(), ...(born ? { birthDate: born } : {}), ...(note.trim() ? { note: note.trim() } : {}), ...(photo ? { photo } : {}) },
      target?.mode === 'edit' ? target.f.id : undefined,
    );
  };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto" data-life-family-dialog>
        <DialogHeader>
          <DialogTitle>{t(RELATION_LABEL[relation])}</DialogTitle>
          <DialogDescription className="sr-only">{t('life.roots')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t('life.field.name')}</span>
            <Input data-life-name-input value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} required />
          </label>
          <LifeDateInput label={t('life.field.birth')} value={birth} onChange={setBirth} idPrefix="life-fam-birth" />
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t('life.field.note')}</span>
            <textarea value={note} maxLength={MAX_NOTE} rows={2} onChange={(e) => setNote(e.target.value)} className={textarea} />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t('life.field.photo')}</span>
            <PhotoField value={photo} original={original} pro={pro} onChange={setPhoto} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {target?.mode === 'edit' && <DeleteButton onDelete={() => onDelete(target.f.id)} />}
            <Button type="button" variant="outline" onClick={close}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={!valid} data-life-save className="bg-primary text-primary-foreground">{t('common.save')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The birth card opens this: name, birthday, and the expected life span. */
export function ProfileDialog({ open, profile, onSave, onClose }: {
  open: boolean;
  profile: LifeProfile;
  onSave: (p: LifeProfile) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(profile.name ?? '');
    setBirth(profile.birthDate);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, profile]);
  // The line runs the same distance past today for everyone: there is nothing
  // here to set, and no one is asked how long they expect to live.
  const valid = isFullDate(birth);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm" data-life-profile-dialog>
        <DialogHeader>
          <DialogTitle>{t('life.profile.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('life.subtitle')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSave({ ...(name.trim() ? { name: name.trim() } : {}), birthDate: birth });
        }}>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t('life.onboard.name')}</span>
            <Input value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t('life.field.myBirth')}</span>
            <Input type="date" data-life-birth-input value={birth} min="1900-01-01" max={todayKey()} onChange={(e) => setBirth(e.target.value)} required />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={!valid} className="bg-primary text-primary-foreground">{t('common.save')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
