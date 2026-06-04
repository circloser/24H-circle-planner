import { useEffect, useRef, useState } from 'react';
import { CircleTimeline } from '@/components/CircleTimeline/CircleTimeline';
import { PRESETS } from '@/data/presets';
import type { TimeSlice } from '@/types/time-slice';

// Worker preset — matches the 직장인 9 to 6 preset exactly
const WORKER_PRESET_NAME = '직장인 9 to 6';
const workerPreset = PRESETS.find((p) => p.name === WORKER_PRESET_NAME);

// ─── Spike result shape exposed on window ─────────────────────────────────────

interface SpikeResults {
  complete: boolean;
  coldPngMs: number;
  coldPdfMs: number;
  warmPngMs: number;
  warmPdfMs: number;
  glassDiffPct: number;
  nonGlassDiffPct: number;
  verdicts: {
    G8_cold_png: boolean;
    G8_cold_pdf: boolean;
    G8_warm_png: boolean;
    G8_warm_pdf: boolean;
    G7_glass: boolean;
    G7_nonGlass: boolean;
  };
  pngBlob?: Blob;
  pdfBlob?: Blob;
  error?: string;
}

// ─── SpikeRunner ──────────────────────────────────────────────────────────────

/**
 * SpikeRunner — mounted when ?spike=1 is in the URL.
 * Renders the 직장인 9 to 6 preset into a hidden CircleTimeline, runs cold+warm
 * export, pixel-diffs the result, and exposes __spikeResults on window.
 *
 * Used by scripts/run-export-spike.mjs (Playwright + CDP runner).
 */
