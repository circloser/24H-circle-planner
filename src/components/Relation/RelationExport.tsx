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
  RELATION_GROUPS, readRelationFile, relationFile, relationPhotoIds, relationSummary,
  type RelationGroup,
} from '@/lib/relation';
import type { RelationApi } from '@/hooks/useRelation';
import { GROUP_LABEL } from './groups';

const loadImage = (url: string) => new Promise<HTMLImageElement | null>((done) => {
  const img = new Image();
  img.onload = () => done(img);
  img.onerror = () => done(null);
  img.src = url;
});

/**
 * Saving the map: a picture to keep, or the JSON that brings everything back.
 *
 * Both carry other people's names, so the picture is only made after the
 * warning has been read — the same step the life line's export takes.
 */
export function RelationExportDialog({ open, onOpenChange, api, colors }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  api: RelationApi;
  colors: Record<RelationGroup, string>;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<'png' | 'json' | null>(null);
  const [agreed, setAgreed] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const { data } = api;

  const png = async () => {
    setBusy('png');
    try {
      const { relationImage } = await import('@/lib/export/relationImage');
      // The two colours the picture needs are published on the view itself
      // (see index.css), because a canvas cannot read Tailwind classes.
      const root = document.querySelector<HTMLElement>('[data-relation-view]') ?? document.documentElement;
      const style = getComputedStyle(document.body);
      const photos: Record<string, CanvasImageSource | null> = {};
      await Promise.all(relationPhotoIds(data).map(async (id) => {
        const url = await loadPhoto(id);
        photos[id] = url ? await loadImage(url) : null;
      }));
      const today = todayKey();
      const s = relationSummary(data, today);
      const blob = await relationImage({
        data,
        colors,
        today,
        background: style.backgroundColor || '#f4f5f7',
        ink: getComputedStyle(root).getPropertyValue('--relation-ink').trim() || '#2b2b2b',
        accent: getComputedStyle(root).getPropertyValue('--relation-accent').trim() || '#2f6feb',
        meLabel: t('relation.me.short'),
        groupLabel: Object.fromEntries(RELATION_GROUPS.map((g) => [g, t(GROUP_LABEL[g])])) as Record<RelationGroup, string>,
        photos,
        caption: [
          t('relation.sum.people', { n: String(s.people) }),
          ...RELATION_GROUPS.filter((g) => s.byGroup[g] > 0).map((g) => `${t(GROUP_LABEL[g])} ${s.byGroup[g]}`),
        ].join(' · '),
      });
      if (!blob) throw new Error('no image');
      downloadBlob(blob, `24houring-relation-${today}.png`);
      track('relation_image', { kind: 'downloaded' });
      toast.success(t('relation.pngSaved'));
    } catch {
      toast.error(t('relation.pngError'));
    } finally {
      setBusy(null);
    }
  };

  const json = async () => {
    setBusy('json');
    try {
      const photos: Record<string, string> = {};
      await Promise.all(relationPhotoIds(data).map(async (id) => {
        const url = await loadPhoto(id);
        if (url) photos[id] = url;
      }));
      const blob = new Blob([JSON.stringify(relationFile(data, photos), null, 2)], { type: 'application/json' });
      downloadBlob(blob, `24houring-relation-${todayKey()}.json`);
      track('relation_backup', { kind: 'json' });
    } finally {
      setBusy(null);
    }
  };

  const restore = async (picked: File | undefined) => {
    if (!picked) return;
    try {
      const back = readRelationFile(await picked.text());
      await Promise.all(Object.entries(back.photos).map(([id, url]) => savePhoto(id, url)));
      api.replace(back.relation);
      onOpenChange(false);
      toast.success(t('relation.restored'));
    } catch {
      toast.error(t('relation.restoreError'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto" data-relation-export-dialog>
        <DialogHeader>
          <DialogTitle>{t('header.export')}</DialogTitle>
          <DialogDescription className="sr-only">{t('relation.subtitle')}</DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-3">
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground">
            <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{t('relation.exportPrivacy')}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={agreed} data-relation-export-agree className="h-4 w-4"
              onChange={(e) => setAgreed(e.target.checked)} />
            {t('relation.exportAgree')}
          </label>
          <Button className="gap-1.5" disabled={!agreed || busy !== null} data-relation-export-png onClick={() => void png()}>
            {busy === 'png' ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <ImageDown aria-hidden className="h-4 w-4" />}
            {t('relation.export.png')}
          </Button>
        </section>

        <section className="mt-2 flex flex-col gap-2 border-t border-border pt-4">
          <Button variant="outline" className="gap-1.5" disabled={busy !== null} data-relation-export-json onClick={() => void json()}>
            <FileJson aria-hidden className="h-4 w-4" />
            {t('relation.export.json')}
          </Button>
          <input ref={file} type="file" accept="application/json,.json" className="sr-only" data-relation-import-input
            onChange={(e) => { void restore(e.target.files?.[0]); e.target.value = ''; }} />
          <Button variant="ghost" className="gap-1.5" data-relation-import-go onClick={() => file.current?.click()}>
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
