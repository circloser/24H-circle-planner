import { useRef, useState, type ChangeEvent } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { toast } from 'sonner';
import { fireNotification, fireSliceAlarmPopup } from '@/lib/notify';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  usePreferences,
  useTranslation,
  FONT_FAMILIES,
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
  FONT_SCALE_STEP,
  BACKGROUNDS,
  GRADIENT_PRESETS,
  NOW_LINE_DEFAULT_COLOR,
  SNAP_STEPS,
  RING_INNER_MIN,
  RING_INNER_MAX,
  type Background,
  type WorldClock,
} from '@/hooks/usePreferences';
import { fileToBackgroundDataUrl } from '@/lib/image-bg';
import { useAuth } from '@/hooks/useAuth';
import { requestUpgrade } from '@/lib/pro';
import { enablePush, disablePush, pushSupported, sendTestPush } from '@/lib/push';
import { AdSlot } from '@/components/Ads/AdSlot';
import { useStoreDispatch } from '@/hooks/useScheduleStore';
import { COLOR_THEMES } from '@/data/color-themes';
import { TIMEZONES, WORLD_LINE_COLORS } from '@/data/timezones';
import { LANGUAGES, type Lang } from '@/i18n/translations';
import type { TKey } from '@/i18n/translations';

/** Each settings category is its own focused dialog, opened from the gear menu. */
export type SettingsSection = 'language' | 'font' | 'icons' | 'timeline' | 'background' | 'theme';

export interface SettingsDialogProps {
  section: SettingsSection | null;
  onClose: () => void;
}

const SECTION_TITLE: Record<SettingsSection, TKey> = {
  language: 'settings.language',
  font: 'settings.font',
  icons: 'settings.icons',
  timeline: 'settings.timeline',
  background: 'settings.background',
  theme: 'settings.colorTheme',
};

const BG_LABEL: Record<Background, TKey> = {
  none: 'bg.none',
  dots: 'bg.dots',
  grid: 'bg.grid',
  diagonal: 'bg.diagonal',
  paper: 'bg.paper',
  checker: 'bg.checker',
  waves: 'bg.waves',
  memo: 'bg.memo',
};

// Selection highlight is driven by aria-pressed via the shared `.opt-chip` CSS.
const OPT_CHIP = 'opt-chip px-3 py-1.5 rounded-md text-sm';

