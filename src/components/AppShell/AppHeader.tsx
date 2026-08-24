import { ChevronDown, Settings as SettingsIcon, FolderOpen, Sparkles, Download, Share2, Smartphone, Languages, Type, Smile, Ruler, Image as ImageIcon, Palette, RotateCcw, Link2, BarChart3, BookOpen, List, Save, BookmarkPlus, QrCode as QrCodeIcon, LogIn, LogOut, UserRound, RefreshCw, Cloud, CloudOff, Target, Lock, CalendarClock, CreditCard, Tags, Scale, CalendarRange } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { SaveIndicator } from '@/components/SaveIndicator/SaveIndicator';
import { ChartViewToggle } from '@/components/ChartViewToggle/ChartViewToggle';
import { useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { useSyncStatus } from '@/hooks/useSync';
import { openBillingPortal } from '@/lib/sync/billing';
import type { SettingsSection } from '@/components/Settings/SettingsDialog';

export interface AppHeaderProps {
  onOpenAbout: () => void;
  onOpenSlots: () => void;
  onOpenSaveAs: () => void;
  onOpenSavePreset: () => void;
  onOpenDiary: () => void;
  onOpenAnalytics: () => void;
  onOpenTimeGap: () => void;
  onOpenWeekly: () => void;
  onOpenGoals: () => void;
  onOpenWeekday: () => void;
  onOpenPresets: () => void;
  onOpenPalette: () => void;
  onOpenSettings: (section: SettingsSection) => void;
  onOpenExport: () => void;
  onShareImage: () => void;
  onCopyLink: () => void;
  onOpenHome: () => void;
  onOpenTransfer: () => void;
  onOpenReset: () => void;
  onOpenE2ee: () => void;
  onOpenUpgrade: () => void;
}

/**
 * The sticky app header: brand (→ about), save indicator, centred view toggle,
 * and the right-side groups (my-schedules / diary / design / export /
 * settings ⚙). Auth + sync status live here; everything it opens is owned by App
 * via props.
 */
export function AppHeader({
  onOpenAbout,
  onOpenSlots,
  onOpenSaveAs,
  onOpenSavePreset,
  onOpenDiary,
  onOpenAnalytics,
  onOpenTimeGap,
  onOpenWeekly,
  onOpenGoals,
  onOpenWeekday,
  onOpenPresets,
  onOpenPalette,
  onOpenSettings,
  onOpenExport,
  onShareImage,
  onCopyLink,
  onOpenHome,
  onOpenTransfer,
  onOpenReset,
  onOpenE2ee,
  onOpenUpgrade,
}: AppHeaderProps) {
  const { t } = useTranslation();
  const { user, plan, billingEnabled, login, logout, loading: authLoading } = useAuth();
  const sync = useSyncStatus();

  const handleLogout = () => {
    void logout().then(() => toast.success(t('auth.signedOut')));
  };

  const handleManage = () => {
    openBillingPortal().catch(() => toast.error(t('billing.portalError')));
  };

  return (
    <header
      data-app-header
      className="sticky top-0 z-30 border-b bg-surface/85 border-border/70"
      style={{
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 1px 3px hsl(220 30% 15% / 0.08), 0 1px 2px hsl(220 30% 15% / 0.04)',
      }}
    >
      <div className="container mx-auto grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-3 sm:gap-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="min-w-0 shrink truncate font-semibold text-sm sm:text-base">
            <button
              type="button"
              onClick={onOpenAbout}
              title={t('about.open')}
              aria-label={t('about.open')}
              className="rounded transition-opacity hover:opacity-70"
            >
              24Hou<span style={{ color: '#FF4D4D' }}>ring</span>
            </button>
          </h1>
          <SaveIndicator />
        </div>
        {/* Centred view toggle — independent, page-centred between the side groups */}
        <div className="flex items-center justify-center">
          <ChartViewToggle />
        </div>
        <div className="flex min-w-0 shrink items-center justify-end gap-1 sm:gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2 sm:px-3" aria-label={t('header.mySchedules')}>
                <FolderOpen className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">{t('header.mySchedules')}</span>
                <ChevronDown className="ml-1 hidden h-4 w-4 sm:inline" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpenSlots} className="gap-2">
                <List className="h-4 w-4" />
                {t('header.viewSlots')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenSaveAs} className="gap-2">
                <Save className="h-4 w-4" />
                {t('header.saveAs')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenSavePreset} className="gap-2">
                <BookmarkPlus className="h-4 w-4" />
                {t('header.savePreset')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenWeekday} className="gap-2">
                <CalendarClock className="h-4 w-4" />
                {t('weekday.title')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Diary — its own top-level menu, pulled out of 내 시간표. Holds the
              daily-record features: open the diary, plus the insight views
              (time analysis, goals) that read from those saved days. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2 sm:px-3" aria-label={t('diary.open')}>
                <BookOpen className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">{t('diary.open')}</span>
                <ChevronDown className="ml-1 hidden h-4 w-4 sm:inline" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpenDiary} className="gap-2">
                <BookOpen className="h-4 w-4" />
                {t('diary.title')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onOpenAnalytics} className="gap-2">
                <BarChart3 className="h-4 w-4" />
                {t('analytics.open')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenTimeGap} className="gap-2">
                <Scale className="h-4 w-4" />
                {t('timegap.menu')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenWeekly} className="gap-2">
                <CalendarRange className="h-4 w-4" />
                {t('weekly.menu')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenGoals} className="gap-2">
                <Target className="h-4 w-4" />
                {t('goals.open')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2 sm:px-3" aria-label={t('header.design')}>
                <Palette className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">{t('header.design')}</span>
                <ChevronDown className="ml-1 hidden h-4 w-4 sm:inline" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuItem onClick={onOpenPresets} className="gap-2">
                <Sparkles className="h-4 w-4" />
                {t('header.presets')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenPalette} className="gap-2">
                <Tags className="h-4 w-4" />
                {t('palette.title')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onOpenSettings('font')} className="gap-2">
                <Type className="h-4 w-4" />
                {t('settings.font')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenSettings('icons')} className="gap-2">
                <Smile className="h-4 w-4" />
                {t('settings.icons')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenSettings('timeline')} className="gap-2">
                <Ruler className="h-4 w-4" />
                {t('settings.timeline')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenSettings('background')} className="gap-2">
                <ImageIcon className="h-4 w-4" />
                {t('settings.background')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenSettings('theme')} className="gap-2">
                <Palette className="h-4 w-4" />
                {t('settings.colorTheme')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            className="px-2 sm:px-3"
            onClick={onOpenExport}
            aria-label={t('header.export')}
          >
            <Download className="h-4 w-4 sm:hidden" />
            <span className="hidden sm:inline">{t('header.export')}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('header.settings')}>
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              {!authLoading && (
                <>
                  {user ? (
                    <>
                      <DropdownMenuLabel className="flex items-center gap-2 font-normal">
                        <UserRound className="h-4 w-4 shrink-0" />
                        <span className="truncate text-xs text-muted-foreground">
                          {user.email ?? user.provider}
                        </span>
                        {plan === 'pro' && (
                          <span className="ml-auto shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            Pro
                          </span>
                        )}
                      </DropdownMenuLabel>
                      {plan === 'pro' ? (
                        <>
                          {/* Live sync status — Pro only (sync is a Pro feature). */}
                          <div className="flex items-center gap-1.5 px-2 pb-1.5 text-xs text-muted-foreground">
                            {sync.status === 'syncing' ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : sync.status === 'locked' ? (
                              <Lock className="h-3 w-3" />
                            ) : sync.status === 'offline' || sync.status === 'error' ? (
                              <CloudOff className="h-3 w-3" />
                            ) : (
                              <Cloud className="h-3 w-3" />
                            )}
                            <span>
                              {sync.status === 'syncing'
                                ? t('sync.syncing')
                                : sync.status === 'locked'
                                  ? t('sync.locked')
                                  : sync.status === 'offline'
                                    ? t('sync.offline')
                                    : sync.status === 'error'
                                      ? t('sync.error')
                                      : t('sync.synced')}
                            </span>
                          </div>
                          <DropdownMenuItem onClick={handleManage} className="gap-2">
                            <CreditCard className="h-4 w-4" />
                            {t('billing.manage')}
                          </DropdownMenuItem>
                          {/* Diary lock (E2EE) rides on sync → Pro only. */}
                          <DropdownMenuItem onClick={onOpenE2ee} className="gap-2">
                            <Lock className="h-4 w-4" />
                            {t('e2ee.menu')}
                          </DropdownMenuItem>
                        </>
                      ) : billingEnabled ? (
                        <DropdownMenuItem onClick={onOpenUpgrade} className="gap-2">
                          <Sparkles className="h-4 w-4" />
                          {t('billing.upgrade')}
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onClick={handleLogout} className="gap-2">
                        <LogOut className="h-4 w-4" />
                        {t('auth.logout')}
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem onClick={login} className="gap-2">
                      <LogIn className="h-4 w-4" />
                      {t('auth.login')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => onOpenSettings('language')} className="gap-2">
                <Languages className="h-4 w-4" />
                {t('settings.language')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onShareImage} className="gap-2">
                <Share2 className="h-4 w-4" />
                {t('share.button')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCopyLink} className="gap-2">
                <Link2 className="h-4 w-4" />
                {t('sharelink.copy')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenHome} className="gap-2">
                <Smartphone className="h-4 w-4" />
                {t('home.button')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenTransfer} className="gap-2">
                <QrCodeIcon className="h-4 w-4" />
                {t('transfer.menu')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onOpenReset}
                className="gap-2 text-destructive"
              >
                <RotateCcw className="h-4 w-4" />
                {t('settings.reset')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
