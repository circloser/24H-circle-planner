import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileJson, ImageDown, Loader2, ShieldAlert, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';
import { downloadBlob } from '@/lib/share';
import { track } from '@/lib/track';
import { loadPhoto, savePhoto } from '@/lib/calendar-photos';
import { todayKey } from '@/lib/calendar-grid';
import {
  placeFile, placePhotoIds, placeSummary, readPlaceFile, type CountryShape,
} from '@/lib/place';
import type { PlaceApi } from '@/hooks/usePlace';

/**
 * Saving the map: the whole world as a picture, or the JSON that brings
 * everything back.
 *
 * A map of where someone has been shows where they live and where they work,
 * so the picture is only made once that has been read.
 */
export function PlaceExportDialog({ open, onOpenChange, api, shapes, visited }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  api: PlaceApi;
  shapes: readonly CountryShape[];
  visited: string;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<'png' | 'json' | null>(null);
  const [agreed, setAgreed] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const { data } = api;

  const png = async () => {
    setBusy('png');
    try {
      const { placeImage } = await import('@/lib/export/placeImage');
      const root = document.querySelector<HTMLElement>('[data-place-view]') ?? document.documentElement;
      const style = getComputedStyle(document.body);
      const s = placeSummary(data, shapes);
      const blob = await placeImage({
        shapes,
        countries: data.countries,
        cities: data.cities,
        ...(data.home?.cityId ? { homeCityId: data.home.cityId } : {}),
        background: style.backgroundColor || '#f4f5f7',
        ink: getComputedStyle(root).getPropertyValue('--place-ink').trim() || '#2b2b2b',
        visited,
        caption: [
          t('place.sum.countries', { n: String(s.countries) }),
          t('place.sum.percent', { n: String(s.percent) }),
          t('place.sum.continents', { n: String(s.continents) }),
          t('place.sum.cities', { n: String(s.cities) }),
        ].join(' · '),
      });
      if (!blob) throw new Error('no image');
      downloadBlob(blob, `24houring-place-${todayKey()}.png`);
      track('place_image', { kind: 'downloaded' });
      toast.success(t('place.pngSaved'));
    } catch {
      toast.error(t('place.pngError'));
    } finally {
      setBusy(null);
    }
  };

  const json = async () => {
    setBusy('json');
    try {
      const photos: Record<string, string> = {};
      await Promise.all(placePhotoIds(data).map(async (id) => {
        const url = await loadPhoto(id);
        if (url) photos[id] = url;
      }));
      const blob = new Blob([JSON.stringify(placeFile(data, photos), null, 2)], { type: 'application/json' });
      downloadBlob(blob, `24houring-place-${todayKey()}.json`);
      track('place_backup', { kind: 'json' });
    } finally {
      setBusy(null);
    }
  };

  const restore = async (picked: File | undefined) => {
    if (!picked) return;
    try {
      const back = readPlaceFile(await picked.text());
      await Promise.all(Object.entries(back.photos).map(([id, url]) => savePhoto(id, url)));
      api.replace(back.place);
      onOpenChange(false);
      toast.success(t('place.restored'));
    } catch {
      toast.error(t('place.restoreError'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto" data-place-export-dialog>
        <DialogHeader>
          <DialogTitle>{t('header.export')}</DialogTitle>
          <DialogDescription className="sr-only">{t('place.subtitle')}</DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-3">
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground">
            <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{t('place.exportPrivacy')}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={agreed} data-place-export-agree className="h-4 w-4"
              onChange={(e) => setAgreed(e.target.checked)} />
            {t('relation.exportAgree')}
          </label>
          <Button className="gap-1.5" disabled={!agreed || busy !== null} data-place-export-png onClick={() => void png()}>
            {busy === 'png' ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <ImageDown aria-hidden className="h-4 w-4" />}
            {t('place.export.png')}
          </Button>
        </section>

        <section className="mt-2 flex flex-col gap-2 border-t border-border pt-4">
          <Button variant="outline" className="gap-1.5" disabled={busy !== null} data-place-export-json onClick={() => void json()}>
            <FileJson aria-hidden className="h-4 w-4" />
            {t('place.export.json')}
          </Button>
          <input ref={file} type="file" accept="application/json,.json" className="sr-only" data-place-import-input
            onChange={(e) => { void restore(e.target.files?.[0]); e.target.value = ''; }} />
          <Button variant="ghost" className="gap-1.5" data-place-import-go onClick={() => file.current?.click()}>
            <Upload aria-hidden className="h-4 w-4" />
            {t('relation.restore')}
          </Button>
          <p className="text-[13px] text-muted-foreground">
            <Download aria-hidden className="mr-1 inline h-3.5 w-3.5" />
            {t('relation.backupHint')}
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}
