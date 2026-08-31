import { toast } from 'sonner';
import { shareChartImage } from '@/lib/share';
import { buildViewUrl, createServerShareUrl, copyToClipboard } from '@/lib/share-link';
import { useTranslation } from '@/hooks/usePreferences';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { useDiary, dateKey } from '@/hooks/useDiary';
import { track } from '@/lib/track';

/**
 * The two "share this day" actions, extracted from App:
 *  - shareImage: current chart as a PNG via the native share sheet (mobile) or
 *    an image download (desktop fallback).
 *  - copyLink: a read-only /s#d=… view link for the shown day — the schedule
 *    PLUS its note (the diary note for the current/viewed day, if any). Opens
 *    the standalone viewer for the recipient; nothing touches their own data.
 */
export function useShareActions(svgRef: React.RefObject<SVGSVGElement | null>) {
  const present = useStoreSelector((s) => s.history.present);
  const diaryDate = useStoreSelector((s) => s.diaryDate);
  const { entries } = useDiary();
  const { t } = useTranslation();

  async function shareImage() {
    if (!svgRef.current) {
      toast.error(t('share.noChart'));
      return;
    }
    try {
      const outcome = await shareChartImage(svgRef.current, present.name || t('shareview.untitled'), t('share.text'));
      track('share', { method: 'image' });
      if (outcome === 'downloaded') toast.success(t('share.saved'));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // user cancelled
      toast.error(`${t('share.fail')}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function copyLink() {
    const note = entries[diaryDate ?? dateKey()]?.note ?? '';
    let kind = 'fragment';

    // Prefer a short server-stored link (/s/:id): it unfurls into a card showing
    // the actual ring when pasted into KakaoTalk / X / Discord. Building it takes
    // ~a second (render the OG card + POST), so hand the clipboard a ClipboardItem
    // promise where supported — that keeps Safari's user-gesture window open while
    // the link is created. Anything failing falls back to the offline-safe #d= link.
    const urlPromise = (async () => {
      let url: string | null = null;
      if (navigator.onLine !== false) {
        const png = svgRef.current
          ? await import('@/lib/export/ogImage').then((m) => m.buildOgPngBase64(svgRef.current!)).catch(() => null)
          : null;
        url = await createServerShareUrl(present, note, png ?? undefined);
      }
      if (url) kind = 'server';
      return url ?? buildViewUrl(present, note);
    })();

    let ok: boolean;
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write && window.isSecureContext) {
        const item = new ClipboardItem({
          'text/plain': urlPromise.then((u) => new Blob([u], { type: 'text/plain' })),
        });
        await navigator.clipboard.write([item]);
        ok = true;
      } else {
        ok = await copyToClipboard(await urlPromise);
      }
    } catch {
      ok = await copyToClipboard(await urlPromise);
    }

    if (ok) track('share', { method: 'link', kind });
    if (ok) toast.success(t('sharelink.copied'));
    else toast.error(t('sharelink.copyFail'));
  }

  return { shareImage, copyLink };
}
