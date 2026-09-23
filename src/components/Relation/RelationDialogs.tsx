import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Lock, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/usePreferences';
import { requestUpgrade } from '@/lib/pro';
import { deletePhoto, newPhotoId, savePhoto, shrinkPhoto } from '@/lib/calendar-photos';
import { todayKey } from '@/lib/calendar-grid';
import {
  MAX_PERSON_NAME, MAX_PERSON_NOTE, MAX_RELATION_TEXT, MAX_SUB, RELATION_GROUPS, isBirthday,
  CLOSENESS, type Closeness, type Person, type RelationGroup,
} from '@/lib/relation';
import type { PersonDraft } from '@/hooks/useRelation';
import { GROUP_ICON, GROUP_LABEL } from './groups';

const field = 'text-sm font-medium text-foreground';
const area = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
/** Longest edge kept for a face. */
const PHOTO_EDGE = 480;

export type PersonTarget =
  | { mode: 'add'; at?: Person['at'] }
  | { mode: 'edit'; p: Person };

/** A picture (Pro). Stored on this device the moment it is picked; one that is
 *  dropped again, or left behind by a cancelled dialog, is deleted. */
export function PhotoField({ value, original, pro, own = false, onChange }: {
  value: string | undefined;
  original: string | undefined;
  pro: boolean;
  /** A photo of oneself, which needs nobody's consent but one's own. */
  own?: boolean;
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
      <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" data-relation-photo-pro
        onClick={() => requestUpgrade('relation')}>
        <Lock aria-hidden className="h-4 w-4" />
        {t('relation.field.photo')}
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input ref={input} type="file" accept="image/*" className="sr-only" data-relation-photo-input
        onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={busy}
        onClick={() => input.current?.click()}>
        <ImagePlus aria-hidden className="h-4 w-4" />
        {t('relation.field.photo')}
      </Button>
      {value && (
        <Button type="button" variant="ghost" size="sm" className="gap-1.5"
          onClick={() => { if (value !== original) void deletePhoto(value); onChange(undefined); }}>
          <X aria-hidden className="h-4 w-4" />
          {t('common.remove')}
        </Button>
      )}
      {!own && <p className="text-xs text-muted-foreground">{t('relation.privacy.photo')}</p>}
    </div>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <Button type="button" variant="ghost" size="sm" className="mr-auto gap-1.5 text-destructive" data-relation-delete
      onClick={onDelete}>
      <Trash2 aria-hidden className="h-4 w-4" />
      {t('common.delete')}
    </Button>
  );
}

