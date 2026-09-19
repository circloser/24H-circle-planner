import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Lock, ShieldCheck, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/usePreferences';
import { requestUpgrade } from '@/lib/pro';
import { deletePhoto, newPhotoId, savePhoto, shrinkPhoto } from '@/lib/calendar-photos';
import {
  DEFAULT_LIFE_EXPECTANCY, MAX_DESCRIPTION, MAX_NAME, MAX_NOTE, MAX_TITLE, PICKABLE_CATEGORIES, RELATIONS,
  dateFrom, isFullDate, partsFrom, sortKey, type DateParts, type FamilyMember, type LifeCategory, type LifeProfile, type Milestone, type Relation,
} from '@/lib/life';
import { todayKey } from '@/lib/calendar-grid';
import type { MemberDraft, MilestoneDraft } from '@/hooks/useLife';
import { CATEGORY_ICON, CATEGORY_LABEL, RELATION_LABEL, inkOf } from './categories';
import { LifeDateInput } from './LifeDateInput';
import { LifePhoto } from './LifeTimeline';

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
  const replace = (next: string | undefined) => {
    if (value && value !== original) void deletePhoto(value);
    onChange(next);
  };
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const url = await shrinkPhoto(file, PHOTO_EDGE);
    const id = newPhotoId();
    if (url && (await savePhoto(id, url))) replace(id);
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
  const [isPlan, setIsPlan] = useState(false);
  const [pinned, setPinned] = useState(false);
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
    setIsPlan(base.isPlan ?? false);
    setPinned(base.pinned ?? false);
    /* eslint-enable react-hooks/set-state-in-effect */
    // A new target is what matters; `base` is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const when = dateFrom(date);
  const until = dateFrom(end);
  const endBad = !!end.y && (!until || (when !== null && sortKey(until) < sortKey(when)));
  const future = when !== null && sortKey(when) > todayKey();
  const valid = !!title.trim() && when !== null && !endBad;
  const original = target?.mode === 'edit' ? target.m.photo : undefined;

  const close = () => { discardPhoto(photo, original); onClose(); };
  const save = () => {
    if (!valid || !when) return;
    onSave({
      date: when, ...(until ? { endDate: until } : {}), title: title.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      // Only the person's own choice is stored: a future date is a plan anyway,
      // and turns into a record by itself once the day has passed.
      category, ...(photo ? { photo } : {}), isPlan, ...(pinned ? { pinned: true } : {}),
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
          <details className="group" open={!!end.y || undefined}>
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
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" data-life-plan-input checked={isPlan || future} disabled={future}
                onChange={(e) => setIsPlan(e.target.checked)} className="h-4 w-4" />
              {t('life.field.isPlan')}
            </label>
            {future && <p className="-mt-1 pl-6 text-xs text-muted-foreground">{t('life.field.planAuto')}</p>}
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

export function FamilyDialog({ target, pro, onSave, onDelete, onClose }: {
  target: MemberTarget | null;
  pro: boolean;
  /** `moment`: also put it on the line (a wedding, a child's birth). */
  onSave: (draft: MemberDraft, id: string | undefined, moment: { date: string } | null) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [relation, setRelation] = useState<Relation>('mother');
  const [name, setName] = useState('');
  const [birth, setBirth] = useState<DateParts>(partsFrom(null));
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [asMoment, setAsMoment] = useState(false);
  const [momentDate, setMomentDate] = useState<DateParts>(partsFrom(null));
  useEffect(() => {
    if (!target) return;
    const f = target.mode === 'edit' ? target.f : null;
    /* eslint-disable react-hooks/set-state-in-effect */
    setRelation(f ? f.relation : target.mode === 'add' ? target.relation : 'other');
    setName(f?.name ?? '');
    setBirth(partsFrom(f?.birthDate));
    setNote(f?.note ?? '');
    setPhoto(f?.photo);
    setAsMoment(false);
    setMomentDate(partsFrom(null));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [target]);

  const born = dateFrom(birth);
  const birthBad = !!birth.y && !born;
  // A spouse or a child belongs on the line too: the wedding, the birth.
  const offerMoment = target?.mode === 'add' && (relation === 'spouse' || relation === 'child');
  const momentAt = dateFrom(momentDate) ?? (relation === 'child' ? born : null);
  const valid = !!name.trim() && !birthBad && (!offerMoment || !asMoment || momentAt !== null);
  const original = target?.mode === 'edit' ? target.f.photo : undefined;
  const close = () => { discardPhoto(photo, original); onClose(); };
  const save = () => {
    if (!valid) return;
    onSave(
      { relation, name: name.trim(), ...(born ? { birthDate: born } : {}), ...(note.trim() ? { note: note.trim() } : {}), ...(photo ? { photo } : {}) },
      target?.mode === 'edit' ? target.f.id : undefined,
      offerMoment && asMoment && momentAt ? { date: momentAt } : null,
    );
  };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto" data-life-family-dialog>
        <DialogHeader>
          <DialogTitle>{t(target?.mode === 'edit' ? 'life.family.editTitle' : 'life.family.addTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('life.roots')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t('life.field.relation')}</span>
            <select data-life-relation value={relation} onChange={(e) => setRelation(e.target.value as Relation)}
              className="h-10 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {RELATIONS.map((r) => <option key={r} value={r}>{t(RELATION_LABEL[r])}</option>)}
            </select>
          </label>
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
          {offerMoment && (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" data-life-also-moment checked={asMoment} onChange={(e) => setAsMoment(e.target.checked)} className="h-4 w-4" />
                {t('life.family.alsoMoment')}
              </label>
              {asMoment && (
                <LifeDateInput label={t(relation === 'spouse' ? 'life.family.weddingDate' : 'life.family.momentDate')}
                  value={momentDate.y ? momentDate : partsFrom(momentAt)} onChange={setMomentDate} idPrefix="life-fam-moment" />
              )}
            </div>
          )}
          <p className="flex gap-2 rounded-lg border border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground" data-life-family-privacy>
            <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            {t('life.family.privacy')}
          </p>
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
  const [years, setYears] = useState('');
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(profile.name ?? '');
    setBirth(profile.birthDate);
    setYears(String(profile.lifeExpectancy ?? DEFAULT_LIFE_EXPECTANCY));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, profile]);
  const span = Number(years);
  const valid = isFullDate(birth) && Number.isInteger(span) && span >= 1 && span <= 130;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm" data-life-profile-dialog>
        <DialogHeader>
          <DialogTitle>{t('life.profile.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('life.subtitle')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSave({ ...(name.trim() ? { name: name.trim() } : {}), birthDate: birth, ...(span !== DEFAULT_LIFE_EXPECTANCY ? { lifeExpectancy: span } : {}) });
        }}>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t('life.onboard.name')}</span>
            <Input value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t('life.field.myBirth')}</span>
            <Input type="date" data-life-birth-input value={birth} min="1900-01-01" max={todayKey()} onChange={(e) => setBirth(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t('life.field.expectancy')}</span>
            <Input type="number" inputMode="numeric" min={1} max={130} value={years} onChange={(e) => setYears(e.target.value)} className="w-28" />
            <span className="text-xs text-muted-foreground">{t('life.field.expectancyHint')}</span>
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
