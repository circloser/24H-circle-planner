import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, ListFilter, Plus, Search, ShieldAlert, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { useSyncStatus } from '@/hooks/useSync';
import { COLOR_THEMES } from '@/data/color-themes';
import { requestUpgrade } from '@/lib/pro';
import { todayKey } from '@/lib/calendar-grid';
import { track, trackOnce } from '@/lib/track';
import {
  FREE_RELATION_LINKS, FREE_RELATION_PEOPLE, RELATION_GROUPS, canAddLink, canAddPerson,
  findPeople, isBirthdayThisMonth, isOutOfTouch, relationSummary,
  type Person, type RelationGroup,
} from '@/lib/relation';
import { useRelation, RELATION_UNDO_MS } from '@/hooks/useRelation';
import { familyToImport, personFromFamily, readLife, samepeople, syncFromLife } from '@/lib/relation-life';
import { RELATION_LABEL } from '@/components/Life/categories';
import { GROUP_ICON, GROUP_LABEL, groupColors } from './groups';
import { RelationCanvas } from './RelationCanvas';
import { RelationPanel } from './RelationPanel';
import { MeDialog, PersonDialog, type PersonTarget } from './RelationDialogs';
import { RelationExportDialog } from './RelationExport';
import { RELATION_EXPORT_EVENT } from '@/lib/relation-export';

/** The filters that are not a group: the two questions the map is for. */
type Sieve = 'stale' | 'birthday';

/**
 * Relation — me in the middle, and the people around me.
 *
 * The page keeps the life line's manners: the title and one line under it, the
 * map itself, and nothing else said aloud. Adding is a button and a double tap
 * on the map; the filter and the search sit in the header; export lives in the
 * app header, as it does everywhere here.
 */