export function SpikeRunner() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [results, setResults] = useState<SpikeResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  const slices: TimeSlice[] = workerPreset?.slices ?? [];

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    // Small delay to ensure CircleTimeline has fully rendered
    const timer = setTimeout(() => {
      void runSpike();
    }, 500);

    return () => clearTimeout(timer);

    async function runSpike() {
      try {
        const svg = svgRef.current;
        if (!svg) throw new Error('SpikeRunner: svgRef is null after mount');

        const { exportPng } = await import('@/lib/export/png');
        const { exportPdf } = await import('@/lib/export/pdf');
        const { compareScreenToExport } = await import('@/lib/export/pixelDiff');

        // ── Cold export ────────────────────────────────────────────────────────
        const coldPngStart = performance.now();
        const pngBlob = await exportPng(svg, { size: 1080, transparent: false });
        const coldPngMs = performance.now() - coldPngStart;

        const coldPdfStart = performance.now();
        const pdfBlob = await exportPdf(svg, { scheduleName: WORKER_PRESET_NAME });
        const coldPdfMs = performance.now() - coldPdfStart;

        // ── Idle 1s between cold and warm ──────────────────────────────────────
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));

        // ── Warm export ────────────────────────────────────────────────────────
        const warmPngStart = performance.now();
        await exportPng(svg, { size: 1080, transparent: false });
        const warmPngMs = performance.now() - warmPngStart;

        const warmPdfStart = performance.now();
        await exportPdf(svg, { scheduleName: WORKER_PRESET_NAME });
        const warmPdfMs = performance.now() - warmPdfStart;

        // ── Pixel-diff (G7) ────────────────────────────────────────────────────
        const { glassDiffPct, nonGlassDiffPct } = await compareScreenToExport(
          svg,
          pngBlob,
          { size: 1080 },
        );

        // ── Verdicts ───────────────────────────────────────────────────────────
        // G8 threshold: ≤ 3000 ms warm export
        const G8_WARM_THRESHOLD_MS = 3000;
        const G8_COLD_THRESHOLD_MS = 10000; // Cold has no hard limit, tracked for info

        const spikeResults: SpikeResults = {
          complete: true,
          coldPngMs,
          coldPdfMs,
          warmPngMs,
          warmPdfMs,
          glassDiffPct,
          nonGlassDiffPct,
          verdicts: {
            G8_cold_png: coldPngMs <= G8_COLD_THRESHOLD_MS,
            G8_cold_pdf: coldPdfMs <= G8_COLD_THRESHOLD_MS,
            G8_warm_png: warmPngMs <= G8_WARM_THRESHOLD_MS,
            G8_warm_pdf: warmPdfMs <= G8_WARM_THRESHOLD_MS,
            G7_glass: glassDiffPct <= 12,
            G7_nonGlass: nonGlassDiffPct <= 5,
          },
          pngBlob,
          pdfBlob,
        };

        // Expose on window for Playwright runner
        (window as unknown as Record<string, unknown>)['__spikeResults'] = spikeResults;
        setResults(spikeResults);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const failedResults: SpikeResults = {
          complete: true,
          coldPngMs: 0,
          coldPdfMs: 0,
          warmPngMs: 0,
          warmPdfMs: 0,
          glassDiffPct: 0,
          nonGlassDiffPct: 0,
          verdicts: {
            G8_cold_png: false,
            G8_cold_pdf: false,
            G8_warm_png: false,
            G8_warm_pdf: false,
            G7_glass: false,
            G7_nonGlass: false,
          },
          error: msg,
        };
        (window as unknown as Record<string, unknown>)['__spikeResults'] = failedResults;
        setError(msg);
      }
    }
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────────

  const verdictRow = (label: string, pass: boolean) => (
    <tr key={label}>
      <td className="pr-4 font-mono text-sm">{label}</td>
      <td className={pass ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
        {pass ? 'PASS' : 'FAIL'}
      </td>
    </tr>
  );

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
        SpikeRunner — Export Pipeline Verification
      </h1>

      {/* Hidden CircleTimeline — used as the SVG source for export */}
      <div style={{ position: 'fixed', top: -9999, left: -9999, width: 1000, height: 1000, pointerEvents: 'none', opacity: 0 }}>
        <CircleTimeline
          slices={slices}
          mode="preview"
          interactionMode="view"
          svgRef={svgRef}
          size={1000}
        />
      </div>

      {error && (
        <div style={{ color: 'red', marginBottom: 12 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!results && !error && (
        <p>Running export pipeline… (cold export + 1s idle + warm export + pixel-diff)</p>
      )}

      {results && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 'semibold', marginBottom: 8 }}>Timings</h2>
          <table style={{ borderCollapse: 'collapse', marginBottom: 16 }}>
            <tbody>
              <tr><td className="pr-4 text-sm">Cold PNG</td><td>{results.coldPngMs.toFixed(0)} ms</td></tr>
              <tr><td className="pr-4 text-sm">Cold PDF</td><td>{results.coldPdfMs.toFixed(0)} ms</td></tr>
              <tr><td className="pr-4 text-sm">Warm PNG</td><td>{results.warmPngMs.toFixed(0)} ms</td></tr>
              <tr><td className="pr-4 text-sm">Warm PDF</td><td>{results.warmPdfMs.toFixed(0)} ms</td></tr>
              <tr><td className="pr-4 text-sm">Glass diff %</td><td>{results.glassDiffPct.toFixed(2)}%</td></tr>
              <tr><td className="pr-4 text-sm">Non-glass diff %</td><td>{results.nonGlassDiffPct.toFixed(2)}%</td></tr>
            </tbody>
          </table>

          <h2 style={{ fontSize: 16, fontWeight: 'semibold', marginBottom: 8 }}>Criterion Verdicts</h2>
          <table style={{ borderCollapse: 'collapse', marginBottom: 16 }}>
            <tbody>
              {verdictRow('G8 cold PNG ≤ 10s', results.verdicts.G8_cold_png)}
              {verdictRow('G8 cold PDF ≤ 10s', results.verdicts.G8_cold_pdf)}
              {verdictRow('G8 warm PNG ≤ 3s', results.verdicts.G8_warm_png)}
              {verdictRow('G8 warm PDF ≤ 3s', results.verdicts.G8_warm_pdf)}
              {verdictRow('G7 glass ≤ 12%', results.verdicts.G7_glass)}
              {verdictRow('G7 non-glass ≤ 5%', results.verdicts.G7_nonGlass)}
            </tbody>
          </table>

          {results.pngBlob && (
            <a
              href={URL.createObjectURL(results.pngBlob)}
              download="spike-worker-1080.png"
              style={{ marginRight: 12, color: 'blue', textDecoration: 'underline' }}
            >
              Download PNG
            </a>
          )}
          {results.pdfBlob && (
            <a
              href={URL.createObjectURL(results.pdfBlob)}
              download="spike-worker.pdf"
              style={{ color: 'blue', textDecoration: 'underline' }}
            >
              Download PDF
            </a>
          )}
        </div>
      )}
    </div>
  );
}
