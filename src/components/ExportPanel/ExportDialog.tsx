import { useState, useRef, useEffect } from 'react';
import { Loader2, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { slug, formatDateYYYYMMDD } from '@/lib/export/_internal';
import { buildExportPreviewDataUrl } from '@/lib/export/previewSvg';
import { exportAllData, importAllData } from '@/lib/backup';
import { useTranslation } from '@/hooks/usePreferences';
import type { Schedule } from '@/types/schedule';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
  scheduleName: string;
  schedule: Schedule;
  onImport: (schedule: Schedule) => void;
}

// ─── Download helper ──────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ─── PNG Tab ──────────────────────────────────────────────────────────────────

type PngSize = 1080 | 2160 | 3840;

function PngTab({
  svgRef,
  scheduleName,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>;
  scheduleName: string;
}) {
  const { t } = useTranslation();
  const [size, setSize] = useState<PngSize>(2160);
  const [transparent, setTransparent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    if (!svgRef.current) {
      toast.error(t('export.svgNotFound'));
      return;
    }
    setLoading(true);
    try {
      const { exportPng } = await import('@/lib/export/png');
      const blob = await exportPng(svgRef.current, { size, transparent });
      const filename = `24h-${slug(scheduleName)}-${formatDateYYYYMMDD()}.png`;
      triggerDownload(blob, filename);
      toast.success(t('export.pngDone'));
    } catch (err) {
      toast.error(`${t('export.pngFail')}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      {/* Resolution selector */}
      <div>
        <p className="text-sm font-medium mb-2">{t('export.resolution')}</p>
        <div className="flex gap-2">
          {([1080, 2160, 3840] as PngSize[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                size === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-muted'
              }`}
            >
              {s === 1080 ? '1080px' : s === 2160 ? '2K (2160px)' : '4K (3840px)'}
            </button>
          ))}
        </div>
      </div>

      {/* Transparent background toggle. Inline hsl(var(--…)) colours because this
          Tailwind v4 setup has no @theme, so bg-primary/bg-input/bg-background
          utilities generate no CSS — the switch would otherwise be invisible. */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={transparent}
          onClick={() => setTransparent((v) => !v)}
          className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            backgroundColor: transparent ? 'hsl(var(--primary))' : 'hsl(var(--text-muted) / 0.3)',
            borderColor: transparent ? 'hsl(var(--primary))' : 'hsl(var(--text-muted) / 0.45)',
          }}
        >
          <span
            className={`pointer-events-none block h-5 w-5 rounded-full shadow-md transition-transform ${
              transparent ? 'translate-x-5' : 'translate-x-0.5'
            }`}
            style={{ backgroundColor: '#ffffff', border: '1px solid hsl(var(--text-muted) / 0.3)' }}
          />
        </button>
        <span className="text-sm">{t('export.transparentBg')}</span>
      </div>

      <Button onClick={handleExport} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {t('export.png')}
      </Button>
    </div>
  );
}

// ─── PDF Tab ──────────────────────────────────────────────────────────────────

