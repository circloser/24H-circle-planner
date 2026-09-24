import { useEffect, useRef } from 'react';
import { isPlayStoreApp } from '@/lib/twa';
import { useTranslation } from '@/hooks/usePreferences';
import { WIDGET_TOKEN_EVENT, adoptWidgetTokenFromUrl, isDarkTheme, readWidgetToken } from '@/lib/widget/publish';
import { adoptWidgetKindsFromUrl, deleteKindSlot, publishKinds, readWidgetKinds } from '@/lib/widget/kinds';

/** Long enough after opening for the stores to have loaded and the page to
 *  have settled; nothing here is urgent. */
const AFTER_OPEN_MS = 1500;

/**
 * Keeps the calendar, life, people and place widgets on the phone's home
 * screen current (Play Store app only; see lib/widget/kinds). The pictures are
 * drawn when the app is opened — which is also when the date may have moved
 * on — and again the moment it is left, which is when the phone refreshes
 * them. Only the kinds the phone has placed are drawn at all.
 */
export function useKindWidgets(): void {
  const { t, lang } = useTranslation();
  const latest = useRef({ t, lang });
  useEffect(() => {
    latest.current = { t, lang };
  }, [t, lang]);

  useEffect(() => {
    if (!isPlayStoreApp()) return;
    // The launcher hands over the token and the placed kinds in the URL.
    adoptWidgetTokenFromUrl(window.location, true);
    const placed = adoptWidgetKindsFromUrl();
    const token = readWidgetToken();
    if (token && placed) for (const kind of placed.removed) void deleteKindSlot(token, kind);

    let running = false;
    const run = async () => {
      const tk = readWidgetToken();
      const kinds = readWidgetKinds();
      if (running || !tk || !kinds.length) return;
      running = true;
      try {
        await publishKinds(tk, kinds, { ...latest.current, dark: isDarkTheme() });
      } finally {
        running = false;
      }
    };
    const opened = window.setTimeout(() => void run(), AFTER_OPEN_MS);
    const onVisibility = () => { if (document.visibilityState === 'hidden') void run(); };
    const onToken = () => void run();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener(WIDGET_TOKEN_EVENT, onToken);
    return () => {
      window.clearTimeout(opened);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener(WIDGET_TOKEN_EVENT, onToken);
    };
  }, []);
}