/** Add or edit one person. */
export function PersonDialog({ target, pro, syncing, subgroups = [], onClose, onSave, onDelete }: {
  target: PersonTarget | null;
  pro: boolean;
  syncing: boolean;
  /** The groups inside the groups that already exist, offered as a tap. */
  subgroups?: readonly { group: RelationGroup; sub: string; n: number }[];
  onClose: () => void;
  onSave: (draft: PersonDraft, id?: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const base = target?.mode === 'edit' ? target.p : null;
  const [name, setName] = useState('');
  const [group, setGroup] = useState<RelationGroup>('friend');
  const [relation, setRelation] = useState('');
  const [sub, setSub] = useState('');
  const [closeness, setCloseness] = useState<Closeness>(3);
  const [birthday, setBirthday] = useState('');
  const [lastContact, setLastContact] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!target) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(base?.name ?? '');
    setGroup(base?.group ?? 'friend');
    setRelation(base?.relation ?? '');
    setSub(base?.sub ?? '');
    setCloseness(base?.closeness ?? 3);
    setBirthday(base?.birthday ?? '');
    setLastContact(base?.lastContact ?? '');
    setNote(base?.note ?? '');
    setPhoto(base?.photo);
    setPinned(base?.pinned ?? false);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const original = base?.photo;
  const birthdayOk = !birthday || isBirthday(birthday);
  const valid = !!name.trim() && birthdayOk;
  const close = () => {
    if (photo && photo !== original) void deletePhoto(photo);
    onClose();
  };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto" data-relation-person-dialog>
        <DialogHeader>
          <DialogTitle>{t(base ? 'relation.edit.editTitle' : 'relation.edit.addTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('relation.subtitle')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onSave({
            name: name.trim(),
            group,
            ...(relation.trim() ? { relation: relation.trim() } : {}),
            ...(sub.trim() ? { sub: sub.trim() } : {}),
            closeness,
            ...(birthday && isBirthday(birthday) ? { birthday } : {}),
            ...(lastContact ? { lastContact } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
            ...(photo ? { photo } : {}),
            ...(pinned ? { pinned: true } : {}),
            ...(base?.at ? { at: base.at } : {}),
            ...(base?.lifeFamilyId ? { lifeFamilyId: base.lifeFamilyId } : {}),
          }, base?.id);
        }}>
          <label className="flex flex-col gap-1.5">
            <span className={field}>{t('relation.field.name')}</span>
            <Input data-relation-name-input value={name} maxLength={MAX_PERSON_NAME} required
              onChange={(e) => setName(e.target.value)} />
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className={field}>{t('relation.field.group')}</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {RELATION_GROUPS.map((g) => {
                const Icon = GROUP_ICON[g];
                const on = group === g;
                return (
                  <button key={g} type="button" data-relation-group={g} aria-pressed={on}
                    onClick={() => setGroup(g)}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm ${
                      on ? 'border-foreground bg-accent/20 text-foreground' : 'border-border text-muted-foreground'}`}>
                    <Icon aria-hidden className="h-3.5 w-3.5" />
                    {t(GROUP_LABEL[g])}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* A group inside the group: the ones already made in this group are
              a tap away, so "대학 동기" is not typed a second time as "대학동기". */}
          <div className="flex flex-col gap-1.5">
            <label className="flex flex-col gap-1.5">
              <span className={field}>{t('relation.field.sub')}</span>
              <Input data-relation-sub-input value={sub} maxLength={MAX_SUB}
                placeholder={t('relation.field.subHint')} onChange={(e) => setSub(e.target.value)} />
            </label>
            {subgroups.some((s) => s.group === group && s.sub !== sub.trim()) && (
              <div className="flex flex-wrap gap-1">
                {subgroups.filter((s) => s.group === group && s.sub !== sub.trim()).map((s) => (
                  <button key={s.sub} type="button" data-relation-sub-pick={s.sub}
                    className="min-h-8 rounded-full border border-border px-2.5 text-[13px] text-muted-foreground hover:bg-accent/20"
                    onClick={() => setSub(s.sub)}>
                    {s.sub}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={field}>{t('relation.field.relation')}</span>
            <Input data-relation-rel-input value={relation} maxLength={MAX_RELATION_TEXT}
              placeholder={t('relation.field.relationHint')} onChange={(e) => setRelation(e.target.value)} />
          </label>

          {/* Five rungs. The words are too long to print five times across a
              phone, so the rungs are dots and the chosen one says itself. */}
          <fieldset className="flex flex-col gap-1.5">
            <legend className={`${field} flex items-baseline justify-between gap-2`}>
              <span>{t('relation.field.closeness')}</span>
              <span className="text-[13px] font-normal text-muted-foreground" data-relation-close-label>
                {t(`relation.close.${closeness}` as 'relation.close.1')}
              </span>
            </legend>
            <div className="mt-1.5 flex gap-1.5">
              {CLOSENESS.map((c) => (
                <button key={c} type="button" data-relation-close={c} aria-pressed={closeness === c}
                  aria-label={t(`relation.close.${c}` as 'relation.close.1')}
                  title={t(`relation.close.${c}` as 'relation.close.1')}
                  onClick={() => setCloseness(c)}
                  className={`grid min-h-9 flex-1 place-items-center rounded-md border ${
                    closeness === c ? 'border-foreground bg-accent/20' : 'border-border'}`}>
                  <span aria-hidden className={`block rounded-full ${
                    closeness === c ? 'bg-foreground' : 'bg-muted-foreground/50'}`}
                    style={{ width: 4 + c * 2, height: 4 + c * 2 }} />
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={field}>{t('relation.field.birthday')}</span>
              <Input type="date" data-relation-birthday-input value={birthday.length === 5 ? '' : birthday}
                max="2200-12-31" onChange={(e) => setBirthday(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={field}>{t('relation.field.lastContact')}</span>
              <Input type="date" data-relation-contact-input value={lastContact} max={todayKey()}
                onChange={(e) => setLastContact(e.target.value)} />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={field}>{t('relation.field.note')}</span>
            <textarea data-relation-note-input value={note} maxLength={MAX_PERSON_NOTE} rows={2}
              onChange={(e) => setNote(e.target.value)} className={area} />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className={field}>{t('relation.field.photo')}</span>
            <PhotoField value={photo} original={original} pro={pro} onChange={setPhoto} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" data-relation-pin-input checked={pinned} className="h-4 w-4"
              onChange={(e) => setPinned(e.target.checked)} />
            {t('relation.field.pinned')}
          </label>

          {/* Where the record goes is said in the privacy policy and in the
              guide; on the form itself it was one more thing to read past
              every time someone is added. */}
          {syncing && (
            <p className="text-[12px] leading-relaxed text-muted-foreground" data-relation-privacy>
              {t('relation.privacy.sync')}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {base && <DeleteButton onDelete={() => onDelete(base.id)} />}
            <Button type="button" variant="outline" onClick={close}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={!valid} data-relation-save className="bg-primary text-primary-foreground">
              {t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
