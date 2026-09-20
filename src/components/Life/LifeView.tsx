import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, Feather, ListFilter, Pin, Plus, ShieldAlert, Smile, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { useSyncStatus } from '@/hooks/useSync';
import { useLife, UNDO_MS, type LifeApi, type MilestoneDraft } from '@/hooks/useLife';
import { COLOR_THEMES } from '@/data/color-themes';
import { requestUpgrade } from '@/lib/pro';
import { todayKey } from '@/lib/calendar-grid';
import { track, trackOnce } from '@/lib/track';
import {
  FREE_LIFE_MILESTONES, MAX_ENDING, MAX_NAME, PICKABLE_CATEGORIES, ageAt, buildTimeline,
  canAddMilestone, formatLifeDate, isFullDate, lifeSummary,
  type FamilyMember, type LifeCategory,
} from '@/lib/life';
import { dismissBackupBanner, downloadLifeBackup, needsBackupWarning } from '@/lib/life-backup';
import { useLifeNudge } from '@/hooks/useLifeNudge';
import { LIFE_EXPORT_EVENT } from '@/lib/life-export';
import { CATEGORY_ICON, CATEGORY_LABEL, RELATION_LABEL, categoryColors, inkOf } from './categories';
import { LifePhoto, LifeTimeline } from './LifeTimeline';
import { FamilyDialog, MilestoneDialog, ProfileDialog, type MemberTarget, type MomentTarget } from './LifeDialogs';
import { LifeExportDialog } from './LifeExport';
import { LifeMemoir } from './LifeMemoir';
import { DecorTray } from '@/components/Calendar/Decor';
import { DecorStoreProvider } from '@/hooks/useDecor';
import { useLifeDecor } from '@/hooks/useLifeDecor';
import { LifeRowDecor, type LifeArmed, type LifePicked } from './LifeDecor';
import { LIFE_REQUEST_EVENT, takeLifeRequest } from '@/lib/life-requests';
import type { DecorTool } from '@/components/Calendar/decor-tools';
import type { TKey } from '@/i18n/translations';

type Parent = 'mother' | 'father';

/**
 * Life — the third view beside the timetable and the calendar: the parents at
 * the top, then one line from birth through today into the plans ahead, and
 * the words to leave behind where the line ends. Nothing else is said on the
 * page: export lives in the app header, adding happens on the line itself,
 * and the corner holds two round buttons — decorate, then filter.
 */
