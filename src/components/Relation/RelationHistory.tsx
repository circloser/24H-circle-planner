import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/usePreferences';
import { todayKey } from '@/lib/calendar-grid';
import {
  FACT_KINDS, MAX_FACT_TEXT, MAX_MEET_NOTE, MEET_KINDS, factHistory, meetHistory,
  type FactKind, type MeetKind, type Person, type PersonFact, type PersonMeet,
} from '@/lib/relation';
import { FACT_ICON, FACT_LABEL, MEET_ICON, MEET_LABEL } from './kinds';

/** '2024', '2024-03' and '2024-03-05' all read as themselves; nothing else
 *  is accepted, so a half-typed year is simply not a date yet. */
const isWhenDraft = (v: string): boolean => /^\d{4}(-\d{2}(-\d{2})?)?$/.test(v);

/**
 * One kind of thing known about somebody: what it is now, what it was, and a
 * row for saying what it has become.
 */
function FactBlock({ person, kind, onAdd, onRemove }: {
  person: Person;
  kind: FactKind;
  onAdd: (fact: PersonFact) => void;
  onRemove: (fact: PersonFact) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [when, setWhen] = useState('');
  const history = factHistory(person, kind);
  const Icon = FACT_ICON[kind];
  const ok = !!value.trim() && (!when || isWhenDraft(when));

  const add = () => {
    if (!ok) return;
    onAdd({ k: kind, v: value.trim(), ...(when ? { at: when } : {}) });
    setValue('');
    setWhen('');
  };

  return (
    <section className="flex flex-col gap-1.5" data-relation-fact-kind={kind}>
      <h4 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Icon aria-hidden className="h-4 w-4 text-muted-foreground" />
        {t(FACT_LABEL[kind])}
      </h4>
      {history.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {history.map((fact, i) => (
            <li key={`${fact.v}-${fact.at ?? ''}-${i}`} className="flex items-center gap-2 text-sm"
              data-relation-fact={kind}>
              {/* The one on top is what is true now; the rest are what it was
                  before, which is the whole point of keeping them. */}
              <span className={`min-w-0 flex-1 truncate ${i === 0 ? 'text-foreground' : 'text-muted-foreground line-through decoration-foreground/30'}`}>
                {fact.v}
              </span>
              {fact.at && <span className="shrink-0 tabular-nums text-[12px] text-muted-foreground">{fact.at}</span>}
              <button type="button" aria-label={t('common.delete')} data-relation-fact-remove={`${kind}:${i}`}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent/20"
                onClick={() => onRemove(fact)}>
                <X aria-hidden className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-1.5">
        <Input value={value} maxLength={MAX_FACT_TEXT} data-relation-fact-input={kind}
          className="h-9 min-w-0 flex-1" placeholder={t(FACT_LABEL[kind])}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <Input value={when} maxLength={10} data-relation-fact-when={kind} inputMode="numeric"
          className="h-9 w-[104px] shrink-0 tabular-nums" placeholder={t('relation.fact.whenHint')}
          onChange={(e) => setWhen(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <Button type="button" size="sm" variant="outline" disabled={!ok} className="shrink-0 gap-1"
          data-relation-fact-add={kind} onClick={add}>
          <Plus aria-hidden className="h-4 w-4" />
          <span className="sr-only">{t('relation.fact.add')}</span>
        </Button>
      </div>
    </section>
  );
}

/** Everything that has been written down about one person: what is known, and
 *  every time there was any contact. */
export function PersonHistoryDialog({ person, onClose, onAddFact, onRemoveFact, onAddMeet, onRemoveMeet }: {
  person: Person | null;
  onClose: () => void;
  onAddFact: (fact: PersonFact) => void;
  onRemoveFact: (fact: PersonFact) => void;
  onAddMeet: (meet: PersonMeet) => void;
  onRemoveMeet: (meet: PersonMeet) => void;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<MeetKind>('meet');
  const [day, setDay] = useState('');
  const [note, setNote] = useState('');

  const today = todayKey();
  const log = person ? meetHistory(person) : [];
  const at = day || today;

  const add = () => {
    onAddMeet({ at, k: kind, ...(note.trim() ? { v: note.trim() } : {}) });
    setNote('');
    setDay('');
  };

  return (
    <Dialog open={person !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto" data-relation-history-dialog>
        <DialogHeader>
          <DialogTitle>{person?.name ?? t('relation.history.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('relation.history.title')}</DialogDescription>
        </DialogHeader>

        {person && (
          <div className="flex flex-col gap-5">
            {/* What is known. Each kind keeps its own past, so a new job does
                not rub out the one before it. */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t('relation.history.detail')}
              </h3>
              {FACT_KINDS.map((k) => (
                <FactBlock key={k} person={person} kind={k} onAdd={onAddFact} onRemove={onRemoveFact} />
              ))}
            </div>

            {/* And every time there was contact, newest first. */}
            <div className="flex flex-col gap-2">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t('relation.history.log')}
              </h3>
              <div className="flex flex-wrap items-center gap-1.5">
                {MEET_KINDS.map((k) => {
                  const Icon = MEET_ICON[k];
                  const on = kind === k;
                  return (
                    <button key={k} type="button" data-relation-meet-kind={k} aria-pressed={on}
                      onClick={() => setKind(k)}
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] ${
                        on ? 'border-foreground bg-accent/20 text-foreground' : 'border-border text-muted-foreground'}`}>
                      <Icon aria-hidden className="h-3.5 w-3.5" />
                      {t(MEET_LABEL[k])}
                    </button>
                  );
                })}
                <Input type="date" value={at} max={today} data-relation-meet-date
                  className="h-9 w-[150px]" onChange={(e) => setDay(e.target.value)} />
              </div>
              <div className="flex items-center gap-1.5">
                <Input value={note} maxLength={MAX_MEET_NOTE} data-relation-meet-note
                  className="h-9 min-w-0 flex-1" placeholder={t('relation.meet.note')}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
                <Button type="button" size="sm" className="shrink-0 gap-1.5" data-relation-meet-add onClick={add}>
                  <Plus aria-hidden className="h-4 w-4" />
                  {t('relation.meet.add')}
                </Button>
              </div>

              {log.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('relation.meet.none')}</p>
              ) : (
                <ul className="flex flex-col gap-0.5" data-relation-meet-list>
                  {log.map((meet, i) => {
                    const Icon = MEET_ICON[meet.k];
                    return (
                      <li key={`${meet.at}-${meet.k}-${i}`} className="flex items-center gap-2 text-sm"
                        data-relation-meet-row={meet.at}>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{meet.at}</span>
                        <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="shrink-0 text-foreground">{t(MEET_LABEL[meet.k])}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{meet.v}</span>
                        <button type="button" aria-label={t('common.delete')} data-relation-meet-remove={i}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent/20"
                          onClick={() => onRemoveMeet(meet)}>
                          <X aria-hidden className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={onClose}>{t('common.close')}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
