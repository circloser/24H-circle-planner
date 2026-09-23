import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/usePreferences';
import { todayKey } from '@/lib/calendar-grid';
import { MAX_PERSON_NAME } from '@/lib/relation';
import {
  MAX_ANSWER, MAX_ANSWER_VERSIONS, MAX_MBTI, MAX_MOOD_NOTE, MAX_MOODS, MAX_RESUME, MAX_RESUME_TEXT, MBTI_AXES,
  MOOD_LEVELS, RESUME_KINDS, answered, latest, moodAverage, newestFirst, resumeOf,
  type Dated, type MoodLevel, type RelationMe, type ResumeKind,
} from '@/lib/relation-me';
import { ME_QUESTIONS } from '@/data/me-questions';
import type { TKey } from '@/i18n/translations';
import { PhotoField } from './RelationDialogs';

type Tab = 'basic' | 'resume' | 'mbti' | 'qa' | 'mood';
const TABS: readonly Tab[] = ['basic', 'resume', 'mbti', 'qa', 'mood'];
/** Questions shown at a time: a hundred text boxes at once is a wall. */
const PAGE = 10;
/** The faces on the five rungs of a mood, worst to best. */
const FACES = ['😣', '🙁', '😐', '🙂', '😄'] as const;

const isYearMonthDraft = (v: string) => /^\d{4}(-(0[1-9]|1[0-2]))?$/.test(v);
const field = 'text-sm font-medium text-foreground';
const quiet = 'text-[12px] text-muted-foreground';