export function LifeView() {
  const api = useLife();
  const { life } = api;
  const { t, lang } = useTranslation();
  const { prefs } = usePreferences();
  const pro = useAuth().plan === 'pro';
  const syncing = useSyncStatus().status !== 'disabled';
  const theme = COLOR_THEMES.some((th) => th.id === prefs.colorTheme) ? prefs.colorTheme : null;
  const colors = categoryColors(theme);
  const today = todayKey();
  useEffect(() => { trackOnce('life_open'); }, []);
  // The page ends where the life ends: no site footer or reading copy below
  // it while it shows (the home page keeps both).
  useEffect(() => {
    document.documentElement.setAttribute('data-page', 'life');
    return () => document.documentElement.removeAttribute('data-page');
  }, []);

  const [only, setOnly] = useState<Set<LifeCategory>>(() => new Set());
  const items = useMemo(() => buildTimeline(life, { today, only }), [life, today, only]);
  const summary = lifeSummary(life, today);

  const [moment, setMoment] = useState<MomentTarget | null>(null);
  const [member, setMember] = useState<MemberTarget | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bannerOff, setBannerOff] = useState(false);
  // A plan coming up, or a year with nothing written in it yet.
  const { nudge, dismiss } = useLifeNudge();

  // 다꾸: stickers, tape and photos over the line (Pro). The 디자인 menu asks
  // for a tool; the tray and the layer are the calendar's own.
  const decorStore = useLifeDecor();
  const [decorTool, setDecorTool] = useState<DecorTool | null>(null);
  const [armed, setArmed] = useState<LifeArmed | null>(null);
  const [chosen, setChosen] = useState<LifePicked | null>(null);
  const decorating = decorTool !== null || armed !== null || chosen !== null;
  useEffect(() => {
    const take = () => {
      const req = takeLifeRequest();
      if (!req) return;
      if (!pro) return requestUpgrade('life');
      setDecorTool(req.tool);
      setArmed(null);
    };
    take();
    window.addEventListener(LIFE_REQUEST_EVENT, take);
    return () => window.removeEventListener(LIFE_REQUEST_EVENT, take);
  }, [pro]);
  const closeDecor = () => { setDecorTool(null); setArmed(null); setChosen(null); };
  const chosenItem = chosen ? decorStore.rows[chosen.row]?.find((i) => i.id === chosen.id) : undefined;
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

  const hasLine = isFullDate(life.profile.birthDate);
  const warnBackup = !bannerOff && needsBackupWarning({ moments: life.milestones.length, syncing });
  const pinned = life.milestones.filter((m) => m.pinned);
  const jumpTo = (id: string) => {
    const card = document.querySelector<HTMLElement>(`[data-life-moment="${CSS.escape(id)}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col pb-24" data-life-view>
      <header className="mx-auto w-full max-w-[960px] px-4 pt-4 text-center sm:pt-6">
        {/* The tab that was just pressed says which page this is; the heading
            stays for a screen reader, which has no tabs to look at. */}
        <h2 className="sr-only">{t('life.title')}</h2>
        {hasLine && (
          <>
            <p className="mt-2 text-[15px] italic text-muted-foreground" data-life-summary>
              {[
                t('life.sumRecords', { n: String(summary.records) }),
                t('life.sumPlans', { n: String(summary.plans) }),
                summary.age !== null ? t('life.sumAge', { n: String(summary.age) }) : null,
              ].filter(Boolean).join(' · ')}
            </p>
            {pinned.length > 0 && (
              <ul className="mt-3 flex flex-wrap justify-center gap-1.5" aria-label={t('life.pinnedLabel')}>
                {pinned.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => jumpTo(m.id)} data-life-pinned
                      className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border px-2.5 text-xs text-foreground hover:bg-accent/10">
                      <Pin aria-hidden className="h-3 w-3" style={{ color: inkOf(colors[m.category]) }} />
                      {m.title}
                      <span className="text-muted-foreground">{m.date.slice(0, 4)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {hasLine && nudge && (
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[15px] italic text-foreground/80" data-life-nudge={nudge.kind}>
            <span>
              {nudge.kind === 'plan'
                ? t('life.nudge.plan', { title: nudge.moment.title })
                : t('life.nudge.review', { year: String(nudge.year) })}
            </span>
            <button type="button" data-life-nudge-go className="not-italic text-primary underline decoration-1 underline-offset-4"
              onClick={() => {
                if (nudge.kind === 'plan') jumpTo(nudge.moment.id);
                else addMoment({ date: String(nudge.year) });
                dismiss(nudge.key);
              }}>
              {t(nudge.kind === 'plan' ? 'life.nudge.see' : 'life.nudge.write')}
            </button>
            <button type="button" aria-label={t('common.close')} data-life-nudge-close
              className="not-italic text-muted-foreground hover:text-foreground" onClick={() => dismiss(nudge.key)}>
              <X aria-hidden className="h-4 w-4" />
            </button>
          </p>
        )}
        {api.readOnly && (
          <p role="status" data-life-newer
            className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left text-sm text-foreground">
            {t('life.newerVersion')}
          </p>
        )}
        {warnBackup && (
          <div role="status" data-life-backup-banner
            className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            <ShieldAlert aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
              <p className="min-w-0 flex-[1_1_16rem]">{t('life.backup.banner')}</p>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { void downloadLifeBackup(life, decorStore.rows); setBannerOff(true); }}>
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

      {!hasLine ? (
        <Onboarding onStart={(birthDate, name) => {
          api.setProfile({ birthDate, ...(name ? { name } : {}) });
          track('life_start');
        }} />
      ) : (
        // A record from a newer app version is shown, never edited here.
        <div className="contents" inert={api.readOnly || undefined}>
          <Parents family={life.family}
            onAdd={(relation) => setMember({ mode: 'add', relation })}
            onOpen={(f) => setMember({ mode: 'edit', f })} />
          {life.milestones.length === 0 && only.size === 0 && <QuickStart birth={life.profile.birthDate} onAdd={api.addMilestone} />}
          <LifeTimeline life={life} items={items} colors={colors} stickyTop={headerH}
            decorating={decorating}
            rowDecor={(row) => (
              <LifeRowDecor row={row} store={decorStore} active={decorating} armed={armed}
                selected={chosen} onSelect={setChosen} onPlaced={setChosen} />
            )}
            onOpenMoment={(m) => setMoment({ mode: 'edit', m })}
            onOpenBirth={() => setProfileOpen(true)}
            onAdd={addMoment} />
          {/* A restore replaces the note: start its field afresh from it. */}
          <EndingNote key={api.generation} api={api} />
          <LifeMemoir api={api} lang={lang} />
          <FilterFab only={only} setOnly={setOnly} colors={colors}
            decorating={decorating}
            onDecor={() => {
              if (decorating) return closeDecor();
              if (!pro) return requestUpgrade('life');
              setDecorTool('sticker');
              track('decor_tool', { tool: 'sticker' });
            }} />
        </div>
      )}

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
        onDelete={(id) => {
          const gone = api.removeMilestone(id);
          setMoment(null);
          if (gone) {
            toast(t('life.deleted'), { action: { label: t('sync.undo'), onClick: () => api.restoreMilestone(gone.item, gone.at) }, duration: UNDO_MS });
          }
        }} />
      <FamilyDialog target={member} pro={pro}
        onClose={() => setMember(null)}
        onSave={(draft, id) => {
          if (id) api.updateMember(id, draft);
          else api.addMember(draft);
          setMember(null);
        }}
        onDelete={(id) => {
          const gone = api.removeMember(id);
          setMember(null);
          if (gone) {
            toast(t('life.deleted'), { action: { label: t('sync.undo'), onClick: () => api.restoreMember(gone.item, gone.at) }, duration: UNDO_MS });
          }
        }} />
      <ProfileDialog open={profileOpen} profile={life.profile} onClose={() => setProfileOpen(false)}
        onSave={(p) => { api.setProfile({ name: p.name, birthDate: p.birthDate }); setProfileOpen(false); }} />
      <LifeExportDialog open={exporting} onOpenChange={setExporting} api={api} colors={colors} decor={decorStore} />
      {decorating && (
        <DecorStoreProvider value={decorStore}>
          <p className="pointer-events-none fixed inset-x-0 top-16 z-40 text-center text-xs italic text-muted-foreground" data-life-decor-on>
            {t('life.decorOn')}
          </p>
          <DecorTray tool={decorTool} armed={armed} onArm={setArmed} onClose={closeDecor}
            selected={chosen && chosenItem ? { month: chosen.row, item: chosenItem } : null} />
        </DecorStoreProvider>
      )}
    </div>
  );
}

/**
 * The corner: decorate on the left, filter on the right.
 *
 * The filter is the loud one — it changes what the page shows — so it keeps
 * the solid circle, and decorating sits beside it in outline. Pressed, the
 * categories unfold upward from the filter; any number can be on at once.
 */
function FilterFab({ only, setOnly, colors, decorating, onDecor }: {
  only: Set<LifeCategory>;
  setOnly: (fn: (prev: Set<LifeCategory>) => Set<LifeCategory>) => void;
  colors: Record<LifeCategory, string>;
  decorating: boolean;
  onDecor: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const chip = (on: boolean) =>
    `life-pop inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm shadow-md transition-colors ${
      on ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-foreground hover:bg-accent/10'}`;
  return (
    <div ref={ref} data-life-filter-fab
      className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-[calc(1.25rem+env(safe-area-inset-right))] z-40 flex items-end gap-2.5">
      <button type="button" aria-pressed={decorating} data-life-decor-fab
        aria-label={t('decor.lifeMenu')} title={t('decor.lifeMenu')} onClick={onDecor}
        className={`grid h-14 w-14 place-items-center rounded-full border shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          decorating ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-foreground'}`}>
        {decorating ? <X aria-hidden className="h-5 w-5" /> : <Smile aria-hidden className="h-5 w-5" />}
      </button>
      <div className="flex flex-col items-end gap-2">
      {open && (
        <div role="group" aria-label={t('life.filter')} data-life-filters className="flex flex-col items-end gap-2">
          <button type="button" aria-pressed={only.size === 0} onClick={() => setOnly(() => new Set())}
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
                <Icon aria-hidden className="h-4 w-4" style={on ? undefined : { color: inkOf(colors[c]) }} />
                {t(CATEGORY_LABEL[c])}
              </button>
            );
          })}
        </div>
      )}
      <button type="button" aria-expanded={open} aria-label={t('life.filter')} title={t('life.filter')} data-life-filter-toggle
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-14 w-14 place-items-center rounded-full bg-foreground text-background shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {open ? <X aria-hidden className="h-5 w-5" /> : <ListFilter aria-hidden className="h-5 w-5" />}
        {only.size > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
            {only.size}
          </span>
        )}
      </button>
      </div>
    </div>
  );
}

