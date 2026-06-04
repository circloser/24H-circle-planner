import { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
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
  const [size, setSize] = useState<PngSize>(2160);
  const [transparent, setTransparent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    if (!svgRef.current) {
      toast.error('SVG 요소를 찾을 수 없습니다');
      return;
    }
    setLoading(true);
    try {
      const { exportPng } = await import('@/lib/export/png');
      const blob = await exportPng(svgRef.current, { size, transparent });
      const filename = `24h-${slug(scheduleName)}-${formatDateYYYYMMDD()}.png`;
      triggerDownload(blob, filename);
      toast.success('PNG 내보내기 완료');
    } catch (err) {
      toast.error(`PNG 내보내기 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      {/* Resolution selector */}
      <div>
        <p className="text-sm font-medium mb-2">해상도</p>
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

      {/* Transparent background toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={transparent}
          onClick={() => setTransparent((v) => !v)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none ${
            transparent ? 'bg-primary' : 'bg-input'
          }`}
        >
          <span
            className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
              transparent ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
        <span className="text-sm">투명 배경</span>
      </div>

      <Button onClick={handleExport} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        PNG 내보내기
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
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    if (!svgRef.current) {
      toast.error('SVG 요소를 찾을 수 없습니다');
      return;
    }
    setLoading(true);
    try {
      const { exportPdf } = await import('@/lib/export/pdf');
      const blob = await exportPdf(svgRef.current, { scheduleName });
      const filename = `24h-${slug(scheduleName)}-${formatDateYYYYMMDD()}.pdf`;
      triggerDownload(blob, filename);
      toast.success('PDF 내보내기 완료');
    } catch (err) {
      toast.error(`PDF 내보내기 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <p className="text-sm text-muted-foreground">A4 세로 300 DPI (210×297mm)</p>
      <Button onClick={handleExport} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        PDF 내보내기
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
      toast.success('JSON 내보내기 완료');
    } catch (err) {
      toast.error(`JSON 내보내기 실패: ${err instanceof Error ? err.message : String(err)}`);
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
      toast.error(`JSON 가져오기 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImportLoading(false);
      // Reset the file input so the same file can be re-imported
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleConfirmImport() {
    if (pendingSchedule) {
      onImport(pendingSchedule);
      toast.success('시간표를 가져왔습니다');
      setConfirmOpen(false);
      setPendingSchedule(null);
      onOpenChange(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <Button onClick={handleExport} disabled={exportLoading} className="w-full">
        {exportLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        JSON 내보내기
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
          JSON 가져오기
        </Button>
      </div>

      {/* Confirmation dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-background border rounded-lg p-6 max-w-sm w-full mx-4 shadow-lg">
            <h3 className="text-base font-semibold mb-2">시간표 가져오기</h3>
            <p className="text-sm text-muted-foreground mb-4">
              기존 시간표가 덮어쓰여집니다. 가져올까요?
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmOpen(false);
                  setPendingSchedule(null);
                }}
              >
                취소
              </Button>
              <Button onClick={handleConfirmImport}>가져오기</Button>
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>내보내기</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="png">
          <TabsList className="w-full">
            <TabsTrigger value="png" className="flex-1">PNG</TabsTrigger>
            <TabsTrigger value="pdf" className="flex-1">PDF</TabsTrigger>
            <TabsTrigger value="json" className="flex-1">JSON</TabsTrigger>
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