export function SettingsDialog({ section, onClose }: SettingsDialogProps) {
  const { prefs, setPreference } = usePreferences();
  const { plan } = useAuth();
  const { t, lang } = useTranslation();
  const dispatch = useStoreDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tzToAdd, setTzToAdd] = useState(TIMEZONES[0].tz);

  // Permission-denied guidance depends on how the app is running: an installed
  // PWA / Android TWA has NO address bar, so "site settings next to the address
  // bar" is impossible there — point those users at the OS app-notification
  // settings instead.
  const permDeniedMsg = (): string => {
    const standalone =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches === true ||
        (window.navigator as { standalone?: boolean }).standalone === true);
    return t(standalone ? 'settings.alarmPermDeniedApp' : 'settings.alarmPermDenied');
  };

  const addWorldClock = () => {
    const opt = TIMEZONES.find((z) => z.tz === tzToAdd);
    if (!opt) return;
    const color = WORLD_LINE_COLORS[prefs.worldClocks.length % WORLD_LINE_COLORS.length];
    const wc: WorldClock = { id: uuid(), tz: opt.tz, label: lang === 'ko' ? opt.ko : opt.en, color };
    setPreference('worldClocks', [...prefs.worldClocks, wc]);
  };
  const updateWorldClock = (id: string, patch: Partial<WorldClock>) =>
    setPreference('worldClocks', prefs.worldClocks.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  const removeWorldClock = (id: string) =>
    setPreference('worldClocks', prefs.worldClocks.filter((w) => w.id !== id));

  const selectPattern = (bg: Background) => {
    setPreference('background', bg);
    setPreference('bgType', 'pattern');
  };

  const selectColor = (hex: string) => {
    setPreference('bgColor', hex);
    setPreference('bgType', 'color');
  };

  const selectGradientPreset = (p: (typeof GRADIENT_PRESETS)[number]) => {
    setPreference('gradient', { from: p.from, via: p.via, to: p.to, angle: p.angle });
    setPreference('bgType', 'gradient');
  };
  const setGradientStop = (stop: 'from' | 'via' | 'to', hex: string) => {
    setPreference('gradient', { ...prefs.gradient, [stop]: hex });
    setPreference('bgType', 'gradient');
  };
  const setGradientAngle = (angle: number) => {
    setPreference('gradient', { ...prefs.gradient, angle });
    setPreference('bgType', 'gradient');
  };
  // CSS gradient angle: 0°=up, increasing clockwise. Arrow points toward the end colour.
  const GRAD_DIRECTIONS = [
    [0, '↑'], [45, '↗'], [90, '→'], [135, '↘'],
    [180, '↓'], [225, '↙'], [270, '←'], [315, '↖'],
  ] as const;

  const onImagePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file later
    if (!file) return;
    try {
      const dataUrl = await fileToBackgroundDataUrl(file);
      setPreference('bgImage', dataUrl);
      setPreference('bgType', 'image');
    } catch {
      toast.error(t('settings.bgImage'));
    }
  };

  const removeImage = () => {
    setPreference('bgImage', null);
    setPreference('bgType', 'pattern');
  };

  return (
    <Dialog open={section !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{section ? t(SECTION_TITLE[section]) : ''}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-1">
          {/* Language */}
          {section === 'language' && (
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setPreference('language', l.code as Lang)}
                  aria-pressed={prefs.language === l.code}
                  className={OPT_CHIP}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}

          {/* Font: family + size */}
          {section === 'font' && (
            <>
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{t('settings.fontFamily')}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {FONT_FAMILIES.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setPreference('fontFamily', f.css)}
                      aria-pressed={prefs.fontFamily === f.css}
                      style={{ fontFamily: `${f.css}, system-ui, sans-serif` }}
                      className={OPT_CHIP}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{t('settings.fontSize')}</h3>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={FONT_SCALE_MIN}
                    max={FONT_SCALE_MAX}
                    step={FONT_SCALE_STEP}
                    value={prefs.fontScale}
                    onChange={(e) => setPreference('fontScale', Number(e.target.value))}
                    aria-label={t('settings.fontSize')}
                    className="flex-1 accent-[hsl(var(--primary))] cursor-pointer"
                  />
                  <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                    {Math.round(prefs.fontScale * 100)}%
                  </span>
                </div>
              </section>
            </>
          )}

          {/* Icons on/off */}
          {section === 'icons' && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPreference('showIcons', true)}
                aria-pressed={prefs.showIcons}
                className={OPT_CHIP}
              >
                {t('settings.iconsShow')}
              </button>
              <button
                type="button"
                onClick={() => setPreference('showIcons', false)}
                aria-pressed={!prefs.showIcons}
                className={OPT_CHIP}
              >
                {t('settings.iconsHide')}
              </button>
            </div>
          )}

          {/* Timeline: now-line style + world-clock lines */}
          {section === 'timeline' && (
            <div className="flex flex-col gap-4">
              {/* Donut ring thickness — moves the inner radius (outer rim fixed).
                  Slider shows thickness (thicker → right); stored as innerR. */}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">{t('settings.ringThickness')}</span>
                <div className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-[11px] text-muted-foreground">{t('settings.ringThin')}</span>
                  <input
                    type="range"
                    min={460 - RING_INNER_MAX}
                    max={460 - RING_INNER_MIN}
                    step={10}
                    value={460 - prefs.ringInnerR}
                    onChange={(e) => setPreference('ringInnerR', 460 - Number(e.target.value))}
                    className="flex-1 cursor-pointer accent-[hsl(var(--primary))]"
                    aria-label={t('settings.ringThickness')}
                  />
                  <span className="w-10 shrink-0 text-right text-[11px] text-muted-foreground">{t('settings.ringThick')}</span>
                </div>
              </div>
              {/* Snap grid — drag / split / block edits land on this minute step. */}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">{t('settings.snapStep')}</span>
                <div className="flex gap-1.5">
                  {SNAP_STEPS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPreference('snapMinutes', s)}
                      aria-pressed={prefs.snapMinutes === s}
                      className={OPT_CHIP}
                    >
                      {t('settings.snapMin', { n: String(s) })}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">{t('settings.snapHint')}</p>
              </div>
              {/* Slice-start notifications — the timetable IS the alarm. */}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">{t('settings.sliceAlarms')}</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        if (typeof Notification === 'undefined') {
                          toast.error(permDeniedMsg());
                          return;
                        }
                        if (Notification.permission === 'denied') {
                          toast.error(permDeniedMsg());
                          return;
                        }
                        const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
                        if (p === 'granted') setPreference('sliceAlarms', true);
                        else toast.error(permDeniedMsg());
                      })();
                    }}
                    aria-pressed={prefs.sliceAlarms}
                    className={OPT_CHIP}
                  >
                    {t('settings.iconsShow')}
                  </button>
                  <button type="button" onClick={() => setPreference('sliceAlarms', false)} aria-pressed={!prefs.sliceAlarms} className={OPT_CHIP}>
                    {t('settings.iconsHide')}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">{t('settings.sliceAlarmsHint')}</p>
                {/* One-tap sanity check: runs the exact notification path the
                    alarms use, so a user can confirm permission + delivery work
                    on THIS device (isolates OS/permission from the scheduling). */}
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      // The in-app popup always works (no OS permission needed) —
                      // show it first so the test proves the popup regardless.
                      fireSliceAlarmPopup({ title: '🔔 24Houring', body: t('settings.alarmTest') });
                      if (typeof Notification === 'undefined') {
                        toast.error(t('settings.alarmTestFail'));
                        return;
                      }
                      const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
                      if (p !== 'granted') {
                        toast.error(permDeniedMsg());
                        return;
                      }
                      const ok = await fireNotification('🔔 24Houring', {
                        body: t('settings.alarmTest'),
                        tag: 'slice-start',
                        icon: '/icon-192.png',
                      });
                      toast[ok ? 'success' : 'error'](t(ok ? 'settings.alarmTestSent' : 'settings.alarmTestFail'));
                    })();
                  }}
                  className="w-fit rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-black/10"
                >
                  {t('settings.alarmTest')}
                </button>
              </div>

              {/* Pro tier: server-sent Web Push — arrives with the tab CLOSED. */}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">{t('settings.pushAlarms')}</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        if (plan !== 'pro') {
                          requestUpgrade();
                          return;
                        }
                        if (!pushSupported() || typeof Notification === 'undefined' || Notification.permission === 'denied') {
                          toast.error(permDeniedMsg());
                          return;
                        }
                        const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
                        if (p !== 'granted') {
                          toast.error(permDeniedMsg());
                          return;
                        }
                        if (await enablePush()) setPreference('pushAlarms', true);
                        else toast.error(t('settings.pushFail'));
                      })();
                    }}
                    aria-pressed={prefs.pushAlarms}
                    className={OPT_CHIP}
                  >
                    {t('settings.iconsShow')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreference('pushAlarms', false);
                      void disablePush();
                    }}
                    aria-pressed={!prefs.pushAlarms}
                    className={OPT_CHIP}
                  >
                    {t('settings.iconsHide')}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">{t('settings.pushAlarmsHint')}</p>
                {/* Pro self-test: send a REAL server push to this account's devices
                    so closed-app delivery can be verified (background the app, tap). */}
                {plan === 'pro' && (
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        const r = await sendTestPush();
                        if (!r.ok) {
                          toast.error(t('settings.pushTestFail'));
                        } else if (r.subs === 0) {
                          toast.error(t('settings.pushTestNoSub'));
                        } else if (r.sent > 0) {
                          // Server accepted the send → surface the counts so a
                          // "didn't arrive" is clearly a device-side (battery/DND)
                          // issue, not a server one.
                          toast.success(t('settings.pushTestSent', { subs: String(r.subs), sent: String(r.sent) }), { duration: 8000 });
                        } else {
                          toast.error(t('settings.pushTestSendFail', { subs: String(r.subs) }), { duration: 8000 });
                        }
                      })();
                    }}
                    className="w-fit rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-black/10"
                  >
                    {t('settings.pushTest')}
                  </button>
                )}
              </div>

              {/* Now line on/off */}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">{t('settings.clockNowLine')}</span>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setPreference('showNowLine', true)} aria-pressed={prefs.showNowLine} className={OPT_CHIP}>
                    {t('settings.iconsShow')}
                  </button>
                  <button type="button" onClick={() => setPreference('showNowLine', false)} aria-pressed={!prefs.showNowLine} className={OPT_CHIP}>
                    {t('settings.iconsHide')}
                  </button>
                </div>
              </div>

              {/* Now line colour */}
              <div className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">{t('settings.lineColor')}</span>
                <label className="opt-pick inline-flex w-fit cursor-pointer items-center gap-2 rounded-md px-2 py-1.5">
                  <span className="h-6 w-6 rounded border border-border" style={{ backgroundColor: prefs.nowLineColor }} />
                  <span className="text-sm tabular-nums">{prefs.nowLineColor}</span>
                  <input type="color" value={prefs.nowLineColor} onChange={(e) => setPreference('nowLineColor', e.target.value)} className="sr-only" aria-label={t('settings.lineColor')} />
                </label>
                <button type="button" onClick={() => setPreference('nowLineColor', NOW_LINE_DEFAULT_COLOR)} className="text-xs text-muted-foreground underline">
                  {t('settings.lineReset')}
                </button>
              </div>

              {/* Now line width */}
              <div className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">{t('settings.lineWidth')}</span>
                <input
                  type="range"
                  min={1}
                  max={6}
                  step={0.5}
                  value={prefs.nowLineWidth}
                  onChange={(e) => setPreference('nowLineWidth', Number(e.target.value))}
                  className="flex-1 cursor-pointer accent-[hsl(var(--primary))]"
                  aria-label={t('settings.lineWidth')}
                />
                <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{prefs.nowLineWidth}</span>
              </div>

              {/* World clocks */}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">{t('settings.worldClocks')}</span>
                {prefs.worldClocks.map((w) => (
                  <div key={w.id} className="flex items-center gap-2">
                    <label className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md">
                      <span className="h-5 w-5 rounded-full border border-black/15" style={{ backgroundColor: w.color }} />
                      <input type="color" value={w.color} onChange={(e) => updateWorldClock(w.id, { color: e.target.value })} className="sr-only" aria-label={w.label} />
                    </label>
                    <span className="flex-1 text-sm text-foreground">{w.label}</span>
                    <button
                      type="button"
                      onClick={() => removeWorldClock(w.id)}
                      aria-label={t('settings.lineRemove')}
                      className="grid h-7 w-7 place-items-center rounded hover:bg-muted text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <select
                    value={tzToAdd}
                    onChange={(e) => setTzToAdd(e.target.value)}
                    aria-label={t('settings.worldClocks')}
                    className="flex-1 rounded-md px-2 py-1.5 text-sm bg-background text-foreground border border-border"
                  >
                    {TIMEZONES.map((z) => (
                      <option key={z.tz} value={z.tz}>{lang === 'ko' ? z.ko : z.en}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addWorldClock}
                    className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm bg-primary text-primary-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    {t('settings.addLine')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Background */}
          {section === 'background' && (
            <div className="flex flex-col gap-3">
              {/* Patterns */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">{t('settings.bgPattern')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {BACKGROUNDS.map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => selectPattern(bg)}
                      aria-pressed={prefs.bgType === 'pattern' && prefs.background === bg}
                      className={OPT_CHIP}
                    >
                      {t(BG_LABEL[bg])}
                    </button>
                  ))}
                </div>
              </div>

              {/* Solid color */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">{t('settings.bgColor')}</span>
                <label
                  data-selected={prefs.bgType === 'color'}
                  className="opt-pick inline-flex items-center gap-2 w-fit px-2 py-1.5 rounded-md cursor-pointer"
                >
                  <span
                    className="h-6 w-6 rounded border border-input"
                    style={{ backgroundColor: prefs.bgColor }}
                  />
                  <span className="text-sm tabular-nums">{prefs.bgColor}</span>
                  <input
                    type="color"
                    value={prefs.bgColor}
                    onChange={(e) => selectColor(e.target.value)}
                    aria-label={t('settings.bgColor')}
                    className="sr-only"
                  />
                </label>
              </div>

              {/* Gradient — start · middle · end (+ presets) */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">{t('settings.bgGradient')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {GRADIENT_PRESETS.map((p) => {
                    const css = `linear-gradient(${p.angle}deg, ${p.from}, ${p.via}, ${p.to})`;
                    const selected =
                      prefs.bgType === 'gradient' &&
                      prefs.gradient.from === p.from &&
                      prefs.gradient.via === p.via &&
                      prefs.gradient.to === p.to;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectGradientPreset(p)}
                        data-selected={selected}
                        aria-label={lang === 'ko' ? p.ko : p.en}
                        title={lang === 'ko' ? p.ko : p.en}
                        className="opt-pick h-8 w-12 rounded-md"
                        style={{ backgroundImage: css }}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 pt-0.5">
                  {([['from', 'settings.gradStart'], ['via', 'settings.gradMid'], ['to', 'settings.gradEnd']] as const).map(
                    ([stop, key]) => (
                      <label key={stop} className="inline-flex cursor-pointer items-center gap-1.5">
                        <span
                          className="h-6 w-6 rounded border border-border"
                          style={{ backgroundColor: prefs.gradient[stop] }}
                        />
                        <span className="text-xs text-muted-foreground">{t(key)}</span>
                        <input
                          type="color"
                          value={prefs.gradient[stop]}
                          onChange={(e) => setGradientStop(stop, e.target.value)}
                          aria-label={t(key)}
                          className="sr-only"
                        />
                      </label>
                    ),
                  )}
                </div>
                {/* Direction */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">{t('settings.gradDirection')}</span>
                  <div className="flex flex-wrap gap-1">
                    {GRAD_DIRECTIONS.map(([angle, arrow]) => (
                      <button
                        key={angle}
                        type="button"
                        onClick={() => setGradientAngle(angle)}
                        aria-pressed={prefs.bgType === 'gradient' && prefs.gradient.angle === angle}
                        aria-label={`${angle}°`}
                        className="opt-chip grid h-7 w-7 place-items-center rounded-md text-sm leading-none"
                      >
                        {arrow}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Image upload */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">{t('settings.bgImage')}</span>
                <div className="flex items-center gap-2">
                  {prefs.bgImage ? (
                    <span
                      data-selected={prefs.bgType === 'image'}
                      className="opt-pick h-12 w-20 rounded-md bg-cover bg-center cursor-pointer"
                      style={{ backgroundImage: `url("${prefs.bgImage}")` }}
                      role="img"
                      aria-label={t('settings.bgImage')}
                      onClick={() => setPreference('bgType', 'image')}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-muted transition-colors"
                  >
                    {t('settings.uploadImage')}
                  </button>
                  {prefs.bgImage ? (
                    <button
                      type="button"
                      onClick={removeImage}
                      className="px-3 py-1.5 rounded-md text-sm border border-input hover:bg-muted transition-colors"
                    >
                      {t('settings.removeImage')}
                    </button>
                  ) : null}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onImagePick}
                    className="sr-only"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Color theme — recolours all slices (undoable schedule change) */}
          {section === 'theme' && (
            <div className="flex flex-col gap-1.5">
              {COLOR_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => dispatch({ type: 'APPLY_PALETTE', colors: theme.colors })}
                  className="opt-pick flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-muted transition-colors"
                >
                  <span className="flex gap-0.5 shrink-0">
                    {theme.colors.slice(0, 8).map((c, i) => (
                      <span
                        key={i}
                        className="h-4 w-4 rounded-sm"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </span>
                  <span className="text-sm">{lang === 'ko' ? theme.ko : theme.en}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reserved ad space for this dialog. */}
        <AdSlot slot="settings" className="mt-1" />
      </DialogContent>
    </Dialog>
  );
}
