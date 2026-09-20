import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileJson, Link2, Loader2, Printer, Share2, ShieldAlert, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';
import type { LifeApi } from '@/hooks/useLife';
import { downloadBlob } from '@/lib/share';
import { track } from '@/lib/track';
import { loadPhoto, savePhoto } from '@/lib/calendar-photos';
import { todayKey } from '@/lib/calendar-grid';
import {
  ageAt, buildTimeline, formatLifeDate, isFullDate, lifeSummary, readLifeFile,
  type LifeCategory, type LifeData,
} from '@/lib/life';
import { downloadLifeBackup } from '@/lib/life-backup';
import { cleanLifeDecor, decorPhotoIds, type LifeDecor } from '@/lib/life-decor';
import type { LifeDecorStore } from '@/hooks/useLifeDecor';
import { createLifeShareUrl } from '@/lib/life-share';
import type { LifeImageInput, LifeImageRow } from '@/lib/export/lifeImage';
import type { TKey } from '@/i18n/translations';
import { CATEGORY_LABEL, RELATION_LABEL } from './categories';

type T = (key: TKey, vars?: Record<string, string>) => string;

const loadImage = (url: string) => new Promise<HTMLImageElement | null>((done) => {
  const img = new Image();
  img.onload = () => done(img);
  img.onerror = () => done(null);
  img.src = url;
});

/** Everything the image needs, in words already translated. */
async function imageInput(life: LifeData, colors: Record<LifeCategory, string>, t: T, root: HTMLElement, decor?: LifeDecor): Promise<LifeImageInput> {
  const { resolveColors } = await import('@/lib/export/calendarImage');
  const today = todayKey();
  const birth = life.profile.birthDate;
  const s = lifeSummary(life, today);
  const age = (date: string) => {
    const a = ageAt(birth, date);
    return a ? t(a.approx ? 'life.ageApprox' : 'life.age', { n: String(a.years) }) : '';
  };
  const photos: Record<string, HTMLImageElement | null> = {};
  await Promise.all(life.milestones.filter((m) => m.photo).map(async (m) => {
    const url = await loadPhoto(m.photo!);
    photos[m.photo!] = url ? await loadImage(url) : null;
  }));
  // The pictures any photo decorations show, loaded like the moments' own.
  const decorPhotos: Record<string, CanvasImageSource | null> = {};
  await Promise.all([...new Set(decor ? decorPhotoIds(decor) : [])].map(async (id) => {
    const url = await loadPhoto(id);
    decorPhotos[id] = url ? await loadImage(url) : null;
  }));
  const rows: LifeImageRow[] = buildTimeline(life, { today }).map((it): LifeImageRow => {
    if (it.kind === 'decade') return { kind: 'decade', label: it.count ? `${it.decade}s  ${it.count}` : `${it.decade}s`, future: it.future, row: it.key };
    if (it.kind === 'today') return { kind: 'today', label: t('life.todayAge', { n: String(ageAt(birth, it.date)?.years ?? 0) }), row: 'today' };
    if (it.kind === 'birth') {
      return {
        kind: 'card', side: it.side, tight: it.tight, future: false, plan: false, color: colors.birth, row: 'birth',
        eyebrow: formatLifeDate(birth), title: t('life.born'), description: life.profile.name,
      };
    }
    const m = it.m;
    const when = m.endDate ? `${formatLifeDate(m.date)} – ${formatLifeDate(m.endDate)}` : formatLifeDate(m.date);
    return {
      kind: 'card', side: it.side, tight: it.tight, future: it.future, plan: it.plan, color: colors[m.category], row: m.id,
      eyebrow: [when, age(m.date), t(CATEGORY_LABEL[m.category]), it.plan ? t('life.planBadge') : ''].filter(Boolean).join(' · '),
      title: m.title, description: m.description, photo: m.photo ? photos[m.photo] : null,
    };
  });
  return {
    title: life.profile.name ? `${t('life.title')} · ${life.profile.name}` : t('life.title'),
    summary: [
      t('life.sumRecords', { n: String(s.records) }),
      t('life.sumPlans', { n: String(s.plans) }),
      s.age !== null ? t('life.sumAge', { n: String(s.age) }) : '',
    ].filter(Boolean).join(' · '),
    // The parents, as on the page (other relatives are not shown there).
    family: (['mother', 'father'] as const).flatMap((rel) => {
      const f = life.family.find((m) => m.relation === rel);
      return f ? [{ slot: rel, label: t(RELATION_LABEL[rel]), name: f.name, sub: f.birthDate ? formatLifeDate(f.birthDate) : undefined, note: f.note }] : [];
    }),
    rows,
    ending: life.endingNote ? { title: t('life.endingNote'), text: life.endingNote.text } : null,
    footer: '24houring.com',
    ...(decor && Object.keys(decor).length ? { decor, decorPhotos } : {}),
    colors: resolveColors(root, {
      background: 'hsl(var(--background))',
      surface: 'hsl(var(--surface))',
      border: 'hsl(var(--border))',
      text: 'hsl(var(--foreground))',
      muted: 'hsl(var(--muted-foreground))',
      primary: 'hsl(var(--primary))',
    }),
  };
}

