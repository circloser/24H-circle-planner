import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, Feather, ListFilter, Pin, Plus, Scale, ShieldAlert, Sprout, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { useSyncStatus } from '@/hooks/useSync';
import { useLife, type LifeApi, type MilestoneDraft } from '@/hooks/useLife';
import { COLOR_THEMES } from '@/data/color-themes';
import { requestUpgrade } from '@/lib/pro';
import { todayKey } from '@/lib/calendar-grid';
import { track, trackOnce } from '@/lib/track';
import {
  FREE_LIFE_FAMILY, FREE_LIFE_MILESTONES, MAX_ENDING, MAX_NAME, PICKABLE_CATEGORIES, ageAt, buildTimeline,
  canAddFamily, canAddMilestone, formatLifeDate, isFullDate, lifeSummary,
  type FamilyMember, type LifeCategory, type Relation,
} from '@/lib/life';
import { dismissBackupBanner, downloadLifeBackup, needsBackupWarning } from '@/lib/life-backup';
import { LIFE_EXPORT_EVENT } from '@/lib/life-export';
import { CATEGORY_ICON, CATEGORY_LABEL, RELATION_LABEL, categoryColors, inkOf } from './categories';
import { LifePhoto, LifeTimeline } from './LifeTimeline';
import { FamilyDialog, MilestoneDialog, ProfileDialog, type MemberTarget, type MomentTarget } from './LifeDialogs';
import { LifeExportDialog } from './LifeExport';

/**
 * Life — the third view beside the timetable and the calendar: roots at the
 * top, then one line from birth through today into the plans ahead, and the
 * words to leave behind where the line ends.
 */
