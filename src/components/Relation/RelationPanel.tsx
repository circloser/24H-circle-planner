import { useState } from 'react';
import { Cake, ChevronRight, Link2, Link2Off, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/usePreferences';
import { todayKey } from '@/lib/calendar-grid';
import {
  CLOSENESS, FACT_KINDS, MAX_FACT_TEXT, MAX_LINK_LABEL, MAX_MEET_NOTE, MAX_PERSON_NAME, MAX_PERSON_NOTE,
  MAX_RELATION_TEXT, MAX_SUB, MEET_KINDS, RELATION_GROUPS, daysSinceContact, daysToBirthday, factHistory,
  isBirthday, meetHistory, turningAge,
  type Closeness, type FactKind, type MeetKind, type Person, type PersonFact, type PersonMeet,
  type RelationData, type RelationGroup, type RelationLink,
} from '@/lib/relation';
import type { PersonDraft } from '@/hooks/useRelation';
import { placesWith } from '@/lib/relation-place';
import { momentsWith } from '@/lib/relation-life';
import { GROUP_ICON, GROUP_LABEL } from './groups';
import { FACT_ICON, FACT_LABEL, MEET_ICON, MEET_LABEL } from './kinds';

/** '2024', '2024-03' and '2024-03-05' read as themselves; anything else is not
 *  a date yet, and is simply not saved with the fact. */
const isWhenDraft = (v: string): boolean => /^\d{4}(-\d{2}(-\d{2})?)?$/.test(v);

const quiet = 'text-[12px] text-muted-foreground';
const bare = 'h-8 border-transparent bg-transparent px-1.5 shadow-none hover:border-border focus-visible:border-input';

/**
 * A field that is its own value until it is pressed, and saved when it is
 * left (or on Enter). The card has no edit mode: what is shown is what can be
 * changed, where it is.
 */
function InlineText({ value, onCommit, placeholder, maxLength, data, className = '', area = false }: {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  maxLength: number;
  data: string;
  className?: string;
  area?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [was, setWas] = useState(value);
  // Changed from elsewhere (an undo, a sync): the field follows.
  if (value !== was) { setWas(value); setDraft(value); }
  const commit = () => { if (draft.trim() !== value.trim()) onCommit(draft.trim()); };
  const props = {
    value: draft,
    maxLength,
    placeholder,
    [`data-${data}`]: '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
  };
  return area ? (
    <textarea {...props} rows={2}
      className={`w-full resize-none rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-border focus-visible:border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`} />
  ) : (
    <Input {...props} className={`${bare} ${className}`}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />
  );
}

/**
 * One kind of thing known about somebody — a number, a town, a job.
 *
 * What is true now is shown; typing a new one and pressing Enter writes it on
 * top, and the one it replaces stays underneath, struck through, with the ones
 * before it. Nothing is ever overwritten.
 */
function FactRow({ person, kind, onAdd, onRemove }: {
  person: Person;
  kind: FactKind;
  onAdd: (fact: PersonFact) => void;
  onRemove: (fact: PersonFact) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [when, setWhen] = useState('');
  const [open, setOpen] = useState(false);
  const history = factHistory(person, kind);
  const now = history[0];
  const Icon = FACT_ICON[kind];
  const add = () => {
    if (!value.trim() || (when && !isWhenDraft(when))) return;
    onAdd({ k: kind, v: value.trim(), ...(when ? { at: when } : {}) });
    setValue('');
    setWhen('');
  };
  return (
    <li className="flex flex-col" data-relation-fact-kind={kind}>
      <div className="flex items-center gap-1.5">
        <span className="flex w-[72px] shrink-0 items-center gap-1 text-[12px] text-muted-foreground">
          <Icon aria-hidden className="h-3.5 w-3.5" />
          {t(FACT_LABEL[kind])}
        </span>
        <Input value={value} maxLength={MAX_FACT_TEXT} data-relation-fact-input={kind}
          placeholder={now?.v ?? '—'} className={`${bare} min-w-0 flex-1 placeholder:text-foreground`}
          data-relation-panel-fact={now ? kind : undefined}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        {value.trim() && (
          <>
            <Input value={when} maxLength={10} inputMode="numeric" data-relation-fact-when={kind}
              placeholder={t('relation.fact.whenHint')} className="h-8 w-[84px] shrink-0 px-1.5 text-[12px] tabular-nums"
              onChange={(e) => setWhen(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
            <button type="button" aria-label={t('relation.fact.add')} data-relation-fact-add={kind}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"
              onClick={add}>
              <Plus aria-hidden className="h-4 w-4" />
            </button>
          </>
        )}
        {!value.trim() && now?.at && <span className={`${quiet} shrink-0 tabular-nums`}>{now.at}</span>}
        {!value.trim() && history.length > 1 && (
          <button type="button" data-relation-fact-past={kind} aria-expanded={open}
            className={`${quiet} shrink-0 rounded px-1 hover:bg-accent/20`}
            onClick={() => setOpen((o) => !o)}>
            {t('relation.fact.before', { n: String(history.length - 1) })}
          </button>
        )}
      </div>
      {open && (
        <ul className="ml-[78px] flex flex-col" data-relation-fact-history={kind}>
          {history.map((fact, i) => (
            <li key={`${fact.v}-${fact.at ?? ''}-${i}`} className="flex items-center gap-1.5 text-[12px]"
              data-relation-fact={kind}>
              <span className={`min-w-0 flex-1 truncate ${i === 0 ? 'text-foreground' : 'text-muted-foreground line-through decoration-foreground/30'}`}>
                {fact.v}
              </span>
              {fact.at && <span className="shrink-0 tabular-nums text-muted-foreground">{fact.at}</span>}
              <button type="button" aria-label={t('common.delete')} data-relation-fact-remove={`${kind}:${i}`}
                className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent/20"
                onClick={() => onRemove(fact)}>
                <X aria-hidden className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

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
 * The record of contact: one row to write in, and everything written so far
 * underneath it — the newest right under the row, the oldest at the bottom.
 */
function MeetLog({ person, onAdd, onRemove }: {
  person: Person;
  onAdd: (meet: PersonMeet) => void;
  onRemove: (meet: PersonMeet) => void;
}) {
  const { t } = useTranslation();
  const today = todayKey();
  const [kind, setKind] = useState<MeetKind>('talk');
  const [day, setDay] = useState('');
  const [note, setNote] = useState('');
  const log = meetHistory(person);
  const add = () => {
    onAdd({ at: day || today, k: kind, ...(note.trim() ? { v: note.trim() } : {}) });
    setNote('');
    setDay('');
  };
  return (
    <section className="flex flex-col gap-1.5" data-relation-log>
      <div className="flex flex-wrap items-center gap-1">
        {MEET_KINDS.map((k) => {
          const Icon = MEET_ICON[k];
          const on = kind === k;
          return (
            <button key={k} type="button" data-relation-meet-kind={k} aria-pressed={on}
              onClick={() => setKind(k)}
              className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-[12px] ${
                on ? 'border-foreground bg-accent/20 text-foreground' : 'border-border text-muted-foreground'}`}>
              <Icon aria-hidden className="h-3.5 w-3.5" />
              {t(MEET_LABEL[k])}
            </button>
          );
        })}
        <Input type="date" value={day || today} max={today} data-relation-meet-date
          className="h-8 w-[132px] px-1.5 text-[12px]" onChange={(e) => setDay(e.target.value)} />
      </div>
      <div className="flex items-center gap-1.5">
        <Input value={note} maxLength={MAX_MEET_NOTE} data-relation-meet-note
          className="h-8 min-w-0 flex-1 text-[13px]" placeholder={t('relation.meet.note')}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <Button type="button" size="sm" className="h-8 shrink-0 gap-1" data-relation-meet-add onClick={add}>
          <Plus aria-hidden className="h-4 w-4" />
          {t('relation.meet.add')}
        </Button>
      </div>
      {log.length > 0 && (
        <ul className="flex flex-col" data-relation-meet-list>
          {log.map((meet, i) => {
            const Icon = MEET_ICON[meet.k];
            return (
              <li key={`${meet.at}-${meet.k}-${i}`} className="flex items-center gap-1.5 border-t border-border/60 py-1 text-[13px]"
                data-relation-meet-row={meet.at}>
                <span className="shrink-0 tabular-nums text-muted-foreground">{meet.at}</span>
                <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="shrink-0 text-foreground">{t(MEET_LABEL[meet.k])}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{meet.v}</span>
                <button type="button" aria-label={t('common.delete')} data-relation-meet-remove={i}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent/20"
                  onClick={() => onRemove(meet)}>
                  <X aria-hidden className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * A part of the card that stays closed until it is wanted: the heading is a
 * button, and what it holds is only drawn once it is opened.
 */
function Fold({ id, title, hint, open, onToggle, children }: {
  id: string;
  title: string;
  /** A little of what is inside, so a closed fold still says something. */
  hint?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5" data-relation-fold={id} data-open={open || undefined}>
      <button type="button" aria-expanded={open} data-relation-fold-toggle={id} onClick={onToggle}
        className="-mx-1 flex min-h-8 items-center gap-1.5 rounded-md px-1 text-left text-[12px] font-semibold text-muted-foreground hover:bg-accent/20">
        <ChevronRight aria-hidden className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="flex-1">{title}</span>
        {hint && <span className="truncate font-normal">{hint}</span>}
      </button>
      {open && children}
    </section>
  );
}

/**
 * Who is selected, and everything about them — changed where it is shown.
 *
 * There is no edit mode. The name, the group, the rung of closeness, the
 * birthday and the note are fields, saved as each is left. What changes over
 * time — a number, a home, a job, every meeting — is written in its own row
 * and kept, newest first. On a wide screen it is a card over the map, as
 * tall as it has to be and no taller; on a narrow one, a sheet under it.
 *
 * Only who they are and how close sits open. The details and the record of
 * meetings are folded away until asked for, so tapping somebody on the map
 * shows a small card rather than a form; the folds stay as they were left
 * while going from one person to the next.
 */
export function RelationPanel({
  person, data, colors, today, linking, subgroups, onClose, onPatch, onDelete, onAddFact, onRemoveFact,
  onAddMeet, onRemoveMeet, onStartLink, onUnlink, onPick, onLabel, onHold, onAddBeside,
}: {
  person: Person | null;
  data: RelationData;
  colors: Record<RelationGroup, string>;
  today: string;
  /** This person is waiting for the next tap to draw a line to. */
  linking: boolean;
  /** The groups inside the groups that already exist, offered as you type. */
  subgroups: readonly { group: RelationGroup; sub: string }[];
  onClose: () => void;
  /** Change some of their details, where they are. */
  onPatch: (patch: Partial<PersonDraft>) => void;
  /** Take them off the map. It can be taken back (the undo on the toast). */
  onDelete: () => void;
  onAddFact: (fact: PersonFact) => void;
  onRemoveFact: (fact: PersonFact) => void;
  onAddMeet: (meet: PersonMeet) => void;
  onRemoveMeet: (meet: PersonMeet) => void;
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
  const [open, setOpen] = useState({ details: false, log: false });
  const flip = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  if (!person) return null;

  const silent = daysSinceContact(person, today);
  const toBirthday = daysToBirthday(person, today);
  const turns = turningAge(person, today);
  // Places on the place map that name this person (lib/relation-place), and
  // moments on the life line that say they were there (lib/relation-life).
  const together = placesWith(person.id);
  const shared = momentsWith(person.id);
  const linked = data.links
    .filter((l) => l.source === person.id || l.target === person.id)
    .map((l) => ({ link: l, other: data.people.find((p) => p.id === (l.source === person.id ? l.target : l.source)) }))
    .filter((x): x is { link: typeof x.link; other: Person } => !!x.other);
  const subsHere = subgroups.filter((s) => s.group === person.group && s.sub !== person.sub);

  return (
    <aside data-relation-panel data-person={person.id}
      className="flex w-full flex-col gap-3 border-t border-border bg-surface p-3 text-sm min-[900px]:absolute min-[900px]:right-3 min-[900px]:top-3 min-[900px]:z-20 min-[900px]:max-h-[calc(100%-300px)] min-[900px]:min-h-[260px] min-[900px]:w-[340px] min-[900px]:overflow-y-auto min-[900px]:rounded-2xl min-[900px]:border min-[900px]:shadow-xl">
      {/* Who: the name is the heading, and the heading is the field. */}
      <header className="flex items-start gap-2">
        <span aria-hidden className="mt-2.5 h-3 w-3 shrink-0 rounded-full border-2"
          style={{ borderColor: colors[person.group] }} />
        <div className="min-w-0 flex-1">
          <InlineText value={person.name} maxLength={MAX_PERSON_NAME} data="relation-panel-name"
            className="h-9 text-lg font-semibold"
            onCommit={(name) => { if (name) onPatch({ name }); }} />
        </div>
        <button type="button" aria-label={t('common.close')} data-relation-panel-close
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md hover:bg-accent/20" onClick={onClose}>
          <X aria-hidden className="h-4 w-4" />
        </button>
      </header>

      {/* Which group, which group inside it, and how close. */}
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t('relation.field.group')}>
        {RELATION_GROUPS.map((g) => {
          const Icon = GROUP_ICON[g];
          const on = person.group === g;
          return (
            <button key={g} type="button" role="radio" aria-checked={on} data-relation-panel-group={g}
              onClick={() => { if (!on) onPatch({ group: g }); }}
              className={`inline-flex min-h-7 items-center gap-1 rounded-full border px-2 text-[12px] ${
                on ? 'border-foreground bg-accent/20 text-foreground' : 'border-border text-muted-foreground'}`}>
              <Icon aria-hidden className="h-3 w-3" style={{ color: colors[g] }} />
              {t(GROUP_LABEL[g])}
            </button>
          );
        })}
      </div>

      <dl className="grid grid-cols-[72px_1fr] items-center gap-x-1.5 gap-y-0.5">
        <dt className={quiet}>{t('relation.field.closeness')}</dt>
        <dd className="flex items-center gap-1 px-1.5" role="radiogroup" aria-label={t('relation.field.closeness')}>
          {CLOSENESS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={person.closeness === c}
              data-relation-panel-close={c} title={t(`relation.close.${c}` as 'relation.close.1')}
              aria-label={t(`relation.close.${c}` as 'relation.close.1')}
              className="grid h-7 w-6 place-items-center"
              onClick={() => onPatch({ closeness: c })}>
              <span aria-hidden className={`block rounded-full ${
                person.closeness >= c ? 'bg-foreground' : 'bg-foreground/20'}`}
                style={{ width: 4 + c * 2, height: 4 + c * 2 }} />
            </button>
          ))}
          <span className={`${quiet} ml-1`}>{t(`relation.close.${person.closeness}` as 'relation.close.1')}</span>
        </dd>
      </dl>

      {/* What is worth seeing without opening anything. */}
      <p className={`${quiet} flex flex-wrap items-center gap-x-2 gap-y-0.5 px-0.5`}>
        {toBirthday !== null && (
          <span className="flex items-center gap-1 whitespace-nowrap" data-relation-panel-birthday>
            {toBirthday <= 30 && <Cake aria-hidden className="h-3.5 w-3.5" />}
            {toBirthday === 0 ? t('relation.birthdayToday') : t('relation.birthdayIn', { n: String(toBirthday) })}
            {turns !== null ? ` · ${t('relation.turning', { n: String(turns) })}` : ''}
          </span>
        )}
        <span data-relation-panel-contact>
          {silent === null
            ? t('relation.neverRecorded')
            : silent === 0 ? t('relation.contactedToday') : t('relation.daysSince', { n: String(silent) })}
        </span>
      </p>

      <Fold id="details" title={t('relation.fold.details')} open={open.details} onToggle={() => flip('details')}
        hint={[person.sub, person.relation].filter(Boolean).join(' · ') || undefined}>
        <dl className="grid grid-cols-[72px_1fr] items-center gap-x-1.5 gap-y-0.5">
          <dt className={quiet}>{t('relation.field.sub')}</dt>
          <dd className="flex min-w-0 flex-col">
            <InlineText value={person.sub ?? ''} maxLength={MAX_SUB} data="relation-panel-sub"
              placeholder={t('relation.field.subHint')} onCommit={(sub) => onPatch({ sub })} />
            {subsHere.length > 0 && !person.sub && (
              <span className="flex flex-wrap gap-1 px-1">
                {subsHere.map((s) => (
                  <button key={s.sub} type="button" data-relation-panel-sub-pick={s.sub}
                    className="rounded-full border border-border px-2 text-[12px] text-muted-foreground hover:bg-accent/20"
                    onClick={() => onPatch({ sub: s.sub })}>
                    {s.sub}
                  </button>
                ))}
              </span>
            )}
          </dd>

          <dt className={quiet}>{t('relation.field.relation')}</dt>
          <dd>
            <InlineText value={person.relation ?? ''} maxLength={MAX_RELATION_TEXT} data="relation-panel-rel"
              placeholder={t('relation.field.relationHint')} onCommit={(relation) => onPatch({ relation })} />
          </dd>

          <dt className={quiet}>{t('relation.field.toMe')}</dt>
          <dd className="px-1.5">
            <label className="flex items-center gap-1.5 text-[13px] text-foreground">
              <input type="checkbox" className="h-4 w-4" data-relation-panel-tome checked={!person.apart}
                onChange={(e) => onPatch({ apart: e.target.checked ? undefined : true })} />
              {t(person.apart ? 'relation.field.toMeOff' : 'relation.field.toMeOn')}
            </label>
          </dd>

          <dt className={quiet}>{t('relation.field.birthday')}</dt>
          <dd>
            <Input type="date" data-relation-panel-birthday-input max="2200-12-31"
              value={person.birthday && person.birthday.length > 5 ? person.birthday : ''}
              className={`${bare} w-[128px] text-[13px]`}
              onChange={(e) => {
                const v = e.target.value;
                if (!v || isBirthday(v)) onPatch({ birthday: v || undefined });
              }} />
          </dd>
        </dl>

        <InlineText value={person.note ?? ''} maxLength={MAX_PERSON_NOTE} data="relation-panel-note" area
          placeholder={t('relation.field.note')} onCommit={(note) => onPatch({ note })} />

        {/* What is known, each kind keeping what it used to be. */}
        <section className="flex flex-col gap-0.5">
          <h4 className="text-[12px] font-semibold text-muted-foreground">{t('relation.history.detail')}</h4>
          <ul className="flex flex-col gap-0.5">
            {FACT_KINDS.map((k) => (
              <FactRow key={k} person={person} kind={k} onAdd={onAddFact} onRemove={onRemoveFact} />
            ))}
          </ul>
        </section>
      </Fold>

      <Fold id="log" title={t('relation.history.log')} open={open.log} onToggle={() => flip('log')}
        hint={(person.log?.length ?? 0) > 0 ? String(person.log!.length) : undefined}>
        <MeetLog person={person} onAdd={onAddMeet} onRemove={onRemoveMeet} />
      </Fold>

      {linked.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label={t('relation.link.add')}>
          {linked.map(({ link, other }) => (
            <LinkRow key={other.id} link={link} other={other} onPick={onPick} onUnlink={onUnlink}
              onLabel={onLabel} onHold={onHold} />
          ))}
        </ul>
      )}

      {shared.length > 0 && (
        <p className={quiet} data-relation-moments>
          {t('relation.momentsWith', { n: String(shared.length) })} · {shared.slice(0, 3)
            .map((m) => `${m.date.slice(0, 4)} ${m.title}`).join(', ')}
        </p>
      )}
      {together.length > 0 && (
        <p className={quiet} data-relation-places>
          {t('relation.placesWith', { n: String(together.length) })} · {together.slice(0, 4).join(', ')}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 border-t border-border pt-2.5">
        <Button size="sm" variant={linking ? 'default' : 'outline'} className="h-8 gap-1.5" data-relation-link
          aria-pressed={linking} onClick={onStartLink}>
          <Link2 aria-hidden className="h-4 w-4" />
          {t(linking ? 'relation.link.pick' : 'relation.link.add')}
        </Button>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" data-relation-add-beside onClick={onAddBeside}>
          <UserPlus aria-hidden className="h-4 w-4" />
          {t('relation.link.addBeside')}
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto h-8 gap-1.5 text-destructive" data-relation-remove
          onClick={onDelete}>
          <Trash2 aria-hidden className="h-4 w-4" />
          {t('common.delete')}
        </Button>
      </div>
    </aside>
  );
}