/**
 * An empty line is hard to start: these are the moments most lives have, at
 * the age they usually happen. Picking a few fills the line in one go, and
 * each one can be opened and corrected afterwards (the years are guesses).
 */
const QUICK: ReadonlyArray<{ key: TKey; category: LifeCategory; age: number }> = [
  { key: 'life.quick.school', category: 'education', age: 7 },
  { key: 'life.quick.middle', category: 'education', age: 13 },
  { key: 'life.quick.high', category: 'education', age: 16 },
  { key: 'life.quick.college', category: 'education', age: 19 },
  { key: 'life.quick.trip', category: 'travel', age: 22 },
  { key: 'life.quick.job', category: 'career', age: 25 },
  { key: 'life.quick.move', category: 'home', age: 28 },
  { key: 'life.quick.wedding', category: 'relationship', age: 31 },
  { key: 'life.quick.child', category: 'family', age: 33 },
  { key: 'life.quick.retire', category: 'career', age: 60 },
];

function QuickStart({ birth, onAdd }: { birth: string; onAdd: (draft: MilestoneDraft) => void }) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const birthYear = Number(birth.slice(0, 4));
  return (
    <section className="mx-auto mt-10 w-full max-w-[640px] px-4 text-center" data-life-quick>
      <h3 className="life-serif text-[15px] font-bold text-muted-foreground">{t('life.quick.title')}</h3>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {QUICK.map((q) => {
          const on = picked.has(q.key);
          const Icon = CATEGORY_ICON[q.category];
          return (
            <button key={q.key} type="button" aria-pressed={on} data-life-quick-item={q.key}
              onClick={() => setPicked((prev) => {
                const next = new Set(prev);
                if (on) next.delete(q.key); else next.add(q.key);
                return next;
              })}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors ${
                on ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-accent/10'}`}>
              <Icon aria-hidden className="h-4 w-4" />
              {t(q.key)}
            </button>
          );
        })}
      </div>
      <Button className="mt-5 bg-primary text-primary-foreground" disabled={picked.size === 0} data-life-quick-add
        onClick={() => {
          QUICK.filter((q) => picked.has(q.key)).forEach((q) => {
            onAdd({ date: String(birthYear + q.age), title: t(q.key), category: q.category });
          });
          track('life_add');
        }}>
        {t('life.quick.add', { n: String(picked.size) })}
      </Button>
    </section>
  );
}