export function RelationView() {
  const api = useRelation();
  const { data } = api;
  const { t } = useTranslation();
  const { prefs } = usePreferences();
  const pro = useAuth().plan === 'pro';
  const syncing = useSyncStatus().status !== 'disabled';
  const theme = COLOR_THEMES.some((th) => th.id === prefs.colorTheme) ? prefs.colorTheme : null;
  const colors = groupColors(theme);
  const today = todayKey();

  useEffect(() => { trackOnce('relation_open'); }, []);
  // The page fills the window, like the calendar and the life line.
  useEffect(() => {
    document.documentElement.setAttribute('data-page', 'relation');
    return () => document.documentElement.removeAttribute('data-page');
  }, []);

  const [only, setOnly] = useState<Set<RelationGroup>>(() => new Set());
  const [sieve, setSieve] = useState<Set<Sieve>>(() => new Set());
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [target, setTarget] = useState<PersonTarget | null>(null);
  const [meOpen, setMeOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [arriving, setArriving] = useState<readonly string[]>([]);

  // The life line owns the parents' names and birthdays; bring any change over.
  const life = useMemo(() => readLife(), []);
  useEffect(() => {
    const next = syncFromLife(life, api.data.people);
    if (samepeople(next, api.data.people)) return;
    next.forEach((p, i) => {
      if (p !== api.data.people[i]) api.updatePerson(p.id, { ...p });
    });
    // Once per visit: the life line does not change while this page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [life]);

  useEffect(() => {
    const open = () => setExporting(true);
    window.addEventListener(RELATION_EXPORT_EVENT, open);
    return () => window.removeEventListener(RELATION_EXPORT_EVENT, open);
  }, []);

  const shown = useMemo(() => {
    const found = query.trim() ? new Set(findPeople(data, query).map((p) => p.id)) : null;
    return data.people.filter((p) => {
      if (only.size && !only.has(p.group)) return false;
      if (sieve.has('stale') && !isOutOfTouch(p, today)) return false;
      if (sieve.has('birthday') && !isBirthdayThisMonth(p, today)) return false;
      if (found && !found.has(p.id)) return false;
      return true;
    });
  }, [data, only, sieve, query, today]);

  const filtered = useMemo(() => {
    const keep = new Set(shown.map((p) => p.id));
    return {
      ...data,
      people: shown,
      links: data.links.filter((l) => keep.has(l.source) && keep.has(l.target)),
    };
  }, [data, shown]);

  const summary = relationSummary(data, today);
  const person = selected ? data.people.find((p) => p.id === selected) ?? null : null;

  const add = useCallback((at?: Person['at']) => {
    if (!canAddPerson(data, pro)) {
      toast(t('relation.limit.people', { n: String(FREE_RELATION_PEOPLE) }));
      requestUpgrade('relation');
      return;
    }
    setTarget({ mode: 'add', ...(at ? { at } : {}) });
  }, [data, pro, t]);

  /** Bring the life line's parents over, one after the other. */
  const importFamily = () => {
    const waiting = familyToImport(life, data);
    if (!waiting.length) return;
    const room = pro ? waiting.length : Math.max(0, FREE_RELATION_PEOPLE - data.people.length);
    const taking = waiting.slice(0, room);
    if (!taking.length) {
      toast(t('relation.limit.people', { n: String(FREE_RELATION_PEOPLE) }));
      requestUpgrade('relation');
      return;
    }
    const ids = api.addPeople(taking.map((f) => personFromFamily(f, (rel) => t(RELATION_LABEL[rel]))));
    setArriving(ids);
    track('relation_import');
  };

  /** Tapping a second person while linking draws the line. */
  const pick = (id: string | null) => {
    if (linking && id && id !== linking) {
      if (!canAddLink(data, pro)) {
        toast(t('relation.limit.links', { n: String(FREE_RELATION_LINKS) }));
        requestUpgrade('relation');
      } else {
        api.addLink(linking, id);
        track('relation_link');
      }
      setLinking(null);
      return;
    }
    setLinking(null);
    setSelected(id);
  };

  const remove = (id: string) => {
    const gone = api.removePerson(id);
    setTarget(null);
    setSelected(null);
    if (!gone) return;
    toast(t('relation.deleted'), {
      action: { label: t('sync.undo'), onClick: () => api.restorePerson(gone.person, gone.at, gone.links) },
      duration: RELATION_UNDO_MS,
    });
  };

  const empty = data.people.length === 0;
  const waiting = familyToImport(life, data);
  const searchBox = useRef<HTMLInputElement>(null);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col" data-relation-view>
      <header className="mx-auto w-full max-w-[960px] px-4 pt-3 text-center">
        {/* The tab that was just pressed says which page this is. */}
        <h2 className="sr-only">{t('relation.title')}</h2>
        {api.readOnly && (
          <p role="status" data-relation-newer
            className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left text-sm text-foreground">
            {t('relation.newerVersion')}
          </p>
        )}
      </header>

      <div className="contents" inert={api.readOnly || undefined}>
        {/* Header row: add, filter, search. */}
        <div className="mx-auto mt-4 flex w-full max-w-[1200px] flex-wrap items-center justify-center gap-1.5 px-4">
          <Button size="sm" className="gap-1.5" data-relation-add onClick={() => add()}>
            <Plus aria-hidden className="h-4 w-4" />
            {t('relation.add')}
          </Button>
          {RELATION_GROUPS.map((g) => {
            const on = only.has(g);
            const Icon = GROUP_ICON[g];
            return (
              <button key={g} type="button" data-relation-filter={g} aria-pressed={on}
                onClick={() => setOnly((was) => {
                  const next = new Set(was);
                  if (!next.delete(g)) next.add(g);
                  return next;
                })}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] ${
                  on ? 'border-foreground text-foreground' : 'border-border text-muted-foreground'}`}>
                <Icon aria-hidden className="h-3.5 w-3.5" style={{ color: colors[g] }} />
                {t(GROUP_LABEL[g])}
                <span className="tabular-nums text-muted-foreground">{summary.byGroup[g]}</span>
              </button>
            );
          })}
          {(['stale', 'birthday'] as const).map((s) => {
            const on = sieve.has(s);
            return (
              <button key={s} type="button" data-relation-sieve={s} aria-pressed={on}
                onClick={() => setSieve((was) => {
                  const next = new Set(was);
                  if (!next.delete(s)) next.add(s);
                  return next;
                })}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] ${
                  on ? 'border-foreground text-foreground' : 'border-border text-muted-foreground'}`}>
                <ListFilter aria-hidden className="h-3.5 w-3.5" />
                {t(s === 'stale' ? 'relation.filter.stale' : 'relation.filter.birthday')}
                <span className="tabular-nums text-muted-foreground">
                  {s === 'stale' ? summary.outOfTouch : summary.birthdaysThisMonth}
                </span>
              </button>
            );
          })}
          {searching ? (
            <span className="inline-flex items-center gap-1">
              <Input ref={searchBox} autoFocus value={query} data-relation-search
                placeholder={t('relation.search')} className="h-9 w-44"
                onChange={(e) => setQuery(e.target.value)} />
              <button type="button" aria-label={t('common.close')} data-relation-search-close
                className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent/20"
                onClick={() => { setQuery(''); setSearching(false); }}>
                <X aria-hidden className="h-4 w-4" />
              </button>
            </span>
          ) : (
            <button type="button" aria-label={t('relation.search')} title={t('relation.search')} data-relation-search-open
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground hover:bg-accent/20"
              onClick={() => setSearching(true)}>
              <Search aria-hidden className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-1 flex-col min-[900px]:flex-row">
          <div className="flex flex-1 flex-col">
            <RelationCanvas
              data={filtered}
              colors={colors}
              today={today}
              selected={selected}
              linking={linking}
              appearing={arriving}
              meLabel={t('relation.me.short')}
              onSelect={pick}
              onPlace={api.placePerson}
              onAddAt={(at) => add(at)}
            />

            {empty ? (
              /* The canvas covers its whole box, so this has to sit above it
                 to be pressable at all. */
              <div className="relative z-10 mx-auto -mt-16 flex max-w-sm flex-col items-center gap-2 px-4 pb-6 text-center" data-relation-empty>
                <p className="text-[15px] italic text-muted-foreground">{t('relation.empty')}</p>
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  {waiting.length > 0 && (
                    <Button size="sm" variant="outline" className="gap-1.5" data-relation-import onClick={importFamily}>
                      <UserPlus aria-hidden className="h-4 w-4" />
                      {t('relation.importFamily', { n: String(waiting.length) })}
                    </Button>
                  )}
                  <Button size="sm" className="gap-1.5" data-relation-first onClick={() => add()}>
                    <Plus aria-hidden className="h-4 w-4" />
                    {t('relation.add')}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="px-4 pb-4 text-center text-[11px] text-muted-foreground" data-relation-summary>
                {[
                  t('relation.sum.people', { n: String(summary.people) }),
                  ...RELATION_GROUPS.filter((g) => summary.byGroup[g] > 0)
                    .map((g) => `${t(GROUP_LABEL[g])} ${summary.byGroup[g]}`),
                  summary.outOfTouch ? t('relation.sum.stale', { n: String(summary.outOfTouch) }) : null,
                  summary.birthdaysThisMonth ? t('relation.sum.birthday', { n: String(summary.birthdaysThisMonth) }) : null,
                ].filter(Boolean).join(' · ')}
              </p>
            )}

            {/* The map is a canvas, so this list is the page for a screen
                reader and for anyone using a keyboard alone. */}
            <ul className="sr-only" aria-label={t('relation.list.label')} data-relation-list>
              {shown.map((p) => (
                <li key={p.id}>
                  <button type="button" data-relation-list-item={p.id} onClick={() => pick(p.id)}>
                    {p.name} · {t(GROUP_LABEL[p.group])}
                    {isOutOfTouch(p, today) ? ` · ${t('relation.filter.stale')}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <RelationPanel
            person={person}
            data={data}
            colors={colors}
            today={today}
            linking={linking === selected && linking !== null}
            onClose={() => { setSelected(null); setLinking(null); }}
            onEdit={() => person && setTarget({ mode: 'edit', p: person })}
            onContacted={() => { if (person) { api.markContacted(person.id); track('relation_contact'); } }}
            onStartLink={() => setLinking((was) => (was === selected ? null : selected))}
            onUnlink={(other) => person && api.removeLink(person.id, other)}
            onLabel={(other, label) => person && api.nameLink(person.id, other, label)}
            onPick={(id) => setSelected(id)}
          />
        </div>

        {/* Someone else's details, said where they are first written down. */}
        {!empty && (
          <p className="flex items-center justify-center gap-1.5 px-4 pb-4 text-center text-[11px] text-muted-foreground"
            data-relation-privacy-foot>
            <ShieldAlert aria-hidden className="h-3.5 w-3.5 shrink-0" />
            {t('relation.privacy.hint')}
          </p>
        )}
      </div>

      <PersonDialog target={target} pro={pro} syncing={syncing}
        onClose={() => setTarget(null)}
        onSave={(draft, id) => {
          if (id) api.updatePerson(id, draft);
          else {
            const made = api.addPerson({ ...draft, ...(target?.mode === 'add' && target.at ? { at: target.at } : {}) });
            setArriving([made]);
            track('relation_add');
          }
          setTarget(null);
        }}
        onDelete={remove} />
      <MeDialog open={meOpen} me={data.me} pro={pro} onClose={() => setMeOpen(false)}
        onSave={(me) => { api.setMe(me); setMeOpen(false); }} />
      <RelationExportDialog open={exporting} onOpenChange={setExporting} api={api} colors={colors} />

      {/* The middle of the map is me: one quiet way to say who that is. */}
      <button type="button" data-relation-me-open onClick={() => setMeOpen(true)}
        className="mx-auto mb-4 min-h-9 text-[11px] text-muted-foreground underline decoration-dotted underline-offset-4">
        {t('relation.me.title')}
      </button>

      {/* A download button for the header's export menu to find. */}
      <Button size="sm" variant="outline" data-relation-export className="sr-only" onClick={() => setExporting(true)}>
        <Download aria-hidden className="h-4 w-4" />
        {t('header.export')}
      </Button>
    </div>
  );
}
