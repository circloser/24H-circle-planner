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
import { exportTableCsv, exportTablePng, buildTableSvg } from '@/lib/export/tableExport';
import { exportRangePng, exportRangeCsv, type RangeDay } from '@/lib/export/rangeExport';
import { useDiary, dateKey } from '@/hooks/useDiary';
import { useTranslation, useChartView, useShowIcons } from '@/hooks/usePreferences';
import type { Schedule } from '@/types/schedule';
import type { TimeSlice } from '@/types/time-slice';

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
        className="mx-auto grid aspect-square w-full max-w-[260px] place-items-center overflow-hidden rounded-lg bg-muted/30"
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

// ─── Table tabs (shown in table view) ────────────────────────────────────────

function TableImageTab({ slices, scheduleName, showIcons }: { slices: TimeSlice[]; scheduleName: string; showIcons: boolean }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  async function handleExport() {
    setLoading(true);
    try {
      await exportTablePng(slices, scheduleName, { showIcons });
      toast.success(t('table.exported'));
    } catch (err) {
      toast.error(`${t('export.pngFail')}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="flex flex-col gap-4 pt-2">
      <p className="text-sm text-muted-foreground">{t('export.tableImageNote')}</p>
      <Button onClick={handleExport} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {t('export.tableImage')}
      </Button>
    </div>
  );
}

function CsvTab({ slices, scheduleName }: { slices: TimeSlice[]; scheduleName: string }) {
  const { t } = useTranslation();
  function handleExport() {
    exportTableCsv(slices, scheduleName);
    toast.success(t('table.exported'));
  }
  return (
    <div className="flex flex-col gap-4 pt-2">
      <p className="text-sm text-muted-foreground">{t('export.csvNote')}</p>
      <Button onClick={handleExport} className="w-full">{t('export.csvSave')}</Button>
    </div>
  );
}

/** Preview of the table image (the table view has no chart SVG to preview). */
function TablePreview({ schedule, showIcons }: { schedule: Schedule; showIcons: boolean }) {
  const { t } = useTranslation();
  const { svg } = buildTableSvg(schedule.slices, schedule.name, { showIcons });
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{t('export.preview')}</p>
      <div className="mx-auto max-h-[240px] w-full max-w-[300px] overflow-auto rounded-lg bg-muted/30 p-2" data-export-exclude="true">
        <img src={url} alt={t('export.preview')} className="w-full" />
      </div>
    </div>
  );
}

// ─── ExportDialog ─────────────────────────────────────────────────────────────

/**
 * Date-range export: pick a start/end date, choose circle or table, and export
 * every saved diary in the range as ONE image (or a multi-day CSV).
 */
function RangeTab({ showIcons }: { showIcons: boolean }) {
  const { t, lang } = useTranslation();
  const { entries } = useDiary();
  const today = dateKey();
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [format, setFormat] = useState<'circle' | 'table'>('circle');
  const [busy, setBusy] = useState(false);

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'hsl(var(--surface))',
    border: '1px solid hsl(var(--border))',
    color: 'hsl(var(--foreground))',
  };

  function fmtDay(key: string): string {
    const [y, m, d] = key.split('-').map(Number);
    if (!y || !m || !d) return key;
    return new Date(y, m - 1, d).toLocaleDateString(lang, { month: 'long', day: 'numeric', weekday: 'short' });
  }

  function collect(): RangeDay[] {
    if (!start || !end || start > end) return [];
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    if (!sy || !ey) return [];
    const cur = new Date(sy, sm - 1, sd);
    const endD = new Date(ey, em - 1, ed);
    const days: RangeDay[] = [];
    let guard = 0;
    while (cur <= endD && guard < 400) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
      const e = entries[key];
      if (e) {
        const nm = (e.name || '').trim();
        days.push({ date: key, label: fmtDay(key) + (nm ? ` · ${nm}` : ''), slices: e.slices });
      }
      cur.setDate(cur.getDate() + 1);
      guard += 1;
    }
    return days;
  }

  const count = collect().length;
  const title = `${fmtDay(start)} ~ ${fmtDay(end)}`;

  async function doImage() {
    const days = collect();
    if (days.length === 0) { toast(t('export.rangeEmpty')); return; }
    setBusy(true);
    try {
      await exportRangePng(days, title, format, { showIcons });
      toast.success(t('export.rangeSaved', { n: String(days.length) }));
    } catch {
      toast.error(t('export.rangeFailed'));
    } finally {
      setBusy(false);
    }
  }
  function doCsv() {
    const days = collect();
    if (days.length === 0) { toast(t('export.rangeEmpty')); return; }
    exportRangeCsv(days, title);
    toast.success(t('export.rangeSaved', { n: String(days.length) }));
  }

  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: 'hsl(var(--foreground))' }}>
        <input type="date" value={start} max={end || undefined} onChange={(e) => setStart(e.target.value)} className="rounded-md px-2 py-1.5 outline-none" style={inputStyle} aria-label={t('export.rangeStart')} />
        <span>~</span>
        <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} className="rounded-md px-2 py-1.5 outline-none" style={inputStyle} aria-label={t('export.rangeEnd')} />
      </div>

      <div className="flex self-start overflow-hidden rounded-md" style={{ border: '1px solid hsl(var(--border))' }}>
        {(['circle', 'table'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFormat(f)}
            className="px-3 py-1.5 text-sm transition-colors"
            style={format === f ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' } : { color: 'hsl(var(--text-muted))' }}
          >
            {f === 'circle' ? t('export.rangeCircle') : t('export.rangeTable')}
          </button>
        ))}
      </div>

      <p className="text-xs" style={{ color: 'hsl(var(--text-muted))' }}>{t('export.rangeCount', { n: String(count) })}</p>

      <Button onClick={doImage} disabled={busy || count === 0} className="w-full gap-2" style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {t('export.rangeImage')}
      </Button>
      <button
        type="button"
        onClick={doCsv}
        disabled={count === 0}
        className="self-center text-xs underline disabled:opacity-40"
        style={{ color: 'hsl(var(--text-muted))' }}
      >
        {t('export.rangeCsv')}
      </button>
    </div>
  );
}

export function ExportDialog({
  open,
  onOpenChange,
  svgRef,
  scheduleName,
  schedule,
  onImport,
}: ExportDialogProps) {
  const { t } = useTranslation();
  const isTable = useChartView() === 'table';
  const showIcons = useShowIcons();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('header.export')}</DialogTitle>
        </DialogHeader>

        {/* In table view the chart isn't rendered, so preview/export the table. */}
        {isTable
          ? <TablePreview schedule={schedule} showIcons={showIcons} />
          : <ExportPreview open={open} svgRef={svgRef} schedule={schedule} />}
        <AdSlot />

        <Tabs defaultValue={isTable ? 'image' : 'png'} key={isTable ? 'table' : 'chart'}>
          <TabsList className="w-full">
            {isTable ? (
              <>
                <TabsTrigger value="image" className="flex-1">{t('table.image')}</TabsTrigger>
                <TabsTrigger value="csv" className="flex-1">CSV</TabsTrigger>
              </>
            ) : (
              <>
                <TabsTrigger value="png" className="flex-1">PNG</TabsTrigger>
                <TabsTrigger value="pdf" className="flex-1">PDF</TabsTrigger>
              </>
            )}
            <TabsTrigger value="range" className="flex-1">{t('export.range')}</TabsTrigger>
            <TabsTrigger value="json" className="flex-1">JSON</TabsTrigger>
            <TabsTrigger value="backup" className="flex-1">{t('export.backup')}</TabsTrigger>
          </TabsList>

          {isTable ? (
            <>
              <TabsContent value="image">
                <TableImageTab slices={schedule.slices} scheduleName={scheduleName} showIcons={showIcons} />
              </TabsContent>
              <TabsContent value="csv">
                <CsvTab slices={schedule.slices} scheduleName={scheduleName} />
              </TabsContent>
            </>
          ) : (
            <>
              <TabsContent value="png">
                <PngTab svgRef={svgRef} scheduleName={scheduleName} />
              </TabsContent>
              <TabsContent value="pdf">
                <PdfTab svgRef={svgRef} scheduleName={scheduleName} />
              </TabsContent>
            </>
          )}

          <TabsContent value="range">
            <RangeTab showIcons={showIcons} />
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