/** First visit: the birthday is all the line needs to appear. */
function Onboarding({ onStart }: { onStart: (birthDate: string, name: string) => void }) {
  const { t } = useTranslation();
  const [birth, setBirth] = useState('');
  const [name, setName] = useState('');
  return (
    <section className="mx-auto mt-10 w-full max-w-md px-4" data-life-onboarding>
      <form className="flex flex-col gap-4"
        onSubmit={(e) => { e.preventDefault(); if (isFullDate(birth)) onStart(birth, name.trim()); }}>
        <h3 className="life-serif text-2xl font-bold tracking-tight text-foreground">{t('life.onboard.title')}</h3>
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
      </form>
    </section>
  );
}

/** One parent, as plain text like the entries on the line. */
function MemberBlock({ f, onOpen }: { f: FamilyMember; onOpen: () => void }) {
  const { t } = useTranslation();
  const age = f.birthDate && isFullDate(f.birthDate) ? ageAt(f.birthDate, todayKey()) : null;
  return (
    <button type="button" onClick={onOpen} data-life-member={f.relation}
      className="group relative block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[900px]:text-center">
      <span className="block text-[15px] italic leading-[22px] text-muted-foreground">{t(RELATION_LABEL[f.relation])}</span>
      <span className="life-serif mt-1 block truncate text-[22px] font-bold leading-8 tracking-tight text-foreground decoration-1 underline-offset-[6px] group-hover:underline">{f.name}</span>
      {f.birthDate && (
        <span className="mt-1 block text-[15px] text-foreground/75">
          {formatLifeDate(f.birthDate)}{age ? ` · ${t('life.age', { n: String(age.years) })}` : ''}
        </span>
      )}
      {f.note && <span className="mt-1 line-clamp-2 block text-[15px] leading-relaxed text-foreground/75">{f.note}</span>}
      {f.photo && <LifePhoto id={f.photo} className="mt-3 h-16 w-16 rounded-full min-[900px]:mx-auto" />}
    </button>
  );
}

/** An empty parent place, one tap from being filled. */
function EmptySlot({ label, onAdd, rel }: { label: string; onAdd: () => void; rel: Parent }) {
  return (
    <button type="button" onClick={onAdd} data-life-slot={rel}
      className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg text-[15px] italic text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[900px]:self-center">
      <Plus aria-hidden className="h-4 w-4 not-italic" />
      {label}
    </button>
  );
}

