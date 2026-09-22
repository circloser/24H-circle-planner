import { useState } from 'react';
import { Cake, Check, Link2, Link2Off, Pencil, Pin, Trash2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/usePreferences';
import {
  CLOSENESS, MAX_LINK_LABEL, daysSinceContact, daysToBirthday, turningAge,
  type Closeness, type Person, type RelationData, type RelationGroup, type RelationLink,
} from '@/lib/relation';
import { placesWith } from '@/lib/relation-place';
import { GROUP_ICON, GROUP_LABEL } from './groups';

/** One line drawn to another person, and what to call it.
 *
 *  The name of a tie — "부부", "동료" — is written where the tie is, rather
 *  than asked for in a dialog at the moment the line is drawn: most lines do
 *  not need a name, and the ones that do can be named later. */
function LinkRow({ link, other, onPick, onUnlink, onLabel, onHold }: {
  link: RelationLink;
  other: Person;
  onPick: (id: string) => void;
  onUnlink: (id: string) => void;
  onLabel: (id: string, label: string) => void;
  /** How close those two are to EACH OTHER, which is what pulls them
   *  together on the map. */
  onHold: (id: string, closeness: Closeness) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(link.label ?? '');
  const commit = () => {
    setEditing(false);
    if (draft.trim() !== (link.label ?? '')) onLabel(other.id, draft.trim());
  };
  return (
    <li className="flex items-center gap-1.5 text-sm">
      <button type="button" data-relation-linked={other.id}
        className="min-h-8 shrink-0 truncate text-left text-foreground underline decoration-dotted underline-offset-4"
        onClick={() => onPick(other.id)}>
        {other.name}
      </button>
      {editing ? (
        <Input autoFocus value={draft} maxLength={MAX_LINK_LABEL} data-relation-link-label={other.id}
          className="h-8 min-w-0 flex-1" placeholder={t('relation.link.labelHint')}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
      ) : (
        <button type="button" data-relation-link-edit={other.id}
          className="min-h-8 flex-1 truncate text-left text-[13px] text-muted-foreground"
          onClick={() => { setDraft(link.label ?? ''); setEditing(true); }}>
          {link.label || t('relation.link.name')}
        </button>
      )}
      {/* How close the two of THEM are: five rungs, drawn as the map draws
          them — a heavier line for a closer tie. */}
      <span className="flex shrink-0 items-center gap-0.5" role="group"
        aria-label={t('relation.link.close')} data-relation-link-close={other.id}>
        {CLOSENESS.map((rung) => {
          const held = (link.closeness ?? 3) >= rung;
          return (
            <button key={rung} type="button" data-relation-link-rung={`${other.id}:${rung}`}
              aria-label={`${t('relation.link.close')} ${rung}`} aria-pressed={held}
              className="grid h-7 w-3 place-items-center"
              onClick={() => onHold(other.id, rung)}>
              <span aria-hidden className={`block h-2 w-2 rounded-full ${
                held ? 'bg-foreground' : 'bg-foreground/20'}`} />
            </button>
          );
        })}
      </span>
      <button type="button" aria-label={t('relation.link.remove')} data-relation-unlink={other.id}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent/20"
        onClick={() => onUnlink(other.id)}>
        <Link2Off aria-hidden className="h-4 w-4" />
      </button>
    </li>
  );
}

/**
 * Who is selected, and everything that can be done with them.
 *
 * One component for both shapes: a column on the right of a wide screen, a
 * sheet across the bottom of a narrow one. The words and the buttons are the
 * same either way.
 */
export function RelationPanel({
  person, data, colors, today, linking, onClose, onEdit, onDelete, onContacted, onStartLink, onUnlink,
  onPick, onLabel, onHold, onAddBeside,
}: {
  person: Person | null;
  data: RelationData;
  colors: Record<RelationGroup, string>;
  today: string;
  /** This person is waiting for the next tap to draw a line to. */
  linking: boolean;
  onClose: () => void;
  onEdit: () => void;
  /** Take them off the map. It can be taken back (the undo on the toast). */
  onDelete: () => void;
  onContacted: () => void;
  onStartLink: () => void;
  onUnlink: (otherId: string) => void;
  onPick: (id: string) => void;
  /** Name the tie to that person (an empty name takes it away). */
  onLabel: (otherId: string, label: string) => void;
  /** Say how close those two are to each other. */
  onHold: (otherId: string, closeness: Closeness) => void;
  /** Somebody new, already tied to this person: a friend of a friend is how
   *  most maps of people actually grow. */
  onAddBeside: () => void;
}) {
  const { t } = useTranslation();
  if (!person) return null;

  const silent = daysSinceContact(person, today);
  const toBirthday = daysToBirthday(person, today);
  const turns = turningAge(person, today);
  const Icon = GROUP_ICON[person.group];
  // Places on the place map that name this person (lib/relation-place).
  const together = placesWith(person.id);
  const linked = data.links
    .filter((l) => l.source === person.id || l.target === person.id)
    .map((l) => ({ link: l, other: data.people.find((p) => p.id === (l.source === person.id ? l.target : l.source)) }))
    .filter((x): x is { link: typeof x.link; other: Person } => !!x.other);

  return (
    <aside data-relation-panel data-person={person.id}
      className="flex w-full flex-col gap-4 border-t border-border bg-surface p-4 min-[900px]:w-[360px] min-[900px]:border-l min-[900px]:border-t-0">
      <header className="flex items-start gap-3">
        <span aria-hidden className="mt-1 h-3 w-3 shrink-0 rounded-full border-2"
          style={{ borderColor: colors[person.group] }} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-foreground" data-relation-panel-name>{person.name}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Icon aria-hidden className="h-3.5 w-3.5" />
              {t(GROUP_LABEL[person.group])}
            </span>
            {person.relation && <span className="truncate">{person.relation}</span>}
            {person.pinned && <Pin aria-hidden className="h-3.5 w-3.5" />}
          </p>
        </div>
        <button type="button" aria-label={t('common.close')} data-relation-panel-close
          className="-m-1 grid h-9 w-9 shrink-0 place-items-center rounded-md hover:bg-accent/20" onClick={onClose}>
          <X aria-hidden className="h-4 w-4" />
        </button>
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        {toBirthday !== null && (
          <>
            <dt className="text-muted-foreground">{t('relation.field.birthday')}</dt>
            <dd className="text-foreground" data-relation-panel-birthday>
              {toBirthday === 0
                ? t('relation.birthdayToday')
                : t('relation.birthdayIn', { n: String(toBirthday) })}
              {turns !== null ? ` · ${t('relation.turning', { n: String(turns) })}` : ''}
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">{t('relation.field.lastContact')}</dt>
        <dd className="text-foreground" data-relation-panel-contact>
          {silent === null
            ? t('relation.neverRecorded')
            : silent === 0 ? t('relation.contactedToday') : t('relation.daysSince', { n: String(silent) })}
        </dd>
      </dl>

      {person.note && <p className="whitespace-pre-wrap text-sm text-foreground">{person.note}</p>}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5" data-relation-contacted onClick={onContacted}>
          <Check aria-hidden className="h-4 w-4" />
          {t('relation.contactedToday')}
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" data-relation-edit onClick={onEdit}>
          <Pencil aria-hidden className="h-4 w-4" />
          {t('common.edit')}
        </Button>
        <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" data-relation-remove
          onClick={onDelete}>
          <Trash2 aria-hidden className="h-4 w-4" />
          {t('common.delete')}
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" data-relation-add-beside
          onClick={onAddBeside}>
          <UserPlus aria-hidden className="h-4 w-4" />
          {t('relation.link.addBeside')}
        </Button>
        <Button size="sm" variant={linking ? 'default' : 'outline'} className="gap-1.5" data-relation-link
          aria-pressed={linking} onClick={onStartLink}>
          <Link2 aria-hidden className="h-4 w-4" />
          {t(linking ? 'relation.link.pick' : 'relation.link.add')}
        </Button>
      </div>

      {linked.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label={t('relation.link.add')}>
          {linked.map(({ link, other }) => (
            <LinkRow key={other.id} link={link} other={other} onPick={onPick} onUnlink={onUnlink}
              onLabel={onLabel} onHold={onHold} />
          ))}
        </ul>
      )}

      {together.length > 0 && (
        <p className="text-[13px] text-muted-foreground" data-relation-places>
          {t('relation.placesWith', { n: String(together.length) })} · {together.slice(0, 4).join(', ')}
        </p>
      )}

      {toBirthday !== null && toBirthday <= 30 && (
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Cake aria-hidden className="h-4 w-4" />
          {t('relation.birthdaySoon')}
        </p>
      )}
    </aside>
  );
}