export function LifeView() {
  const api = useLife();
  const { life } = api;
  const { t } = useTranslation();
  const { prefs } = usePreferences();
  const pro = useAuth().plan === 'pro';
  const syncing = useSyncStatus().status !== 'disabled';
  const theme = COLOR_THEMES.some((th) => th.id === prefs.colorTheme) ? prefs.colorTheme : null;
  const colors = categoryColors(theme);
  const today = todayKey();
  useEffect(() => { trackOnce('life_open'); }, []);

  const [only, setOnly] = useState<Set<LifeCategory>>(() => new Set());
  const [filtering, setFiltering] = useState(false);
  const items = useMemo(() => buildTimeline(life, { today, only }), [life, today, only]);
  const summary = lifeSummary(life, today);

  const [moment, setMoment] = useState<MomentTarget | null>(null);
  const [member, setMember] = useState<MemberTarget | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [askParents, setAskParents] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bannerOff, setBannerOff] = useState(false);
  useEffect(() => {
    const open = () => setExporting(true);
    window.addEventListener(LIFE_EXPORT_EVENT, open);
    return () => window.removeEventListener(LIFE_EXPORT_EVENT, open);
  }, []);

  // The sticky year sits just under the app header, whatever its height.
  const [headerH, setHeaderH] = useState(56);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('[data-app-header]');
    if (!header) return;
    const measure = () => setHeaderH(header.getBoundingClientRect().height);
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(header);
    return () => ro?.disconnect();
  }, []);

  /** Open the add form — unless the free plan is full (nothing is lost). */
  const addMoment = (preset: Partial<MilestoneDraft>) => {
    if (!canAddMilestone(life, pro)) {
      toast(t('life.limit.moments', { n: String(FREE_LIFE_MILESTONES) }));
      requestUpgrade('life');
      return;
    }
    setMoment({ mode: 'add', preset });
  };
  const addMember = (relation: Relation) => {
    if (!canAddFamily(life, pro)) {
      toast(t('life.limit.family', { n: String(FREE_LIFE_FAMILY) }));
      requestUpgrade('life');
      return;
    }
    setMember({ mode: 'add', relation });
  };

  const warnBackup = !bannerOff && needsBackupWarning({ moments: life.milestones.length, syncing });
  const pinned = life.milestones.filter((m) => m.pinned);
  const jumpTo = (id: string) => {
    const card = document.querySelector<HTMLElement>(`[data-life-moment="${CSS.escape(id)}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col pb-16" data-life-view>
      <header className="mx-auto w-full max-w-[960px] px-4 pt-4 sm:pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{t('life.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('life.subtitle')}</p>
          </div>
          {isFullDate(life.profile.birthDate) && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="min-h-10 gap-1.5" aria-pressed={filtering} data-life-filter-toggle
                onClick={() => setFiltering((v) => !v)}>
                <ListFilter aria-hidden className="h-4 w-4" />
                {t('life.filter')}
                {only.size > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] leading-4 text-primary-foreground">{only.size}</span>}
              </Button>
              <Button variant="outline" size="sm" className="min-h-10 gap-1.5" data-life-export onClick={() => setExporting(true)}>
                <Download aria-hidden className="h-4 w-4" />
                {t('header.export')}
              </Button>
              <Button size="sm" className="min-h-10 gap-1.5 bg-primary text-primary-foreground" data-life-add onClick={() => addMoment({})}>
                <Plus aria-hidden className="h-4 w-4" />
                {t('life.add')}
              </Button>
            </div>
          )}
        </div>

        {isFullDate(life.profile.birthDate) && (
          <>
            <p className="mt-3 text-sm text-foreground/80" data-life-summary>
              {[
                t('life.sumRecords', { n: String(summary.records) }),
                t('life.sumPlans', { n: String(summary.plans) }),
                summary.age !== null ? t('life.sumAge', { n: String(summary.age) }) : null,
                summary.remaining !== null ? t('life.sumRemaining', { n: String(summary.remaining) }) : null,
              ].filter(Boolean).join(' · ')}
            </p>
            {pinned.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t('life.pinnedLabel')}>
                {pinned.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => jumpTo(m.id)} data-life-pinned
                      className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border bg-surface px-2.5 text-xs text-foreground hover:bg-accent/10">
                      <Pin aria-hidden className="h-3 w-3" style={{ color: inkOf(colors[m.category]) }} />
                      {m.title}
                      <span className="text-muted-foreground">{m.date.slice(0, 4)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {filtering && (
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t('life.filter')} data-life-filters>
                <button type="button" aria-pressed={only.size === 0} onClick={() => setOnly(new Set())}
                  className={chip(only.size === 0)}>
                  {t('life.filterAll')}
                </button>
                {PICKABLE_CATEGORIES.map((c) => {
                  const Icon = CATEGORY_ICON[c];
                  const on = only.has(c);
                  return (
                    <button key={c} type="button" aria-pressed={on} data-life-filter={c} className={chip(on)}
                      onClick={() => setOnly((prev) => {
                        const next = new Set(prev);
                        if (on) next.delete(c); else next.add(c);
                        return next;
                      })}>
                      <Icon aria-hidden className="h-3.5 w-3.5" style={{ color: inkOf(colors[c]) }} />
                      {t(CATEGORY_LABEL[c])}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-2 hidden text-xs text-muted-foreground sm:block">{t('life.addHint')}</p>
          </>
        )}

        {warnBackup && (
          <div role="status" data-life-backup-banner
            className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            <ShieldAlert aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
              <p className="min-w-0 flex-[1_1_16rem]">{t('life.backup.banner')}</p>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { void downloadLifeBackup(life); setBannerOff(true); }}>
                <Download aria-hidden className="h-4 w-4" />
                {t('life.backup.download')}
              </Button>
            </div>
            <button type="button" aria-label={t('common.close')} className="-my-1 grid h-9 w-9 shrink-0 place-items-center rounded-md hover:bg-black/5"
              onClick={() => { dismissBackupBanner(); setBannerOff(true); }}>
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      {!isFullDate(life.profile.birthDate) ? (
        <Onboarding onRestore={() => setExporting(true)} onStart={(birthDate, name) => {
          api.setProfile({ birthDate, ...(name ? { name } : {}) });
          setAskParents(true);
          track('life_add');
        }} />
      ) : (
        <>
          <Roots api={api} colors={colors} askParents={askParents} onSkip={() => setAskParents(false)}
            onAdd={addMember} onOpen={(f) => setMember({ mode: 'edit', f })} />
          <LifeTimeline life={life} items={items} colors={colors} stickyTop={headerH}
            showExamples={life.milestones.length === 0 && only.size === 0}
            onOpenMoment={(m) => setMoment({ mode: 'edit', m })}
            onOpenBirth={() => setProfileOpen(true)}
            onAdd={addMoment} />
          <EndingNote api={api} />
        </>
      )}

      <footer className="mx-auto mt-12 flex w-full max-w-[720px] flex-col gap-2 px-4 text-xs leading-relaxed text-muted-foreground" data-life-footer>
        <p>{t('life.footer.storage')}</p>
        <p>{t('life.footer.legal')}</p>
      </footer>

      <MilestoneDialog target={moment} pro={pro} colors={colors}
        onClose={() => setMoment(null)}
        onSave={(draft, id) => {
          if (id) api.updateMilestone(id, draft);
          else {
            api.addMilestone(draft);
            track('life_add');
          }
          setMoment(null);
        }}
        onDelete={(id) => { api.removeMilestone(id); setMoment(null); }} />
      <FamilyDialog target={member} pro={pro}
        onClose={() => setMember(null)}
        onSave={(draft, id, alsoMoment) => {
          if (id) api.updateMember(id, draft);
          else api.addMember(draft);
          if (alsoMoment && canAddMilestone(life, pro)) {
            api.addMilestone(draft.relation === 'spouse'
              ? { date: alsoMoment.date, title: t('life.family.marriedTitle', { name: draft.name }), category: 'relationship', isPlan: false }
              : { date: alsoMoment.date, title: t('life.family.childTitle', { name: draft.name }), category: 'family', isPlan: false });
          }
          if (draft.relation === 'mother' || draft.relation === 'father') {
            const has = (r: Relation) => r === draft.relation || life.family.some((f) => f.relation === r);
            if (has('mother') && has('father')) setAskParents(false);
          }
          setMember(null);
        }}
        onDelete={(id) => { api.removeMember(id); setMember(null); }} />
      <ProfileDialog open={profileOpen} profile={life.profile} onClose={() => setProfileOpen(false)}
        onSave={(p) => { api.setProfile({ name: p.name, birthDate: p.birthDate, lifeExpectancy: p.lifeExpectancy }); setProfileOpen(false); }} />
      <LifeExportDialog open={exporting} onOpenChange={setExporting} api={api} colors={colors} />
    </div>
  );
}

const chip = (on: boolean) =>
  `inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors ${
    on ? 'border-primary bg-primary/10 font-medium text-foreground' : 'border-border text-muted-foreground hover:bg-accent/10'}`;

/** First visit: the birthday is all the line needs to appear. */
function Onboarding({ onStart, onRestore }: { onStart: (birthDate: string, name: string) => void; onRestore: () => void }) {
  const { t } = useTranslation();
  const [birth, setBirth] = useState('');
  const [name, setName] = useState('');
  return (
    <section className="mx-auto mt-10 w-full max-w-md px-4" data-life-onboarding>
      <form className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-[0_4px_16px_rgba(0,0,0,.06)]"
        onSubmit={(e) => { e.preventDefault(); if (isFullDate(birth)) onStart(birth, name.trim()); }}>
        <span aria-hidden className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
          <Sprout className="h-5 w-5" />
        </span>
        <h3 className="text-xl font-bold text-foreground">{t('life.onboard.title')}</h3>
        <p className="-mt-2 text-sm text-muted-foreground">{t('life.onboard.hint')}</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('life.field.myBirth')}</span>
          <Input type="date" data-life-birth-input value={birth} min="1900-01-01" max={todayKey()} required
            onChange={(e) => setBirth(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('life.onboard.name')}</span>
          <Input value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} />
        </label>
        <Button type="submit" disabled={!isFullDate(birth)} data-life-start className="bg-primary text-primary-foreground">
          {t('life.onboard.start')}
        </Button>
        <button type="button" onClick={onRestore} data-life-restore
          className="-mt-1 self-center text-xs text-muted-foreground underline-offset-2 hover:underline">
          {t('life.onboard.restore')}
        </button>
      </form>
    </section>
  );
}

/** One family card. */
function MemberCard({ f, color, onOpen }: { f: FamilyMember; color: string; onOpen: () => void }) {
  const { t } = useTranslation();
  const today = todayKey();
  const age = f.birthDate && isFullDate(f.birthDate) ? ageAt(f.birthDate, today) : null;
  return (
    <button type="button" onClick={onOpen} data-life-member={f.relation}
      className="life-reveal flex w-full items-start gap-3 overflow-hidden rounded-2xl bg-surface p-4 text-left shadow-[0_4px_16px_rgba(0,0,0,.06)] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ borderTop: `4px solid ${color}` }}>
      {f.photo ? (
        <LifePhoto id={f.photo} className="h-12 w-12 shrink-0 rounded-full" />
      ) : (
        <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-bold text-white" style={{ backgroundColor: color }}>
          {f.name.slice(0, 1)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: inkOf(color) }}>{t(RELATION_LABEL[f.relation])}</span>
        <span className="mt-0.5 block truncate text-base font-bold text-foreground">{f.name}</span>
        {f.birthDate && (
          <span className="block text-xs text-muted-foreground">
            {formatLifeDate(f.birthDate)}{age ? ` · ${t('life.age', { n: String(age.years) })}` : ''}
          </span>
        )}
        {f.note && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{f.note}</span>}
      </span>
    </button>
  );
}

/** An empty parent slot, one tap from being filled. */
function EmptySlot({ label, onAdd, rel }: { label: string; onAdd: () => void; rel: Relation }) {
  return (
    <button type="button" onClick={onAdd} data-life-slot={rel}
      className="flex min-h-[84px] w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-border text-sm text-muted-foreground transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Plus aria-hidden className="h-4 w-4" />
      {label}
    </button>
  );
}

/**
 * Roots: the two parents as a pair (their two lines meet and become the
 * life line), then the rest of the family.
 */
function Roots({ api, colors, askParents, onSkip, onAdd, onOpen }: {
  api: LifeApi;
  colors: Record<LifeCategory, string>;
  askParents: boolean;
  onSkip: () => void;
  onAdd: (r: Relation) => void;
  onOpen: (f: FamilyMember) => void;
}) {
  const { t } = useTranslation();
  const { family } = api.life;
  const mother = family.find((f) => f.relation === 'mother');
  const father = family.find((f) => f.relation === 'father');
  const others = family.filter((f) => f !== mother && f !== father);
  const color = colors.family;
  return (
    <section aria-labelledby="life-roots" className="relative mx-auto mt-8 w-full max-w-[960px]" data-life-roots>
      <h3 id="life-roots" className="mb-3 ml-16 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground min-[900px]:ml-0 min-[900px]:text-center">
        {t('life.roots')}
      </h3>
      {askParents && (!mother || !father) && (
        <div className="mb-4 ml-16 mr-4 flex flex-wrap items-center gap-2 rounded-xl bg-primary/5 px-4 py-3 text-sm min-[900px]:mx-auto min-[900px]:max-w-xl" data-life-ask-parents>
          <span className="min-w-0 flex-1 font-medium text-foreground">{t('life.onboard.parents')}</span>
          <Button size="sm" variant="ghost" onClick={onSkip} data-life-skip>{t('life.onboard.skip')}</Button>
        </div>
      )}
      <div className="grid gap-3 ml-16 mr-4 min-[900px]:mx-0 min-[900px]:grid-cols-2 min-[900px]:gap-x-24">
        {mother ? <MemberCard f={mother} color={color} onOpen={() => onOpen(mother)} />
          : <EmptySlot rel="mother" label={t('life.addMother')} onAdd={() => onAdd('mother')} />}
        {father ? <MemberCard f={father} color={color} onOpen={() => onOpen(father)} />
          : <EmptySlot rel="father" label={t('life.addFather')} onAdd={() => onAdd('father')} />}
      </div>
      <div className="mt-3 ml-16 mr-4 flex flex-wrap items-stretch gap-3 min-[900px]:mx-0 min-[900px]:justify-center">
        {others.map((f) => (
          <div key={f.id} className="w-full min-[900px]:w-[280px]">
            <MemberCard f={f} color={color} onOpen={() => onOpen(f)} />
          </div>
        ))}
        <button type="button" onClick={() => onAdd('other')} data-life-add-family
          className="inline-flex min-h-10 items-center gap-1.5 self-center rounded-full border border-border px-3 text-xs text-muted-foreground hover:bg-accent/10">
          <Plus aria-hidden className="h-3.5 w-3.5" />
          {t('life.family.more')}
        </button>
      </div>
      {/* The parents' two lines meet and become the life line (wide screens);
          on a phone the line simply starts here. */}
      <svg aria-hidden viewBox="0 0 100 56" preserveAspectRatio="none" className="mt-2 hidden h-14 w-full min-[900px]:block">
        <path d="M25 0 C25 34 50 22 50 56 M75 0 C75 34 50 22 50 56" fill="none" stroke="hsl(var(--border))" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div aria-hidden className="relative h-6 min-[900px]:hidden"><span className="life-line" /></div>
    </section>
  );
}

/** Where the line ends: one wide card for the words to leave behind. */
function EndingNote({ api }: { api: LifeApi }) {
  const { t, lang } = useTranslation();
  const note = api.life.endingNote;
  const [text, setText] = useState(note?.text ?? '');
  // Typing saves after a short pause, and at once when the field is left.
  const pending = useRef<number | null>(null);
  const latest = useRef(text);
  const commit = () => {
    if (pending.current !== null) window.clearTimeout(pending.current);
    pending.current = null;
    if ((api.life.endingNote?.text ?? '') !== latest.current) api.setEndingNote(latest.current);
  };
  const commitRef = useRef(commit);
  useEffect(() => { commitRef.current = commit; });
  useEffect(() => () => commitRef.current(), []);
  const updated = note?.updatedAt ? new Date(note.updatedAt) : null;
  return (
    <section aria-labelledby="life-ending" className="mx-auto w-full max-w-[960px]" data-life-ending>
      <div aria-hidden className="relative h-10"><span className="life-line life-line--future" /></div>
      <div aria-hidden className="relative h-3">
        <span className="absolute left-[28px] top-0 h-3 w-3 -translate-x-1/2 rounded-full bg-border min-[900px]:left-1/2" />
      </div>
      <div className="mx-4 mt-6 rounded-2xl bg-surface p-6 shadow-[0_4px_16px_rgba(0,0,0,.06)] min-[900px]:mx-auto min-[900px]:max-w-[640px]">
        <h3 id="life-ending" className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Feather aria-hidden className="h-5 w-5 text-primary" />
          {t('life.endingNote')}
        </h3>
        <textarea data-life-ending-input value={text} maxLength={MAX_ENDING} aria-labelledby="life-ending"
          placeholder={t('life.ending.placeholder')}
          onChange={(e) => {
            setText(e.target.value);
            latest.current = e.target.value;
            if (pending.current !== null) window.clearTimeout(pending.current);
            pending.current = window.setTimeout(commit, 600);
          }}
          onBlur={commit}
          className="mt-3 min-h-40 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed [field-sizing:content] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        {updated && (
          <p className="mt-2 text-xs text-muted-foreground" data-life-ending-updated>
            {t('life.ending.updated', { date: updated.toLocaleDateString(lang) })}
          </p>
        )}
        <p className="mt-4 flex gap-2 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground" data-life-ending-legal>
          <Scale aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {t('life.ending.legal')}
        </p>
      </div>
    </section>
  );
}
