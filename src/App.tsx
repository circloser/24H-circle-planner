import { useState, useEffect, useRef } from 'react';
import './index.css';
import { Sparkles, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuid } from 'uuid';
import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/AppShell/AppHeader';
import { EnablePushBanner } from '@/components/EnablePushBanner/EnablePushBanner';
import { GetAppBanner } from '@/components/GetAppBanner/GetAppBanner';
import { IosInstallBanner } from '@/components/IosInstallBanner/IosInstallBanner';
import { ActivationNudge } from '@/components/ActivationNudge/ActivationNudge';
import { AppFooter } from '@/components/AppShell/AppFooter';
import { ResetDialog } from '@/components/AppShell/ResetDialog';
import { ShareImportDialog } from '@/components/AppShell/ShareImportDialog';
import { TimePaletteDialog } from '@/components/TimePalette/TimePaletteDialog';
import { useSliceAlarms } from '@/hooks/useSliceAlarms';
import { useChimes } from '@/hooks/useChimes';
import { useActivationTracking } from '@/hooks/useActivationTracking';
import { usePushAlarms } from '@/hooks/usePushAlarms';
import { useDailyDoneReset } from '@/hooks/useDailyDoneReset';
import { track } from '@/lib/track';
import { CircleTimeline } from '@/components/CircleTimeline/CircleTimeline';
import { ScheduleTable } from '@/components/ScheduleTable/ScheduleTable';
import { DeviceTransferDialog } from '@/components/DeviceTransferDialog/DeviceTransferDialog';
import { PresetGallery } from '@/components/PresetGallery/PresetGallery';
import { SliceEditor } from '@/components/SliceEditor/SliceEditor';
import { HubTitleEditor } from '@/components/HubTitleEditor/HubTitleEditor';
import { SlotSheet } from '@/components/SlotSheet/SlotSheet';
import { SaveAsDialog } from '@/components/SaveAsDialog/SaveAsDialog';
import { SavePresetDialog } from '@/components/SavePresetDialog/SavePresetDialog';
import { ExportDialog } from '@/components/ExportPanel/ExportDialog';
import { SettingsDialog, type SettingsSection } from '@/components/Settings/SettingsDialog';
import { MemoLayer } from '@/components/Memo/MemoLayer';
import { MobileMemoSection } from '@/components/Memo/MobileMemoSection';
import { ClockToolsLayer } from '@/components/ClockTools/ClockToolsLayer';
import { TamagotchiProvider } from '@/hooks/useTamagotchi';
import { TamagotchiLayer } from '@/components/Tamagotchi/TamagotchiLayer';
import { MobileTamaSection } from '@/components/Tamagotchi/MobileTamaSection';
import { MobileClockSection } from '@/components/ClockTools/MobileClockSection';
import { TimeBlockDialog } from '@/components/TimeBlock/TimeBlockDialog';
import { RimMemoLayer } from '@/components/RimMemo/RimMemoLayer';
import { SliceAlarmPopup } from '@/components/SliceAlarmPopup/SliceAlarmPopup';
import { DayBar } from '@/components/Days/DayBar';
import { AddToHomeDialog, type BeforeInstallPromptEvent } from '@/components/AddToHomeDialog/AddToHomeDialog';
import { AboutDialog } from '@/components/About/AboutDialog';
import { requestPersistentStorage } from '@/lib/persistent-storage';
import { setWidgetSnapEnabled } from '@/components/ClockTools/clock-utils';
import { useTranslation, useChartView, usePreferences } from '@/hooks/usePreferences';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useDayChange } from '@/hooks/useDayChange';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { useSliceInteraction } from '@/hooks/useSliceInteraction';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useShareActions } from '@/hooks/useShareActions';
import { useCompletionCelebration } from '@/hooks/useCompletionCelebration';
import { usePipWidget } from '@/components/PipWidget/PipWidget';
import { WidgetConnectDialog } from '@/components/WidgetConnect/WidgetConnectDialog';
import { isPlayStoreApp } from '@/lib/twa';
import { useSyncStatus } from '@/hooks/useSync';
import { useAuth } from '@/hooks/useAuth';
import { E2eeDialog } from '@/components/Sync/E2eeDialog';
import { UpgradeDialog } from '@/components/Billing/UpgradeDialog';
import { StatsDialog } from '@/components/Admin/StatsDialog';
import { OPEN_UPGRADE_EVENT } from '@/lib/pro';
import { WelcomeOverlay } from '@/components/Onboarding/WelcomeOverlay';
import { DesignMagician } from '@/components/Onboarding/DesignMagician';
import { TutorialOverlay } from '@/components/Onboarding/TutorialOverlay';
import { PlayStoreBanner } from '@/components/Onboarding/PlayStoreBanner';
import { readSharedFromHash, clearShareHash } from '@/lib/share-link';
import { AnalyticsDialog } from '@/components/Analytics/AnalyticsDialog';
import { TimeGapDialog } from '@/components/TimeGap/TimeGapDialog';
import { WeeklyReportDialog } from '@/components/WeeklyReport/WeeklyReportDialog';
import { DiaryDialog } from '@/components/Diary/DiaryDialog';
import { DiaryNotePanel } from '@/components/Diary/DiaryNotePanel';
import { GoalsDialog } from '@/components/Goals/GoalsDialog';
import { GoalsWidget } from '@/components/Goals/GoalsWidget';
import { NewsWidget } from '@/components/News/NewsWidget';
import { PolaroidAlbum } from '@/components/Polaroid/PolaroidAlbum';
import { ReferralDialog } from '@/components/Referral/ReferralDialog';
import { DiaryViewSync } from '@/components/DiaryViewSync';
import { RecordView } from '@/components/Record/RecordView';
import { WeekdayScheduleDialog } from '@/components/Weekday/WeekdayScheduleDialog';
import { loadWeekdayMap, weekdayName, STORAGE_KEY_WEEKDAY_PROMPTED } from '@/lib/weekday-schedules';
import { loadSlots } from '@/lib/slots';
import { dateKey } from '@/hooks/useDiary';
import { PRESETS } from '@/data/presets';
import type { Slot } from '@/types/slot';
import type { Schedule } from '@/types/schedule';
import type { Preset } from '@/types/preset';

