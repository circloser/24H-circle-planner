import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { dismissAfterVisible } from '@/lib/toast-dismiss';
import { Download, Feather, ListFilter, Pin, ShieldAlert, Smile, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { useSyncStatus } from '@/hooks/useSync';
import { useLife, UNDO_MS, type LifeApi, type MilestoneDraft } from '@/hooks/useLife';
import { COLOR_THEMES } from '@/data/color-themes';
import { requestUpgrade } from '@/lib/pro';
import { todayKey } from '@/lib/calendar-grid';
import { track, trackFeature, trackOnce } from '@/lib/track';
import {
  FREE_LIFE_LINES, FREE_LIFE_MILESTONES, MAX_ENDING, MAX_LIFE_LINES, MAX_NAME, PICKABLE_CATEGORIES,
  canAddMilestone, isFullDate, lifeSummary,
  type LifeCategory,
} from '@/lib/life';
import { dismissBackupBanner, downloadLifeBackup, needsBackupWarning } from '@/lib/life-backup';
import { useLifeNudge } from '@/hooks/useLifeNudge';
import { LIFE_EXPORT_EVENT } from '@/lib/life-export';
import { CATEGORY_ICON, CATEGORY_LABEL, categoryColors, inkOf } from './categories';
import {
  LineDialog, MilestoneDialog, ProfileDialog,
  type LineTarget, type MomentTarget,
} from './LifeDialogs';
import { LifeBoard } from './LifeBoard';
import { LifeExportDialog } from './LifeExport';
import { LifeMemoir } from './LifeMemoir';
import { DecorTray } from '@/components/Calendar/Decor';
import { DecorStoreProvider } from '@/hooks/useDecor';
import { useLifeDecor } from '@/hooks/useLifeDecor';
import { LifeRowDecor, type LifeArmed, type LifePicked } from './LifeDecor';
import { LIFE_REQUEST_EVENT, takeLifeRequest } from '@/lib/life-requests';
import type { DecorTool } from '@/components/Calendar/decor-tools';
import type { TKey } from '@/i18n/translations';

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
  const summary = lifeSummary(life, today);

  const [moment, setMoment] = useState<MomentTarget | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  // Who is drawn beside me. Folding somebody away is a way of looking, not a
  // fact about them, so it is kept here rather than in the record; `chosenLine`
  // is the one other line a phone has room for.
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(() => new Set());
  const [chosenLine, setChosenLine] = useState<string | null>(null);
  const [lineTarget, setLineTarget] = useState<LineTarget | null>(null);
  /** Which line a moment is being added to or edited on; '' is my own. */
  const [onLine, setOnLine] = useState('');
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

  /**
   * Another life beside this one. Two are free — mine and one other — and Pro
   * holds ten; the limit only ever stops ADDING another.
   */
  const addLine = () => {
    const lines = 1 + (life.others?.length ?? 0);
    if (lines >= MAX_LIFE_LINES) return toast(t('life.parallel.limit'));
    if (!pro && lines >= FREE_LIFE_LINES) {
      toast(t('life.parallel.limit'));
      requestUpgrade('life');
      return;
    }
    trackFeature('life_line');
    setLineTarget({ mode: 'add' });
  };

  /** Somebody else's line, opened to be renamed, re-dated or taken away. */
  const openLine = (id: string) => {
    const line = (life.others ?? []).find((o) => o.id === id);
    if (line) setLineTarget({ mode: 'edit', line });
  };

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
          {life.milestones.length === 0 && only.size === 0 && <QuickStart birth={life.profile.birthDate} onAdd={api.addMilestone} />}
          {/* My line, and the lives it was lived among — every one of them the
              same drawing, standing side by side. */}
          <LifeBoard
            life={life}
            colors={colors}
            today={today}
            only={only}
            meLabel={t('relation.me.short')}
            hidden={hiddenLines}
            chosen={chosenLine}
            decorating={decorating}
            rowDecor={(row) => (
              <LifeRowDecor row={row} store={decorStore} active={decorating} armed={armed}
                selected={chosen} onSelect={setChosen} onPlaced={setChosen} />
            )}
            onChoose={setChosenLine}
            onToggle={(id) => setHiddenLines((was) => {
              const next = new Set(was);
              if (!next.delete(id)) next.add(id);
              return next;
            })}
            onAddLine={addLine}
            onOpenLine={openLine}
            onOpenMoment={(lineId, m) => {
              setOnLine(lineId === 'me' ? '' : lineId);
              setMoment({ mode: 'edit', m });
            }}
            onOpenBirth={(lineId) => (lineId === 'me' ? setProfileOpen(true) : openLine(lineId))}
            onAdd={(lineId, preset) => {
              if (lineId === 'me') return addMoment(preset);
              setOnLine(lineId);
              setMoment({ mode: 'add', preset });
            }} />

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
        onClose={() => { setMoment(null); setOnLine(''); }}
        onSave={(draft, id) => {
          // The same form writes to whichever life it was opened from.
          if (onLine) {
            if (id) api.updateLineMoment(onLine, id, draft);
            else api.addLineMoment(onLine, draft);
          } else if (id) {
            api.updateMilestone(id, draft);
          } else {
            api.addMilestone(draft);
            track('life_add');
          }
          setMoment(null);
          setOnLine('');
        }}
        onDelete={(id) => {
          if (onLine) {
            api.removeLineMoment(onLine, id);
            setMoment(null);
            setOnLine('');
            return;
          }
          const gone = api.removeMilestone(id);
          setMoment(null);
          if (gone) {
            dismissAfterVisible(toast(t('life.deleted'), { action: { label: t('sync.undo'), onClick: () => api.restoreMilestone(gone.item, gone.at) }, duration: UNDO_MS }), UNDO_MS);
          }
        }} />
      <LineDialog target={lineTarget}
        onClose={() => setLineTarget(null)}
        onSave={(name, birthDate, id) => {
          if (id) api.updateLine(id, { name, birthDate });
          else api.addLine(name, birthDate);
          setLineTarget(null);
        }}
        onDelete={(id) => {
          const gone = api.removeLine(id);
          setLineTarget(null);
          if (gone) {
            dismissAfterVisible(toast(t('life.deleted'), { action: { label: t('sync.undo'), onClick: () => api.restoreLine(gone.item, gone.at) }, duration: UNDO_MS }), UNDO_MS);
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