/**
 * The life page's export: one tall image (after a look at what it shows —
 * family names and birthdays are other people's details), or the JSON backup
 * and its restore.
 */
export function LifeExportDialog({ open, onOpenChange, api, colors, decor }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  api: LifeApi;
  colors: Record<LifeCategory, string>;
  /** The decorations laid over the line: they ride along in the backup. */
  decor?: LifeDecorStore;
}) {
  const { t } = useTranslation();
  const { life } = api;
  // Before a birthday there is no line to draw — only a backup to bring back
  // (the first screen after clearing the browser).
  const hasLine = isFullDate(life.profile.birthDate);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [restore, setRestore] = useState<ReturnType<typeof readLifeFile> | null>(null);
  const [hideNames, setHideNames] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] });

  const make = async (scale: number) => {
    const { renderLifeImage } = await import('@/lib/export/lifeImage');
    return renderLifeImage(await imageInput(life, colors, t, rootRef.current ?? document.body, decor?.rows), scale);
  };

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setChecked(false);
    setRestore(null);
    setShareUrl(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (!hasLine) return;
    let live = true;
    let url: string | null = null;
    void make(0.4).then((blob) => {
      if (!live) return;
      url = URL.createObjectURL(blob);
      setPreview(url);
    }).catch(() => { /* the buttons still work without a preview */ });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
      setPreview(null);
    };
    // Rendered once per opening; the dialog blocks edits meanwhile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const image = async (how: 'save' | 'share') => {
    if (busy || !checked) return;
    setBusy(true);
    try {
      const blob = await make(2);
      const name = `24houring-life-${todayKey()}.png`;
      if (how === 'share') {
        await navigator.share({ files: [new File([blob], name, { type: 'image/png' })], title: '24Houring', text: t('life.imageShareText') });
        track('life_image', { outcome: 'shared' });
      } else {
        downloadBlob(blob, name);
        track('life_image', { outcome: 'downloaded' });
        toast.success(t('life.imageSaved'));
      }
      onOpenChange(false);
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') track('life_image', { outcome: 'cancelled' });
      else toast.error(t('life.imageError'));
    } finally {
      setBusy(false);
    }
  };

  /** The same tall image, cut into A4 pages to print. */
  const asPdf = async () => {
    if (busy || !checked) return;
    setBusy(true);
    try {
      const { lifePdf } = await import('@/lib/export/lifePdf');
      downloadBlob(await lifePdf(await make(2)), `24houring-life-${todayKey()}.pdf`);
      track('life_image', { outcome: 'pdf' });
      toast.success(t('life.pdfSaved'));
      onOpenChange(false);
    } catch {
      toast.error(t('life.pdfError'));
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setRestore(readLifeFile(await file.text()));
    } catch {
      toast.error(t('life.export.importError'));
    }
  };
  const confirmRestore = async () => {
    if (!restore) return;
    await Promise.all(Object.entries(restore.photos).map(([id, url]) => savePhoto(id, url)));
    api.replace(restore.life);
    const rows = cleanLifeDecor(restore.decor);
    if (rows && decor) decor.replaceAll(rows);
    setRestore(null);
    toast.success(t('life.export.imported'));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto" data-life-export-dialog>
        <div ref={rootRef} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('life.export.title')}</DialogTitle>
            <DialogDescription>{t(hasLine ? 'life.export.pngNote' : 'life.export.jsonNote')}</DialogDescription>
          </DialogHeader>
          {hasLine && <>
          <div className="grid max-h-72 min-h-[160px] place-items-start overflow-y-auto rounded-lg border border-border bg-muted/30" data-life-export-preview>
            {preview
              ? <img src={preview} alt={t('life.title')} className="block w-full" />
              : <Loader2 className="m-auto h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
          <label className="flex gap-2 rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            <input type="checkbox" data-life-export-check checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex gap-1.5">
              <ShieldAlert aria-hidden className="h-4 w-4 shrink-0" />
              {t('life.export.privacy')}
            </span>
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            {canShare && (
              <Button variant="outline" disabled={busy || !checked} onClick={() => void image('share')} className="gap-1.5" data-life-export-share>
                <Share2 aria-hidden className="h-4 w-4" />
                {t('calendar.exportShare')}
              </Button>
            )}
            <Button variant="outline" disabled={busy || !checked} onClick={() => void asPdf()} className="gap-1.5" data-life-export-pdf>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer aria-hidden className="h-4 w-4" />}
              {t('life.export.pdf')}
            </Button>
            <Button disabled={busy || !checked} onClick={() => void image('save')} className="gap-1.5 bg-primary text-primary-foreground" data-life-export-png>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download aria-hidden className="h-4 w-4" />}
              {t('life.export.png')}
            </Button>
          </div>

          {/* A read-only link for the family. No photos travel, and the
              names can be left out — they are other people's to give. */}
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">{t('life.share.title')}</p>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" data-life-share-hide checked={hideNames} onChange={(e) => setHideNames(e.target.checked)} className="h-4 w-4" />
              {t('life.share.hideNames')}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" data-life-share disabled={sharing}
                onClick={() => {
                  setSharing(true);
                  void createLifeShareUrl(life, { hideNames })
                    .then(async (url) => {
                      if (!url) return toast.error(t('life.share.failed'));
                      setShareUrl(url);
                      track('life_share');
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success(t('life.share.copied'));
                      } catch {
                        toast.success(t('life.share.made'));
                      }
                    })
                    .finally(() => setSharing(false));
                }}>
                {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 aria-hidden className="h-4 w-4" />}
                {t('life.share.make')}
              </Button>
              {shareUrl && (
                <input readOnly value={shareUrl} data-life-share-url onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1 text-xs text-muted-foreground" />
              )}
            </div>
          </div>
          </>}
          <div className={`flex flex-col gap-2 ${hasLine ? 'border-t border-border pt-4' : ''}`}>
            <p className="text-sm font-medium text-foreground">{t('life.export.jsonTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('life.export.jsonNote')}</p>
            {restore ? (
              <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-3 text-sm" data-life-import-confirm>
                <p>{t('life.export.importConfirm', { n: String(restore.life.milestones.length) })}</p>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setRestore(null)}>{t('common.cancel')}</Button>
                  <Button size="sm" variant="destructive" data-life-import-go onClick={() => void confirmRestore()}>{t('life.export.importGo')}</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" data-life-export-json
                  onClick={() => { void downloadLifeBackup(life, decor?.rows).then(() => toast.success(t('life.export.jsonSaved'))); }}>
                  <FileJson aria-hidden className="h-4 w-4" />
                  {t('life.backup.download')}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" data-life-import onClick={() => fileRef.current?.click()}>
                  <Upload aria-hidden className="h-4 w-4" />
                  {t('life.export.import')}
                </Button>
              </div>
            )}
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" data-life-import-input
              onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