function PdfTab({
  svgRef,
  scheduleName,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>;
  scheduleName: string;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    if (!svgRef.current) {
      toast.error(t('export.svgNotFound'));
      return;
    }
    setLoading(true);
    try {
      const { exportPdf } = await import('@/lib/export/pdf');
      const blob = await exportPdf(svgRef.current, { scheduleName });
      const filename = `24h-${slug(scheduleName)}-${formatDateYYYYMMDD()}.pdf`;
      triggerDownload(blob, filename);
      toast.success(t('export.pdfDone'));
    } catch (err) {
      toast.error(`${t('export.pdfFail')}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <p className="text-sm text-muted-foreground">{t('export.pdfNote')}</p>
      <Button onClick={handleExport} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {t('export.pdf')}
      </Button>
    </div>
  );
}

// ─── JSON Tab ─────────────────────────────────────────────────────────────────

function JsonTab({
  schedule,
  scheduleName,
  onImport,
  onOpenChange,
}: {
  schedule: Schedule;
  scheduleName: string;
  onImport: (s: Schedule) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState<Schedule | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleExport() {
    setExportLoading(true);
    try {
      const { exportScheduleAsJson } = await import('@/lib/export/jsonIo');
      const blob = exportScheduleAsJson(schedule);
      const filename = `24h-${slug(scheduleName)}-${formatDateYYYYMMDD()}.json`;
      triggerDownload(blob, filename);
      toast.success(t('export.jsonDone'));
    } catch (err) {
      toast.error(`${t('export.jsonFail')}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportLoading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const { importScheduleFromJson } = await import('@/lib/export/jsonIo');
      const imported = await importScheduleFromJson(file);
      setPendingSchedule(imported);
      setConfirmOpen(true);
    } catch (err) {
      toast.error(`${t('export.jsonImportFail')}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImportLoading(false);
      // Reset the file input so the same file can be re-imported
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleConfirmImport() {
    if (pendingSchedule) {
      onImport(pendingSchedule);
      toast.success(t('export.imported'));
      setConfirmOpen(false);
      setPendingSchedule(null);
      onOpenChange(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <Button onClick={handleExport} disabled={exportLoading} className="w-full">
        {exportLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {t('export.jsonExport')}
      </Button>

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          id="json-import-input"
          onChange={handleFileChange}
        />
        <Button
          variant="outline"
          className="w-full"
          disabled={importLoading}
          onClick={() => fileInputRef.current?.click()}
        >
          {importLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {t('export.jsonImport')}
        </Button>
      </div>

      {/* Confirmation dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div role="dialog" className="bg-background border rounded-lg p-6 max-w-sm w-full mx-4 shadow-lg">
            <h3 className="text-base font-semibold mb-2">{t('export.importTitle')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('export.importBody')}
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmOpen(false);
                  setPendingSchedule(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button onClick={handleConfirmImport}>{t('export.importConfirm')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Live preview (matches the exported artifact) ─────────────────────────────

/**
 * Renders a preview of exactly what will be exported — the chart with the live
 * clock and now-line stripped (via the shared export clone pipeline). Rebuilt
 * whenever the dialog opens or the schedule changes.
 */
function ExportPreview({
  open,
  svgRef,
  schedule,
}: {
  open: boolean;
  svgRef: React.RefObject<SVGSVGElement | null>;
  schedule: Schedule;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !svgRef.current) {
      setUrl(null);
      return;
    }
    try {
      setUrl(buildExportPreviewDataUrl(svgRef.current));
    } catch {
      setUrl(null);
    }
    // Rebuild on open and whenever the schedule content changes.
  }, [open, svgRef, schedule]);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{t('export.preview')}</p>
      <div
        className="mx-auto grid aspect-square w-full max-w-[260px] place-items-center overflow-hidden rounded-lg border bg-muted/30"
        data-export-exclude="true"
      >
        {url ? (
          <img src={url} alt={t('export.preview')} className="h-full w-full object-contain" />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

// ─── Ad slot (reserved space for a future ad unit) ────────────────────────────

/**
 * Reserved space for an advertisement shown alongside the export preview. Today
 * it is a labelled placeholder; a real ad unit (e.g. an AdSense <ins> block) can
 * be mounted inside this container without touching the surrounding layout.
 */
function AdSlot() {
  const { t } = useTranslation();
  return (
    <div
      data-ad-slot="export"
      aria-label={t('export.adLabel')}
      className="flex h-[90px] w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-center"
    >
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
        {t('export.adLabel')}
      </span>
    </div>
  );
}

// ─── Backup Tab (full-data safety net) ────────────────────────────────────────

/**
 * Whole-app backup: export every localStorage key to one file, and restore it
 * (overwriting current data, then reloading). The client-only answer to "what if
 * I lose my data?" — back up and carry it to another device/browser.
 */
function BackupTab({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const [exportLoading, setExportLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleExport() {
    setExportLoading(true);
    try {
      triggerDownload(exportAllData(), `24h-backup-${formatDateYYYYMMDD()}.json`);
      toast.success(t('export.backupDone'));
    } catch (err) {
      toast.error(`${t('export.backupFail')}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setConfirmOpen(true);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleConfirmRestore() {
    if (!pendingFile) return;
    setRestoreLoading(true);
    try {
      await importAllData(pendingFile);
      toast.success(t('export.restored'));
      setConfirmOpen(false);
      onOpenChange(false);
      // Reload so every provider re-reads the restored storage.
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      toast.error(`${t('export.restoreFail')}: ${err instanceof Error ? err.message : String(err)}`);
      setRestoreLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <p className="text-sm text-muted-foreground">{t('export.backupNote')}</p>

      <Button
        onClick={handleExport}
        disabled={exportLoading}
        className="w-full gap-2"
        style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
      >
        {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {t('export.backupExport')}
      </Button>

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          variant="outline"
          className="w-full gap-2"
          disabled={restoreLoading}
          onClick={() => fileInputRef.current?.click()}
          style={{ backgroundColor: 'hsl(var(--surface))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}
        >
          {restoreLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {t('export.backupRestore')}
        </Button>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div role="dialog" className="bg-background border rounded-lg p-6 max-w-sm w-full mx-4 shadow-lg">
            <h3 className="text-base font-semibold mb-2">{t('export.restoreTitle')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('export.restoreBody')}</p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => { setConfirmOpen(false); setPendingFile(null); }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleConfirmRestore}
                disabled={restoreLoading}
                style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
              >
                {t('export.restoreConfirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ExportDialog ─────────────────────────────────────────────────────────────

export function ExportDialog({
  open,
  onOpenChange,
  svgRef,
  scheduleName,
  schedule,
  onImport,
}: ExportDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('header.export')}</DialogTitle>
        </DialogHeader>

        <ExportPreview open={open} svgRef={svgRef} schedule={schedule} />
        <AdSlot />

        <Tabs defaultValue="png">
          <TabsList className="w-full">
            <TabsTrigger value="png" className="flex-1">PNG</TabsTrigger>
            <TabsTrigger value="pdf" className="flex-1">PDF</TabsTrigger>
            <TabsTrigger value="json" className="flex-1">JSON</TabsTrigger>
            <TabsTrigger value="backup" className="flex-1">{t('export.backup')}</TabsTrigger>
          </TabsList>

          <TabsContent value="png">
            <PngTab svgRef={svgRef} scheduleName={scheduleName} />
          </TabsContent>

          <TabsContent value="pdf">
            <PdfTab svgRef={svgRef} scheduleName={scheduleName} />
          </TabsContent>

          <TabsContent value="json">
            <JsonTab
              schedule={schedule}
              scheduleName={scheduleName}
              onImport={onImport}
              onOpenChange={onOpenChange}
            />
          </TabsContent>

          <TabsContent value="backup">
            <BackupTab onOpenChange={onOpenChange} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