/** A hollow marker: on the phone's left line, or under a parent on wide screens. */
const ringClass = (dashed: boolean) =>
  `h-[26px] w-[26px] rounded-full border-2 bg-background ${dashed ? 'border-dashed border-foreground/40' : 'border-foreground'}`;

/**
 * The parents side by side, each above a marker of their own, and their two
 * lines meet to become the life line. (Other relatives an older version may
 * have stored are kept in the record — and in backups — just not shown.)
 */
function Parents({ family, onAdd, onOpen }: {
  family: FamilyMember[];
  onAdd: (r: Parent) => void;
  onOpen: (f: FamilyMember) => void;
}) {
  const { t } = useTranslation();
  const parent = (rel: Parent) => {
    const f = family.find((m) => m.relation === rel);
    return (
      <div className="relative flex flex-col min-[900px]:items-center min-[900px]:px-12">
        {/* Phone: this parent's marker on the left line. */}
        <span aria-hidden className={`absolute -left-9 top-[29px] -translate-x-1/2 min-[900px]:hidden ${ringClass(!f)}`} />
        {f ? <MemberBlock f={f} onOpen={() => onOpen(f)} />
          : <EmptySlot rel={rel} label={t(rel === 'mother' ? 'life.addMother' : 'life.addFather')} onAdd={() => onAdd(rel)} />}
        {/* Wide screens: the parent's marker, level with the other's. */}
        <span aria-hidden className={`mt-auto hidden pt-5 min-[900px]:block`}>
          <span className={`block ${ringClass(!f)}`} />
        </span>
      </div>
    );
  };
  return (
    <section aria-label={t('life.roots')} className="relative mx-auto mt-10 w-full max-w-[960px]" data-life-roots>
      {/* Phone: the line runs down from the first parent to the birth. */}
      <span aria-hidden className="life-line min-[900px]:hidden" style={{ top: 42 }} />
      <div className="ml-16 mr-4 grid gap-8 min-[900px]:mx-0 min-[900px]:grid-cols-2 min-[900px]:gap-0">
        {parent('mother')}
        {parent('father')}
      </div>
      {/* The parents' two lines meet and become the life line. */}
      <svg aria-hidden viewBox="0 0 100 56" preserveAspectRatio="none" className="hidden h-14 w-full min-[900px]:block">
        <path d="M25 0 C25 34 50 22 50 56 M75 0 C75 34 50 22 50 56" fill="none" stroke="hsl(var(--foreground) / 0.85)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </section>
  );
}

/** Where the line ends: the words to leave behind. */
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
  // Leaving the life page, closing the tab or switching away saves what was
  // typed (setEndingNote writes at once, so no render has to follow).
  useEffect(() => {
    const flush = () => commitRef.current();
    const hidden = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
      flush();
    };
  }, []);
  const updated = note?.updatedAt ? new Date(note.updatedAt) : null;
  return (
    <section aria-labelledby="life-ending" className="mx-auto w-full max-w-[960px]" data-life-ending>
      <div aria-hidden className="relative h-12"><span className="life-line life-line--future" /></div>
      {/* The line ends here, in a small closed circle. */}
      <div aria-hidden className="relative h-3">
        <span className="absolute left-[28px] top-0 h-3 w-3 -translate-x-1/2 rounded-full bg-foreground/60 min-[900px]:left-1/2" />
      </div>
      <div className="mx-4 mt-10 max-w-[640px] min-[900px]:mx-auto">
        <h3 id="life-ending" className="life-serif flex items-center justify-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Feather aria-hidden className="h-5 w-5 text-muted-foreground" />
          {t('life.endingNote')}
        </h3>
        <textarea data-life-ending-input value={text} maxLength={MAX_ENDING} aria-labelledby="life-ending"
          onChange={(e) => {
            setText(e.target.value);
            latest.current = e.target.value;
            if (pending.current !== null) window.clearTimeout(pending.current);
            pending.current = window.setTimeout(commit, 600);
          }}
          onBlur={commit}
          className="mt-5 min-h-40 w-full resize-y rounded-lg border border-border bg-transparent px-4 py-3 text-[15px] leading-relaxed [field-sizing:content] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        {updated && (
          <p className="mt-2 text-center text-[13px] italic text-muted-foreground" data-life-ending-updated>
            {t('life.ending.updated', { date: updated.toLocaleDateString(lang) })}
          </p>
        )}
      </div>
    </section>
  );
}