// First-visit onboarding flag. When absent, we show the one-time welcome overlay
// (the day-1 schedule is seeded with a demo example by useDays so the circle is
// never empty). Set once the welcome is dismissed.
const ONBOARDED_KEY = '24h-circle-planner.onboarded';
const MAGICIAN_KEY = '24h-circle-planner.design-magician';
const GETAPP_KEY = '24h-circle-planner.getapp-banner';
const TUTORIAL_KEY = '24h-circle-planner.tutorial-seen';

function isFirstVisit(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === null;
  } catch {
    return false;
  }
}

function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    // storage unavailable — the welcome may show again, which is harmless
  }
}

function App() {
  const present = useStoreSelector((s) => s.history.present);
  const { prefs } = usePreferences();
  const locked = useStoreSelector((s) => s.locked);
  const diaryDate = useStoreSelector((s) => s.diaryDate);
  const dispatch = useStoreDispatch();

  const [presetOpen, setPresetOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // A schedule arriving via a share link (#p=…) → confirm before it replaces.
  const [shareImport, setShareImport] = useState<Schedule | null>(() => readSharedFromHash());
  // First visit = a CLEAN start: just the timetable on a quiet screen — no
  // welcome card, no banners, no widgets, no insight. After ~5s of taking it
  // in, the design magician starts. (The persona picker stays available via
  // the preset gallery.)
  const [firstRunClean, setFirstRunClean] = useState<boolean>(() => isFirstVisit() && shareImport === null);
  // True for the visitor's ENTIRE first session (captured before markOnboarded
  // runs). Keeps first-visit noise away — banners, nudges, the insight card —
  // even after the 5s clean phase hands over to the design magician.
  const [firstSession] = useState<boolean>(() => isFirstVisit());
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  // Design magician — a guided decorate-your-app flow. First-timers get it once
  // (5s after the clean first screen); anyone can relaunch it from Design.
  const [magicianOpen, setMagicianOpen] = useState(false);
  useEffect(() => {
    if (!firstRunClean) return;
    const id = window.setTimeout(() => {
      markOnboarded();
      setFirstRunClean(false);
      setMagicianOpen(true);
    }, 5000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  // "Shall we do the tutorial?" — asked once, right after the magician finishes
  // (its final button, not the X), and only if the tutorial was never opened.
  const [askTutorialOpen, setAskTutorialOpen] = useState(false);
  const openTutorial = () => {
    try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch { /* */ }
    setTutorialOpen(true);
  };
  const onMagicianFinish = () => {
    try {
      if (localStorage.getItem(TUTORIAL_KEY) === null) {
        setAskTutorialOpen(true);
        return;
      }
    } catch { /* */ }
    // Returning user just re-decorated their chart — a pride moment: offer to
    // share the new look (first-run keeps the tutorial-offer flow above).
    toast(t('celebrate.design'), {
      action: { label: t('celebrate.share'), onClick: () => void shareImage() },
      duration: 8_000,
    });
  };
  const [getAppOpen, setGetAppOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  // The very end of the first-run flow: a get-the-app QR, shown once.
  const finishFirstRun = () => {
    try { if (!localStorage.getItem(GETAPP_KEY)) setGetAppOpen(true); } catch { /* */ }
  };
  const closeGetApp = () => {
    setGetAppOpen(false);
    try { localStorage.setItem(GETAPP_KEY, '1'); } catch { /* */ }
  };
  const closeMagician = () => {
    setMagicianOpen(false);
    try { localStorage.setItem(MAGICIAN_KEY, '1'); } catch { /* storage unavailable */ }
  };
  const dismissWelcome = () => {
    markOnboarded();
    setWelcomeOpen(false);
    try { if (!localStorage.getItem(MAGICIAN_KEY)) setMagicianOpen(true); } catch { /* */ }
  };

  // Apply the chosen colour theme (if any) to a preset and load it, so content +
  // palette are chosen together in one undoable step. Shared by built-in presets
  // (looked up by name) and user presets (passed as objects).
  const loadPresetObject = (preset: Preset, themeColors: string[] | null, presetName: string) => {
    const themed = themeColors
      ? {
          ...preset,
          slices: preset.slices.map((s, i) => ({
            ...s,
            color: themeColors[i % themeColors.length],
          })),
        }
      : preset;
    dispatch({ type: 'LOAD_PRESET', preset: themed, presetName });
    setPresetOpen(false);
  };

  const handlePresetLoad = (name: string, themeColors: string[] | null) => {
    const preset = PRESETS.find((p) => p.name === name);
    if (preset) loadPresetObject(preset, themeColors, name);
    setPresetOpen(false);
  };

  const handleUserPresetLoad = (preset: Preset, themeColors: string[] | null) => {
    loadPresetObject(preset, themeColors, preset.name);
  };
  const [slotSheetOpen, setSlotSheetOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [homeOpen, setHomeOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [timeBlockOpen, setTimeBlockOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [timeGapOpen, setTimeGapOpen] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [e2eeOpen, setE2eeOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [weekdayOpen, setWeekdayOpen] = useState(false);
  // On opening the app on a weekday that has an assigned default schedule, ask
  // once (per local day) whether to load it. Skipped when arriving via a share
  // link. Reads the slot up front so the prompt has its name.
  const [weekdaySlot, setWeekdaySlot] = useState<Slot | null>(() => {
    try {
      if (readSharedFromHash()) return null;
      if (localStorage.getItem(STORAGE_KEY_WEEKDAY_PROMPTED) === dateKey()) return null;
      const slotId = loadWeekdayMap()[new Date().getDay()];
      return slotId ? (loadSlots()[slotId] ?? null) : null;
    } catch {
      return null;
    }
  });
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [editingSliceId, setEditingSliceId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
  const { t, lang } = useTranslation();
  // Ticks over at local midnight so an untitled hub date rolls to the new day
  // while the app is left open (no reload needed); drives displayTitle below.
  const todayKey = useDayChange();
  // In plain edit mode (no diary loaded), an untitled schedule shows today's date
  // as its hub title, formatted by each country's own convention — Intl decides
  // the field order + separators (ko "8월 4일 (화)", en "Tue, Aug 4",
  // en-GB "Tue, 4 Aug", de "Di., 4. Aug.", ja "8月4日(火)"). Prefer the browser's
  // full regional locale when it shares the chosen UI language's base, else fall
  // back to the UI language so the date never clashes with the surrounding UI.
  // The real, editable schedule name — empty when the schedule is "untitled"
  // (blank or a default placeholder). The hub title editor opens with THIS, so an
  // untitled schedule shows an empty box (not the date) and saving the date as a
  // frozen name can't happen.
  const editableTitle = (() => {
    const nm = present.name?.trim() ?? '';
    return nm === '내 시간표' || nm === '내 하루' ? '' : nm;
  })();
  const displayTitle = (() => {
    const nm = present.name?.trim() ?? '';
    if (diaryDate || (nm !== '' && nm !== '내 시간표' && nm !== '내 하루')) return present.name;
    const nav = typeof navigator !== 'undefined' ? navigator.language : '';
    const dateLocale = nav && nav.split('-')[0] === lang ? nav : lang;
    // Build from todayKey (local YYYY-MM-DD) so the value is reactive to the
    // midnight tick — parsed with an explicit time so it's local, not UTC.
    return new Date(`${todayKey}T00:00:00`).toLocaleDateString(dateLocale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  })();
  const isMobile = useIsMobile();
  const chartView = useChartView();
  const { refresh: refreshAuth, user } = useAuth();

  // ── Referral: capture ?ref= on arrival; after the invited friend signs in,
  //    claim it once (rewards the referrer with 1 month Pro server-side). ──
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      const ref = u.searchParams.get('ref');
      if (ref) {
        localStorage.setItem('24h-ref', ref.toLowerCase());
        u.searchParams.delete('ref');
        window.history.replaceState(null, '', u.toString());
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!user) return;
    let code: string | null = null;
    try { code = localStorage.getItem('24h-ref'); } catch { /* */ }
    if (!code) return;
    void fetch('/api/referral/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ code }),
    }).then(() => { try { localStorage.removeItem('24h-ref'); } catch { /* */ } }).catch(() => { /* retry next login */ });
  }, [user]);

  // One-time toast for OAuth (/?login=ok|…) and Polar checkout (/?checkout=success)
  // round-trips. Show feedback, re-read the session (entitlement may have just
  // changed), then strip the param so a refresh doesn't repeat it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasLogin = params.has('login') || params.has('login_error');
    const hasCheckout = params.has('checkout');
    if (!hasLogin && !hasCheckout) return;
    if (hasLogin) {
      if (params.get('login') === 'ok') toast.success(t('auth.welcome'));
      else toast.error(t('auth.loginFailed'));
    }
    if (hasCheckout) {
      if (params.get('checkout') === 'success') {
        toast.success(t('billing.checkoutSuccess'));
        void refreshAuth(); // webhook may have already flipped us to Pro
      }
    }
    params.delete('login');
    params.delete('login_error');
    params.delete('checkout');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any gated surface can request the paywall via requestUpgrade() (a window event).
  // `#coupons` also opens it — the entry point for admins (who are auto-Pro and
  // never hit a gate) to reach the coupon-issuing panel, and for anyone with a code.
  useEffect(() => {
    const onUpgrade = () => setUpgradeOpen(true);
    const onHash = () => {
      if (window.location.hash === '#coupons') setUpgradeOpen(true);
      if (window.location.hash === '#stats') setStatsOpen(true); // admin-only (endpoint 403s others)
    };
    onHash();
    window.addEventListener(OPEN_UPGRADE_EVENT, onUpgrade);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener(OPEN_UPGRADE_EVENT, onUpgrade);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  /**
   * Called when user confirms loading a slot from SlotSheet.
   * Deep-clones the schedule with fresh UUIDs (same pattern as LOAD_PRESET).
   */
  function handleSlotLoad(slot: Slot) {
    const clonedSchedule = {
      ...slot.schedule,
      id: uuid(),
      updatedAt: new Date().toISOString(),
      slices: slot.schedule.slices.map((s) => ({ ...s, id: uuid() })),
    };
    dispatch({ type: 'LOAD_SCHEDULE', schedule: clonedSchedule });
    toast.success(t('app.loaded', { name: slot.name }));
  }

  // Empty state: single unlabelled slice with no preset loaded
  const isEmptyState =
    present.slices.length === 1 &&
    present.slices[0].label === '' &&
    present.presetSource === null;

  // T4: interaction engine
  const { liveDragGroupRef, svgRef, handlers, isDragging } = useSliceInteraction({
    onRequestEdit: (id: string) => {
      if (locked) {
        toast(t('diary.locked'));
        return;
      }
      setEditingSliceId(id);
    },
  });

  // Suppress unused isDragging warning (useful for consumers/debug)
  void isDragging;

  // T4: keyboard shortcuts (undo/redo + drag-cancel)
  useKeyboardShortcuts({ liveDragGroupRef });

  // "시간표가 곧 알람": crossing into the next slice fires a browser notification
  // (opt-in via 설정 → 타임라인; needs this device's Notification permission).
  useSliceAlarms();
  // Activation funnel: fire schedule_edit once on the first real edit.
  useActivationTracking();
  // Recurring time chime (매 정각 / 주기) while the tab is open — opt-in via 설정.
  useChimes();
  // Pro tier of the same feature: server-sent Web Push, arrives tab-closed.
  usePushAlarms();
  // New local day → clear the live schedule's completion checks (fresh checklist).
  useDailyDoneReset();

  // Share actions (PNG via native sheet / read-only /s#d= link incl. the note).
  const { shareImage, copyLink } = useShareActions(svgRef);
  // Pride moment: first 100% checklist of the day → celebrate + offer to share.
  useCompletionCelebration(present.slices, diaryDate ?? dateKey(), shareImage);

  // Always-on-top PiP mini widget (desktop Chrome/Edge; menu item hidden elsewhere).
  const pip = usePipWidget();
  // Android home-screen widget hookup — only offered inside the Play Store TWA.
  const [widgetConnectOpen, setWidgetConnectOpen] = useState(false);

  // E2EE: when the cloud copy is ciphertext this device can't read, sync reports
  // 'locked' — surface the unlock dialog automatically so the user isn't stuck.
  const syncStatus = useSyncStatus().status;
  useEffect(() => {
    if (syncStatus !== 'locked') return;
    // Defer to the next frame: opening a Radix modal synchronously from the same
    // commit as the status change can be dismissed by its focus scope. The user
    // can always open it from Settings → 종단간 암호화 too.
    const id = requestAnimationFrame(() => setE2eeOpen(true));
    return () => cancelAnimationFrame(id);
  }, [syncStatus]);

  // Ask the browser to keep our localStorage from being auto-evicted, so a
  // user's schedule/memos/backups survive storage-pressure cleanups. Best-effort.
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  // Mirror the widget grid-snap preference into the module-level switch the
  // plain drag utils consult (clock tools, goals, news, post-its, polaroids).
  useEffect(() => {
    setWidgetSnapEnabled(prefs.widgetSnap);
  }, [prefs.widgetSnap]);

  // Weekday defaults now load AUTOMATICALLY (no prompt): on open, and again the
  // moment the local date rolls past midnight — so each day starts on its
  // assigned schedule (and its alarms) without any manual step. A toast says
  // which day was loaded. Skipped while viewing a past diary day.
  useEffect(() => {
    if (!weekdaySlot) return;
    handleSlotLoad(weekdaySlot);
    // Deferred: this effect runs on the very first mount, BEFORE <Toaster>
    // exists — sonner drops toasts fired that early, so the announcement
    // never appeared. A short delay lets the Toaster mount first.
    const day = weekdayName(new Date().getDay(), lang);
    const toastId = window.setTimeout(() => toast.success(t('weekday.autoLoaded', { day })), 600);
    setWeekdaySlot(null);
    try { localStorage.setItem(STORAGE_KEY_WEEKDAY_PROMPTED, dateKey()); } catch { /* ignore */ }
    return () => window.clearTimeout(toastId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const diaryDateRef = useRef(diaryDate);
  diaryDateRef.current = diaryDate;
  const langRef = useRef(lang);
  langRef.current = lang;
  useEffect(() => {
    let lastDay = dateKey();
    const id = window.setInterval(() => {
      const today = dateKey();
      if (today === lastDay) return;
      lastDay = today;
      if (diaryDateRef.current) return; // reading a past day — don't clobber it
      try {
        const slotId = loadWeekdayMap()[new Date().getDay()];
        const slot = slotId ? (loadSlots()[slotId] ?? null) : null;
        if (slot) {
          handleSlotLoad(slot);
          toast.success(t('weekday.autoLoaded', { day: weekdayName(new Date().getDay(), langRef.current) }));
          localStorage.setItem(STORAGE_KEY_WEEKDAY_PROMPTED, today);
        }
      } catch { /* best effort */ }
    }, 30_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A shared schedule was parsed from the URL fragment on init — strip the
  // fragment so a reload doesn't re-prompt; the confirm dialog handles loading.
  useEffect(() => {
    if (shareImport) clearShareHash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capture the browser's install prompt (Chrome/Edge/Android) so the "add to
  // home screen" dialog can offer a one-tap install. Clear it once installed.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return (
    // The pet provider wraps the whole app: desktop renders the roaming layer at
    // the bottom, mobile a stacked section inside <main> — one shared state.
    <TamagotchiProvider>
    <div data-app-root className="relative min-h-screen flex flex-col overflow-x-clip">
      <AppHeader
        onOpenAbout={() => setAboutOpen(true)}
        onOpenSlots={() => setSlotSheetOpen(true)}
        onOpenSaveAs={() => setSaveAsOpen(true)}
        onOpenSavePreset={() => setSavePresetOpen(true)}
        onOpenDiary={() => setDiaryOpen(true)}
        onOpenAnalytics={() => setAnalyticsOpen(true)}
        onOpenTimeGap={() => setTimeGapOpen(true)}
        onOpenWeekly={() => setWeeklyOpen(true)}
        onOpenGoals={() => setGoalsOpen(true)}
        onOpenWeekday={() => setWeekdayOpen(true)}
        onOpenPresets={() => setPresetOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenSettings={setSettingsSection}
        onOpenExport={() => setExportOpen(true)}
        onShareImage={shareImage}
        onCopyLink={copyLink}
        onOpenHome={() => setHomeOpen(true)}
        onOpenTransfer={() => setTransferOpen(true)}
        onOpenReset={() => setResetOpen(true)}
        onOpenE2ee={() => setE2eeOpen(true)}
        onOpenUpgrade={() => setUpgradeOpen(true)}
        onOpenTutorial={openTutorial}
        onOpenMagician={() => setMagicianOpen(true)}
        onOpenReferral={() => setReferralOpen(true)}
        onOpenPip={pip.supported ? () => void pip.open() : undefined}
        onOpenWidgetConnect={isPlayStoreApp() ? () => setWidgetConnectOpen(true) : undefined}
      />

      {/* Invite a friend → 1 month Pro for the inviter once the friend signs in. */}
      <ReferralDialog open={referralOpen} onOpenChange={setReferralOpen} />

      {!firstSession && <ActivationNudge onSendToPhone={() => setTransferOpen(true)} />}
      <EnablePushBanner />
      {!firstSession && <GetAppBanner />}
      {!firstSession && <IosInstallBanner onOpen={() => setHomeOpen(true)} />}

      <main
        className={
          isMobile
            ? 'flex-1 container mx-auto flex flex-col items-center gap-6 px-3 pb-12 pt-3'
            : 'flex-1 container mx-auto py-8 flex items-center justify-center px-4'
        }
      >
        {/* Multi-day switcher — pinned at the top in-flow on mobile, floating on desktop. */}
        {chartView !== 'record' && <DayBar onOpenDiary={() => setDiaryOpen(true)} />}
        <div className="flex w-full flex-col items-center gap-4" data-tour="chart">
        {chartView === 'record' ? (
          <RecordView />
        ) : chartView === 'table' ? (
          <ScheduleTable
            locked={locked}
            onEditLabel={(id) => { if (locked) { toast(t('diary.locked')); } else { setEditingSliceId(id); } }}
            onAddRow={() => (locked ? toast(t('diary.locked')) : setTimeBlockOpen(true))}
          />
        ) : (
        <div
          className={
            isMobile
              ? 'relative w-full max-w-[560px] aspect-square'
              : 'relative mx-auto aspect-square'
          }
          // Desktop: the ring is square, so its width also decides the page
          // height. Cap it by the viewport height minus the app chrome (header,
          // day bar, footer, padding ≈ 250px) so the planner fits ONE screen and
          // never adds a scrollbar of its own; 320px keeps it usable on very
          // short windows (which then scroll, as before).
          style={isMobile ? undefined : { width: 'min(720px, 100%, max(320px, calc(100dvh - 250px)))' }}
        >
          <CircleTimeline
            slices={present.slices}
            mode="interactive"
            interactionMode="interactive"
            dragGroupRef={liveDragGroupRef}
            svgRef={svgRef}
            onPointerDownHandle={handlers.onPointerDownHandle}
            onSliceDoubleClick={handlers.onSliceDoubleClick}
            onBackgroundClick={handlers.onBackgroundClick}
            onSliceSplit={locked ? undefined : handlers.onSliceSplit}
            showEmptyHint={false}
            selectedSliceId={editingSliceId}
            title={displayTitle}
            onHubClick={() => {
              if (locked) {
                toast(t('diary.locked'));
                return;
              }
              setEditingTitle(true);
            }}
            mobileNoChartDrag={isMobile || locked}
            // Viewing a loaded diary = a past saved day → hide the live now-line
            // (and world-clock lines); "current time" is meaningless there.
            hideLiveMarkers={!!diaryDate}
            // …and mark 00:00 with a dashed seam so it reads as a closed snapshot.
            diaryLoaded={!!diaryDate}
          />
          {/* Rim annotation memos (hover near the edge → leader line + note). */}
          <RimMemoLayer />

          {/* Empty-state hero — a value-prop CTA when the circle is empty
              (e.g. after a reset). Sits in the lower band, clear of the hub. */}
          {isEmptyState && !welcomeOpen && (
            <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-[14%]">
              <div
                className="pointer-events-auto flex flex-col items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-center shadow-lg"
              >
                <p className="text-sm font-semibold text-foreground">
                  {t('empty.heroTitle')}
                </p>
                <Button
                  onClick={() => setPresetOpen(true)}
                  className="gap-1.5 bg-primary text-primary-foreground"
                >
                  <Sparkles className="h-4 w-4" />
                  {t('empty.heroCta')}
                </Button>
              </div>
            </div>
          )}
        </div>
        )}
          {/* Day's free-form note, shown directly under the timetable. */}
          {chartView !== 'record' && <DiaryNotePanel />}
        </div>

        {/* Mobile: stacked sections below the chart. Editing stays enabled (touch
            + long-press); only the desktop floating overlays are replaced. */}
        {isMobile && chartView !== 'record' && (
          <>
            <div className="-mt-2 flex flex-col items-center gap-1.5">
              <div className="flex items-center justify-center gap-2">
                <Button
                  onClick={() => (locked ? toast(t('diary.locked')) : setTimeBlockOpen(true))}
                  className="gap-1.5 bg-primary text-primary-foreground"
                >
                  <Plus className="h-4 w-4" />
                  {t('block.add')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    locked
                      ? toast(t('diary.locked'))
                      : window.dispatchEvent(new Event('rimmemo:add'))
                  }
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  {t('rim.add')}
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground/85">
                {t('mobile.editHint')}
              </p>
            </div>
            {prefs.showMemos && <MobileMemoSection />}
            <MobileClockSection />
            {/* News headlines — a plain section at the very bottom on mobile. */}
            {prefs.showNews && <NewsWidget isMobile />}
            {/* The pet, in its console — mobile's stand-in for the desktop's
                roaming creatures (they stay inside the LCD here). */}
            {!firstRunClean && <MobileTamaSection />}
          </>
        )}
      </main>

      <AppFooter />

      <PresetGallery
        open={presetOpen}
        onOpenChange={setPresetOpen}
        onConfirm={handlePresetLoad}
        onLoadUserPreset={handleUserPresetLoad}
      />

      {/* T7: Slot sheet */}
      <SlotSheet
        open={slotSheetOpen}
        onOpenChange={setSlotSheetOpen}
        onLoad={handleSlotLoad}
      />

      {/* T7: Save as dialog */}
      <SaveAsDialog
        open={saveAsOpen}
        onOpenChange={setSaveAsOpen}
        currentSchedule={present}
        onSaved={() => setSaveAsOpen(false)}
      />

      {/* Save current schedule as a reusable preset */}
      <SavePresetDialog
        open={savePresetOpen}
        onOpenChange={setSavePresetOpen}
        currentSchedule={present}
      />

      {/* Full reset — wipes all app data, then reloads to a fresh state. */}
      <ResetDialog open={resetOpen} onOpenChange={setResetOpen} />

      {/* T5: Slice editor portal */}
      <SliceEditor
        sliceId={editingSliceId}
        svgRef={svgRef}
        onClose={() => setEditingSliceId(null)}
      />

      {/* T17: Hub title editor portal */}
      <HubTitleEditor
        open={editingTitle}
        svgRef={svgRef}
        currentName={editableTitle}
        onClose={() => setEditingTitle(false)}
      />

      {/* T19: Settings dialog */}
      <SettingsDialog
        section={settingsSection}
        onClose={() => setSettingsSection(null)}
        onOpenMagician={() => { setSettingsSection(null); setMagicianOpen(true); }}
      />

      {/* Guided decorate-your-app flow (first visit + relaunchable from Design).
          Its final button offers the tutorial next (once, never after the X). */}
      <DesignMagician open={magicianOpen} onClose={closeMagician} onFinish={onMagicianFinish} />
      <WidgetConnectDialog open={widgetConnectOpen} onOpenChange={setWidgetConnectOpen} svgRef={svgRef} />
      {pip.portal}

      {/* "튜토리얼 진행할까요?" — after the magician's finish, for tutorial newcomers. */}
      {askTutorialOpen && (
        <div className="fixed inset-0 z-[59] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl">
            <p className="text-base font-semibold text-foreground">{t('tutorial.askTitle')}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">{t('tutorial.askBody')}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setAskTutorialOpen(false); finishFirstRun(); }}>
                {t('tutorial.askNo')}
              </Button>
              <Button onClick={() => { setAskTutorialOpen(false); openTutorial(); }}>
                {t('tutorial.askYes')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Guided coach-mark tour of the timetable (from the 내 시간표 menu).
          Finishing it caps the first-run flow with the get-the-app QR. */}
      <TutorialOverlay open={tutorialOpen} onClose={() => setTutorialOpen(false)} onFinish={finishFirstRun} />

      {/* Final first-run flourish: scan-to-download QR (shown once). */}
      <PlayStoreBanner open={getAppOpen} onClose={closeGetApp} />

      {/* T9: Export dialog */}
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        svgRef={svgRef}
        scheduleName={present.name || t('shareview.untitled')}
        schedule={present}
        onImport={(s: Schedule) => dispatch({ type: 'LOAD_SCHEDULE', schedule: s })}
      />

      {/* Add-to-home-screen helper (install prompt + instructions) */}
      <AddToHomeDialog
        open={homeOpen}
        onOpenChange={setHomeOpen}
        installPrompt={installPrompt}
        onConsumePrompt={() => setInstallPrompt(null)}
      />

      {/* No-backend device transfer: QR of the current timetable (#p=…). */}
      <DeviceTransferDialog open={transferOpen} onOpenChange={setTransferOpen} />

      {/* About / manual + Circloser brand (opened from the title) */}
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />

      {/* Mobile: add a time block by typing start/end (instead of finger-dragging). */}
      <TimeBlockDialog open={timeBlockOpen} onOpenChange={setTimeBlockOpen} />

      {/* Time analysis — categorised daily-average split + per-day trend. */}
      <AnalyticsDialog open={analyticsOpen} onOpenChange={setAnalyticsOpen} />
      <TimeGapDialog open={timeGapOpen} onOpenChange={setTimeGapOpen} />
      <WeeklyReportDialog open={weeklyOpen} onOpenChange={setWeeklyOpen} />

      {/* Diary — month calendar of saved days, each shown as a mini timetable. */}
      <DiaryDialog open={diaryOpen} onOpenChange={setDiaryOpen} />

      {/* Time-accumulation goals (운동/공부 등) with progress bars. */}
      <GoalsDialog open={goalsOpen} onOpenChange={setGoalsOpen} />

      {/* End-to-end encryption for cloud sync (enable / unlock / manage). */}
      <E2eeDialog open={e2eeOpen} onOpenChange={setE2eeOpen} />
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      <StatsDialog open={statsOpen} onOpenChange={setStatsOpen} />
      <TimePaletteDialog open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Assign a saved schedule to each weekday. */}
      <WeekdayScheduleDialog open={weekdayOpen} onOpenChange={setWeekdayOpen} />

      {/* (Weekday defaults auto-load now — the confirm prompt is gone.) */}

      {/* One-time first-visit welcome over the seeded demo schedule. */}
      <WelcomeOverlay
        open={welcomeOpen}
        onOpenChange={(o) => { if (!o) dismissWelcome(); }}
        onLoadPreset={(name) => handlePresetLoad(name, null)}
        onPickPreset={() => setPresetOpen(true)}
        isMobile={isMobile}
      />

      {/* First-insight card — the day's biggest slice, once the schedule is real. */}
      {/* The auto-shown first-insight card is retired (quiet-start policy):
          it lingered over the bottom bar for anyone whose insight flag was
          never written (share-link first arrivals, pre-policy visitors). */}

      {/* Incoming share link (#p=…) → confirm before replacing the schedule. */}
      <ShareImportDialog
        schedule={shareImport}
        onClose={() => setShareImport(null)}
        onImport={(s) => {
          track('schedule_import', { name: s.name ?? '' });
          dispatch({ type: 'LOAD_SCHEDULE', schedule: s });
        }}
      />

      {/* Desktop only: floating post-it memos (bottom-right) + clock tools
          (bottom-left). On mobile these move into the stacked sections under the
          chart (MobileMemoSection / MobileClockSection inside <main>). */}
      <DiaryViewSync />
      {/* prefs.showWidgets = master switch (환경설정 > 위젯): off hides every
          floating widget AND its FAB for a completely clean canvas. */}
      {!isMobile && !firstRunClean && prefs.showWidgets && prefs.showMemos && <MemoLayer />}
      {!isMobile && !firstRunClean && prefs.showWidgets && <GoalsWidget onSetup={() => setGoalsOpen(true)} />}
      {!isMobile && !firstRunClean && prefs.showWidgets && <ClockToolsLayer />}
      {/* Keyword news headlines — desktop: the FAB is always shown; its window
          open/closed is a pref (magician-toggleable). Mobile: a bottom section. */}
      {!isMobile && !firstRunClean && prefs.showWidgets && <NewsWidget />}
      {/* Polaroid photo wall — photos live only on this device (IndexedDB). */}
      {!isMobile && !firstRunClean && prefs.showWidgets && <PolaroidAlbum />}
      {/* Background pet — desktop: roams the window from a FAB console. Mobile
          renders it as a section inside <main> instead (see MobileTamaSection). */}
      {!isMobile && !firstRunClean && <TamagotchiLayer />}

      {/* In-app slice-start popup (bottom-right / bottom, 5s, above everything).
          Fires from useSliceAlarms on a block boundary — shows even without OS
          notification permission. */}
      <SliceAlarmPopup />
    </div>
    </TamagotchiProvider>
  );
}

export default App;
