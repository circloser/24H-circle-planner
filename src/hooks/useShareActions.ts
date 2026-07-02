import { toast } from 'sonner';
import { shareChartImage } from '@/lib/share';
import { buildViewUrl, copyToClipboard } from '@/lib/share-link';
import { useTranslation } from '@/hooks/usePreferences';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { useDiary, dateKey } from '@/hooks/useDiary';

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
      const outcome = await shareChartImage(svgRef.current, present.name, t('share.text'));
      if (outcome === 'downloaded') toast.success(t('share.saved'));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // user cancelled
      toast.error(`${t('share.fail')}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function copyLink() {
    const note = entries[diaryDate ?? dateKey()]?.note ?? '';
    const ok = await copyToClipboard(buildViewUrl(present, note));
    if (ok) toast.success(t('sharelink.copied'));
    else toast.error(t('sharelink.copyFail'));
  }

  return { shareImage, copyLink };
}