/** The résumé: a line at a time, each kind listed with the latest first. */
function ResumeTab({ me, onChange }: { me: RelationMe; onChange: (patch: Partial<RelationMe>) => void }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<ResumeKind>('education');
  const [value, setValue] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const ok = !!value.trim() && (!from || isYearMonthDraft(from)) && (!to || isYearMonthDraft(to));
  const add = () => {
    if (!ok) return;
    const entry = { k: kind, v: value.trim(), ...(from ? { from } : {}), ...(to ? { to } : {}) };
    onChange({ resume: [...(me.resume ?? []), entry].slice(-MAX_RESUME) });
    setValue('');
    setFrom('');
    setTo('');
  };
  const drop = (entry: object) => {
    const next = (me.resume ?? []).filter((e) => e !== entry);
    onChange({ resume: next.length ? next : undefined });
  };
  const any = (me.resume ?? []).length > 0;

  return (
    <div className="flex flex-col gap-4" data-me-resume>
      {/* What gets added: a kind, the line itself, and when. */}
      <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
        <div className="flex flex-wrap gap-1">
          {RESUME_KINDS.map((k) => (
            <button key={k} type="button" data-me-resume-kind={k} aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`min-h-8 rounded-full border px-2.5 text-[12px] ${
                kind === k ? 'border-foreground bg-accent/20 text-foreground' : 'border-border text-muted-foreground'}`}>
              {t(`me.resume.${k}` as TKey)}
            </button>
          ))}
        </div>
        <Input value={value} maxLength={MAX_RESUME_TEXT} data-me-resume-input
          placeholder={t('me.resume.placeholder')} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <div className="flex items-center gap-1.5">
          <Input value={from} maxLength={7} inputMode="numeric" data-me-resume-from className="h-9 min-w-0 flex-1 tabular-nums"
            placeholder={t('me.resume.from')} onChange={(e) => setFrom(e.target.value)} />
          <span aria-hidden className="text-muted-foreground">–</span>
          <Input value={to} maxLength={7} inputMode="numeric" data-me-resume-to className="h-9 min-w-0 flex-1 tabular-nums"
            placeholder={t('me.resume.to')} onChange={(e) => setTo(e.target.value)} />
          <Button type="button" size="sm" className="h-9 shrink-0 gap-1" disabled={!ok} data-me-resume-add onClick={add}>
            <Plus aria-hidden className="h-4 w-4" />
            {t('me.resume.add')}
          </Button>
        </div>
      </div>

      {!any && <p className={quiet}>{t('me.resume.none')}</p>}
      {RESUME_KINDS.map((k) => {
        const lines = resumeOf(me, k);
        if (!lines.length) return null;
        return (
          <section key={k} className="flex flex-col gap-1" data-me-resume-group={k}>
            <h4 className="text-[12px] font-semibold text-muted-foreground">{t(`me.resume.${k}` as TKey)}</h4>
            <ul className="flex flex-col">
              {lines.map((e, i) => (
                <li key={`${e.v}-${e.from ?? ''}-${i}`} className="flex items-center gap-2 border-t border-border/60 py-1.5 text-sm"
                  data-me-resume-line={k}>
                  <span className="min-w-0 flex-1 text-foreground">{e.v}</span>
                  {(e.from || e.to) && (
                    <span className="shrink-0 tabular-nums text-[12px] text-muted-foreground">
                      {e.from ?? ''} – {e.to ?? t('me.resume.now')}
                    </span>
                  )}
                  <button type="button" aria-label={t('common.delete')} data-me-resume-remove
                    className="grid h-7 w-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent/20"
                    onClick={() => drop(e)}>
                    <X aria-hidden className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** The type, one letter a pair, recorded with the day it was taken. */
function MbtiTab({ me, onChange }: { me: RelationMe; onChange: (patch: Partial<RelationMe>) => void }) {
  const { t } = useTranslation();
  const now = latest(me.mbti);
  const [letters, setLetters] = useState<string[]>(() => (now ? now.v.split('') : ['', '', '', '']));
  const whole = letters.every(Boolean) ? letters.join('') : '';
  const record = () => {
    if (!whole) return;
    const today = todayKey();
    const list = me.mbti ?? [];
    // Taken twice in a day is the same day's answer, not a second one.
    const kept = list.filter((d) => d.at !== today);
    onChange({ mbti: [...kept, { v: whole, at: today }].slice(-MAX_MBTI) });
  };
  const history = newestFirst(me.mbti);
  return (
    <div className="flex flex-col gap-4" data-me-mbti>
      <p className={quiet}>{t('me.mbti.hint')}</p>
      <div className="grid grid-cols-4 gap-2">
        {MBTI_AXES.map((pair, axis) => (
          <div key={pair.join('')} className="flex flex-col gap-1">
            {pair.map((letter) => (
              <button key={letter} type="button" data-me-mbti-letter={letter} aria-pressed={letters[axis] === letter}
                onClick={() => setLetters((was) => was.map((l, i) => (i === axis ? letter : l)))}
                className={`h-11 rounded-lg border text-lg font-bold ${
                  letters[axis] === letter ? 'border-foreground bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}>
                {letter}
              </button>
            ))}
          </div>
        ))}
      </div>
      <Button type="button" disabled={!whole || (now?.v === whole && now.at === todayKey())} data-me-mbti-save onClick={record}>
        {whole ? `${whole} · ` : ''}{t('me.mbti.save')}
      </Button>
      {history.length === 0 ? (
        <p className={quiet}>{t('me.mbti.none')}</p>
      ) : (
        <ul className="flex flex-col" data-me-mbti-history>
          {history.map((d, i) => (
            <li key={`${d.at}-${i}`} className="flex items-center gap-3 border-t border-border/60 py-1.5 text-sm">
              <span className="tabular-nums text-muted-foreground">{d.at}</span>
              <span className={`font-bold tracking-wide ${i === 0 ? 'text-foreground' : 'text-muted-foreground'}`}>{d.v}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One question: the latest answer, open to change, and the ones before it. */
function Question({ n, text, list, onAnswer }: {
  n: number;
  text: string;
  list: readonly Dated[] | undefined;
  onAnswer: (value: string) => void;
}) {
  const { t } = useTranslation();
  const now = latest(list);
  const [draft, setDraft] = useState(now?.v ?? '');
  const [open, setOpen] = useState(false);
  const past = newestFirst(list).slice(1);
  return (
    <li className="flex flex-col gap-1 border-t border-border/60 py-2" data-me-question={n}>
      <p className="text-sm text-foreground">
        <span className="mr-1.5 tabular-nums text-muted-foreground">{n}.</span>{text}
      </p>
      <textarea value={draft} maxLength={MAX_ANSWER} rows={2} data-me-answer={n}
        placeholder={t('me.qa.placeholder')}
        className="w-full resize-y rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft.trim() && draft.trim() !== now?.v) onAnswer(draft.trim()); }} />
      <div className="flex items-center gap-2">
        {now && <span className={`${quiet} tabular-nums`}>{now.at}</span>}
        {past.length > 0 && (
          <button type="button" data-me-answer-past={n} aria-expanded={open}
            className={`${quiet} rounded px-1 hover:bg-accent/20`} onClick={() => setOpen((o) => !o)}>
            {t('me.qa.past', { n: String(past.length) })}
          </button>
        )}
      </div>
      {open && (
        <ul className="flex flex-col gap-1 border-l-2 border-border pl-2.5">
          {past.map((d, i) => (
            <li key={`${d.at}-${i}`} className="text-[13px] text-muted-foreground">
              <span className="mr-1.5 tabular-nums">{d.at}</span>{d.v}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** A hundred questions, ten at a time, every answer kept with its day. */
function QaTab({ me, onChange }: { me: RelationMe; onChange: (patch: Partial<RelationMe>) => void }) {
  const { t, lang } = useTranslation();
  const [only, setOnly] = useState(false);
  const [page, setPage] = useState(0);
  const answers = me.answers ?? {};
  const list = ME_QUESTIONS.filter((q) => !only || !answers[q.id]?.length);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const at = Math.min(page, pages - 1);
  const shown = list.slice(at * PAGE, at * PAGE + PAGE);
  const answer = (id: string, value: string) => {
    const today = todayKey();
    // Changed again on the same day: that day's answer is replaced, so an
    // evening of rewording is one answer, not ten.
    const kept = (answers[id] ?? []).filter((d) => d.at !== today);
    onChange({ answers: { ...answers, [id]: [...kept, { v: value, at: today }].slice(-MAX_ANSWER_VERSIONS) } });
  };
  const done = answered(me);
  return (
    <div className="flex flex-col gap-3" data-me-qa>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${done}%` }} />
        </div>
        <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground" data-me-qa-progress>
          {t('me.qa.progress', { n: String(done) })}
        </span>
        <button type="button" data-me-qa-only aria-pressed={only}
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[12px] ${
            only ? 'border-foreground text-foreground' : 'border-border text-muted-foreground'}`}
          onClick={() => { setOnly((o) => !o); setPage(0); }}>
          {t(only ? 'me.qa.all' : 'me.qa.unanswered')}
        </button>
      </div>
      <ul className="flex flex-col">
        {shown.map((q) => (
          <Question key={q.id} n={Number(q.id.slice(1))} text={lang === 'ko' ? q.ko : q.en}
            list={answers[q.id]} onAnswer={(v) => answer(q.id, v)} />
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" disabled={at === 0} data-me-qa-prev
          onClick={() => setPage(at - 1)}>{t('me.qa.prev')}</Button>
        <span className="text-[12px] tabular-nums text-muted-foreground">{at + 1} / {pages}</span>
        <Button type="button" variant="outline" size="sm" disabled={at >= pages - 1} data-me-qa-next
          onClick={() => setPage(at + 1)}>{t('me.qa.next')}</Button>
      </div>
    </div>
  );
}

/** How I felt: five rungs, a line if there is one, and the run of them. */
function MoodTab({ me, onChange }: { me: RelationMe; onChange: (patch: Partial<RelationMe>) => void }) {
  const { t } = useTranslation();
  const today = todayKey();
  const [level, setLevel] = useState<MoodLevel | null>(null);
  const [day, setDay] = useState('');
  const [note, setNote] = useState('');
  const record = () => {
    if (!level) return;
    const entry = { at: day || today, v: level, ...(note.trim() ? { note: note.trim() } : {}) };
    onChange({ moods: [...(me.moods ?? []), entry].slice(-MAX_MOODS) });
    setLevel(null);
    setNote('');
    setDay('');
  };
  const drop = (entry: object) => {
    const next = (me.moods ?? []).filter((m) => m !== entry);
    onChange({ moods: next.length ? next : undefined });
  };
  const history = newestFirst(me.moods);
  const run = history.slice(0, 30).reverse();
  const avg = moodAverage(me, 30);
  return (
    <div className="flex flex-col gap-3" data-me-mood>
      <div className="grid grid-cols-5 gap-1.5">
        {MOOD_LEVELS.map((v) => (
          <button key={v} type="button" data-me-mood-level={v} aria-pressed={level === v}
            aria-label={t(`me.mood.${v}` as TKey)}
            onClick={() => setLevel(v)}
            className={`flex flex-col items-center gap-0.5 rounded-xl border py-2 ${
              level === v ? 'border-foreground bg-accent/20' : 'border-border'}`}>
            <span aria-hidden className="text-2xl leading-none">{FACES[v - 1]}</span>
            <span className="text-[11px] text-muted-foreground">{t(`me.mood.${v}` as TKey)}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Input type="date" value={day || today} max={today} data-me-mood-date className="h-9 w-[150px] shrink-0"
          onChange={(e) => setDay(e.target.value)} />
        <Input value={note} maxLength={MAX_MOOD_NOTE} data-me-mood-note className="h-9 min-w-0 flex-1"
          placeholder={t('me.mood.note')} onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); record(); } }} />
        <Button type="button" size="sm" className="h-9 shrink-0 gap-1" disabled={!level} data-me-mood-add onClick={record}>
          <Plus aria-hidden className="h-4 w-4" />
          {t('me.mood.add')}
        </Button>
      </div>

      {/* The run of it: the last thirty, oldest on the left. */}
      {run.length > 1 && (
        <figure className="flex flex-col gap-1" data-me-mood-chart>
          <svg viewBox={`0 0 ${(run.length - 1) * 10} 44`} preserveAspectRatio="none" className="h-14 w-full" aria-hidden>
            <polyline fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"
              vectorEffect="non-scaling-stroke"
              points={run.map((m, i) => `${i * 10},${40 - (m.v - 1) * 9}`).join(' ')} />
          </svg>
          {avg !== null && (
            <figcaption className={quiet} data-me-mood-avg>
              {t('me.mood.avg', { n: String(run.length), v: `${FACES[Math.round(avg) - 1]} ${avg}` })}
            </figcaption>
          )}
        </figure>
      )}

      {history.length === 0 ? (
        <p className={quiet}>{t('me.mood.none')}</p>
      ) : (
        <ul className="flex flex-col" data-me-mood-list>
          {history.map((m, i) => (
            <li key={`${m.at}-${i}`} className="flex items-center gap-2 border-t border-border/60 py-1.5 text-sm"
              data-me-mood-row={m.at}>
              <span className="shrink-0 tabular-nums text-muted-foreground">{m.at}</span>
              <span aria-hidden className="shrink-0">{FACES[m.v - 1]}</span>
              <span className="shrink-0 text-foreground">{t(`me.mood.${m.v}` as TKey)}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{m.note}</span>
              <button type="button" aria-label={t('common.delete')} data-me-mood-remove
                className="grid h-7 w-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent/20"
                onClick={() => drop(m)}>
                <X aria-hidden className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The middle of the map, opened: me.
 *
 * Five pages — the basics, a résumé, the MBTI, a hundred questions and a
 * mood — each saved the moment it is written, each dated, nothing overwritten.
 */
export function MeProfileDialog({ open, me, pro, onClose, onChange }: {
  open: boolean;
  me: RelationMe;
  pro: boolean;
  onClose: () => void;
  onChange: (patch: Partial<RelationMe>) => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('basic');
  const [name, setName] = useState(me.name ?? '');
  const [was, setWas] = useState(me.name ?? '');
  if ((me.name ?? '') !== was) { setWas(me.name ?? ''); setName(me.name ?? ''); }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[90dvh] max-w-xl flex-col gap-3 overflow-hidden" data-relation-me-dialog>
        <DialogHeader>
          <DialogTitle>{me.name || t('me.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('me.hint')}</DialogDescription>
        </DialogHeader>
        <div role="tablist" className="flex shrink-0 gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
          {TABS.map((id) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} data-me-tab={id}
              onClick={() => setTab(id)}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm ${
                tab === id ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground'}`}>
              {t(`me.tab.${id}` as TKey)}
            </button>
          ))}
        </div>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
          {tab === 'basic' && (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className={field}>{t('relation.me.name')}</span>
                <Input data-relation-me-name value={name} maxLength={MAX_PERSON_NAME}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => { if (name.trim() !== (me.name ?? '')) onChange({ name: name.trim() || undefined }); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className={field}>{t('relation.field.photo')}</span>
                {/* My own face: the "only with their consent" line is for
                    photos of other people, not this one. */}
                <PhotoField value={me.photo} original={me.photo} pro={pro} own
                  onChange={(photo) => onChange({ photo })} />
              </div>
            </div>
          )}
          {tab === 'resume' && <ResumeTab me={me} onChange={onChange} />}
          {tab === 'mbti' && <MbtiTab me={me} onChange={onChange} />}
          {tab === 'qa' && <QaTab me={me} onChange={onChange} />}
          {tab === 'mood' && <MoodTab me={me} onChange={onChange} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
