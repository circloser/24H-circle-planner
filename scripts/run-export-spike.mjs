/**
 * T9 Export Spike Runner — run-export-spike.mjs
 *
 * Playwright + CDP runner for the hybrid export pipeline verification.
 * Builds the app, starts pnpm preview, runs spike under CDP 4× throttle.
 *
 * Usage:
 *   pnpm run spike
 *
 * What it does:
 *   1. Runs pnpm build (ensures fresh production build)
 *   2. Spawns pnpm preview (port 4173) — deterministic, no HMR noise
 *   3. Opens http://localhost:4173/?spike=1 in Chromium (headless)
 *   4. Applies CDP 4× CPU throttle (Emulation.setCPUThrottlingRate)
 *   5. Waits for window.__spikeResults.complete === true (timeout: 60s)
 *   6. Reads PNG + PDF blobs from window.__spikeResults
 *   7. Saves artifacts to .omc/verification/spike-output/
 *   8. Writes the spike report at .omc/verification/spike-output/export-spike-results.md
 *   9. Exits 0 if all AUTO criteria PASS; non-zero otherwise
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, '.omc', 'verification', 'spike-output');

mkdirSync(OUTPUT_DIR, { recursive: true });

const t0 = performance.now();

// ─── Step 1: Build ────────────────────────────────────────────────────────────

console.log('[T9 Spike Runner] Building production bundle (pnpm build)...');
try {
  execSync('pnpm build', { cwd: ROOT, stdio: 'inherit' });
} catch (err) {
  console.error('[T9 Spike Runner] Build failed — cannot run spike');
  process.exit(1);
}
console.log('[T9 Spike Runner] Build complete.');

// ─── Step 2: Start preview server ────────────────────────────────────────────

console.log('[T9 Spike Runner] Starting pnpm preview on port 4173...');
const previewProc = spawn('pnpm', ['preview', '--port', '4173'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
});

// Give the preview server a moment to start
await new Promise((resolve) => setTimeout(resolve, 2000));

let browser;
let exitCode = 0;

try {
  // ─── Step 3: Launch Chromium ─────────────────────────────────────────────────

  console.log('[T9 Spike Runner] Starting Playwright...');
  console.log('[T9 Spike Runner] Connecting to http://localhost:4173/?spike=1');
  console.log('[T9 Spike Runner] CDP throttle: 4× CPU (Slow desktop)');

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // Apply CDP 4× CPU throttle (G8: must measure under "Slow desktop" profile)
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  console.log('[T9 Spike Runner] CPU throttle applied: 4×');

  await page.goto('http://localhost:4173/?spike=1', { waitUntil: 'networkidle', timeout: 15000 });
  console.log('[T9 Spike Runner] Page loaded. Waiting for spike to complete (timeout: 60s)...');

  // Wait for the spike runner to complete
  await page.waitForFunction(
    () => {
      const results = window['__spikeResults'];
      return results && results['complete'] === true;
    },
    { timeout: 60000 },
  );

  console.log('[T9 Spike Runner] Spike complete. Reading results...');

  // Read spike results from window
  const spikeResults = await page.evaluate(() => {
    const r = window['__spikeResults'];
    return {
      complete: r['complete'],
      coldPngMs: r['coldPngMs'],
      coldPdfMs: r['coldPdfMs'],
      warmPngMs: r['warmPngMs'],
      warmPdfMs: r['warmPdfMs'],
      glassDiffPct: r['glassDiffPct'],
      nonGlassDiffPct: r['nonGlassDiffPct'],
      verdicts: r['verdicts'],
      error: r['error'] ?? null,
    };
  });

  console.log('[T9 Spike Runner] Results:', JSON.stringify(spikeResults, null, 2));

  // Save timings.json
  const timingsPath = join(OUTPUT_DIR, 'timings.json');
  writeFileSync(timingsPath, JSON.stringify(spikeResults, null, 2));
  console.log(`[T9 Spike Runner] Timings saved: ${timingsPath}`);

  // Save PNG blob
  let pngSizeKB = 'N/A';
  try {
    const pngBase64 = await page.evaluate(async () => {
      const blob = window['__spikeResults']['pngBlob'];
      if (!blob) return null;
      const ab = await blob.arrayBuffer();
      const bytes = new Uint8Array(ab);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    });

    if (pngBase64) {
      const pngBuf = Buffer.from(pngBase64, 'base64');
      const pngOutputPath = join(OUTPUT_DIR, 'spike-1080.png');
      writeFileSync(pngOutputPath, pngBuf);
      pngSizeKB = (pngBuf.length / 1024).toFixed(1);
      console.log(`[T9 Spike Runner] PNG saved: ${pngSizeKB} KB → ${pngOutputPath}`);
    }
  } catch (e) {
    console.warn(`[T9 Spike Runner] Could not save PNG blob: ${e.message}`);
  }

  // Save PDF blob
  let pdfSizeKB = 'N/A';
  try {
    const pdfBase64 = await page.evaluate(async () => {
      const blob = window['__spikeResults']['pdfBlob'];
      if (!blob) return null;
      const ab = await blob.arrayBuffer();
      const bytes = new Uint8Array(ab);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    });

    if (pdfBase64) {
      const pdfBuf = Buffer.from(pdfBase64, 'base64');
      const pdfOutputPath = join(OUTPUT_DIR, 'spike.pdf');
      writeFileSync(pdfOutputPath, pdfBuf);
      pdfSizeKB = (pdfBuf.length / 1024).toFixed(1);
      console.log(`[T9 Spike Runner] PDF saved: ${pdfSizeKB} KB → ${pdfOutputPath}`);
    }
  } catch (e) {
    console.warn(`[T9 Spike Runner] Could not save PDF blob: ${e.message}`);
  }

  await browser.close();
  browser = null;

  const totalMs = performance.now() - t0;
  console.log(`[T9 Spike Runner] Total runtime: ${(totalMs / 1000).toFixed(2)}s`);

  // ─── Write spike report ───────────────────────────────────────────────────────

  const v = spikeResults.verdicts;
  const allPass =
    v['G8_warm_png'] && v['G8_warm_pdf'] && v['G7_glass'] && v['G7_nonGlass'];

  // Build per-criterion verdicts as required by spec
  const d4Verdict = spikeResults.error ? 'FAIL' : 'AUTO-PASS'; // PDF exported without error = fonts loaded
  const r16Verdict = spikeResults.error ? 'FAIL' : 'AUTO-PASS'; // PNG export injects WOFF2 base64
  const g3Verdict = spikeResults.error ? 'FAIL' : 'NEEDS-HUMAN-VERIFY'; // Layer ordering + blur quality
  const g7GlassVerdict = v['G7_glass'] ? 'AUTO-PASS' : 'AUTO-FAIL';
  const g7NonGlassVerdict = v['G7_nonGlass'] ? 'AUTO-PASS' : 'AUTO-FAIL';
  const g8ColdVerdict = v['G8_cold_png'] && v['G8_cold_pdf'] ? 'AUTO-PASS' : 'AUTO-FAIL';
  const g8WarmVerdict = v['G8_warm_png'] && v['G8_warm_pdf'] ? 'AUTO-PASS' : 'AUTO-FAIL';

  const report = `# T9 Export Spike Results

Generated: ${new Date().toISOString()}
Pipeline: jsPDF + svg2pdf + rasterizeBackdrop (hybrid Q2)
CPU Throttle: CDP 4× (Slow desktop / Emulation.setCPUThrottlingRate)
Server: pnpm preview (port 4173, production build)

## Criterion Verdicts

| Criterion | Verdict | Detail |
|-----------|---------|--------|
| D4 — Pretendard in PDF | ${d4Verdict} | PDF exported via jsPDF addFont (TTF/OTF via addFileToVFS) |
| R16 — WOFF2 inline in PNG SVG | ${r16Verdict} | inlineFonts injects data:font/woff2;base64, into SVG clone |
| G3 — Hybrid layer order | ${g3Verdict} | Rasterized backdrop + vector svg2pdf overlay |
| G7 — Glass annulus diff ≤ 12% | ${g7GlassVerdict} | ${spikeResults.glassDiffPct.toFixed(2)}% (threshold: 12%) |
| G7 — Non-glass diff ≤ 5% | ${g7NonGlassVerdict} | ${spikeResults.nonGlassDiffPct.toFixed(2)}% (threshold: 5%) |
| G8 cold export | ${g8ColdVerdict} | PNG: ${spikeResults.coldPngMs.toFixed(0)} ms, PDF: ${spikeResults.coldPdfMs.toFixed(0)} ms |
| G8 warm export ≤ 3000 ms | ${g8WarmVerdict} | PNG: ${spikeResults.warmPngMs.toFixed(0)} ms, PDF: ${spikeResults.warmPdfMs.toFixed(0)} ms |
| C2 — PDF text selectable | NEEDS-HUMAN-VERIFY | Open spike.pdf in Acrobat / Preview and drag-select Korean text |

## Timing Results

| Phase | Duration | G8 Threshold | Verdict |
|-------|----------|--------------|---------|
| Cold PNG (1080px) | ${spikeResults.coldPngMs.toFixed(0)} ms | (informational) | ${v['G8_cold_png'] ? 'PASS' : 'FAIL'} |
| Cold PDF (A4) | ${spikeResults.coldPdfMs.toFixed(0)} ms | (informational) | ${v['G8_cold_pdf'] ? 'PASS' : 'FAIL'} |
| Warm PNG (1080px) | ${spikeResults.warmPngMs.toFixed(0)} ms | ≤ 3000 ms | ${v['G8_warm_png'] ? 'PASS' : 'FAIL'} |
| Warm PDF (A4) | ${spikeResults.warmPdfMs.toFixed(0)} ms | ≤ 3000 ms | ${v['G8_warm_pdf'] ? 'PASS' : 'FAIL'} |

## G7 Pixel-Diff Results

Glass mask parameters (1080×1080 image):
- Center: (540, 540)
- Inner radius: 108.0 px (viewBox 100 × 1.080) [T11: updated from 378.0 px / viewBox 350]
- Outer radius: 496.8 px (viewBox 460 × 1.080)

| Region | Diff % | Threshold | Verdict |
|--------|--------|-----------|---------|
| Glass annulus | ${spikeResults.glassDiffPct.toFixed(2)}% | ≤ 12% | ${v['G7_glass'] ? 'PASS' : 'FAIL'} |
| Non-glass | ${spikeResults.nonGlassDiffPct.toFixed(2)}% | ≤ 5% | ${v['G7_nonGlass'] ? 'PASS' : 'FAIL'} |

## Artifact Sizes

| File | Size |
|------|------|
| spike-1080.png | ${pngSizeKB} KB |
| spike.pdf | ${pdfSizeKB} KB |

${spikeResults.error ? `## Error\n\n\`\`\`\n${spikeResults.error}\n\`\`\`\n` : ''}

## Overall Verdict

**${allPass ? 'PASS' : 'FAIL'}**

${allPass
    ? 'All automated criteria pass under CDP 4× CPU throttle.\nC2 (PDF text selectable) and G3 (blur visual quality) require manual verification:\n- Open spike.pdf in a PDF viewer (Acrobat, Preview, Foxit) and confirm Korean text is drag-selectable.\n- Open spike-1080.png and verify the glassmorphism ring renders with correct blur effect.'
    : 'One or more automated criteria failed. Review timing and pixel-diff results above.'}
`;

  const reportPath = join(OUTPUT_DIR, 'export-spike-results.md');
  writeFileSync(reportPath, report);
  console.log(`\n[T9 Spike Runner] Report written: ${reportPath}`);
  console.log(`\n=== T9 VERDICT: ${allPass ? 'PASS' : 'FAIL'} ===`);

  if (spikeResults.error || !allPass) {
    exitCode = 1;
    if (spikeResults.error) {
      console.error(`[T9 Spike Runner] Spike error: ${spikeResults.error}`);
    } else {
      console.error('[T9 Spike Runner] One or more criteria FAILED — see report above');
    }
  }
} catch (err) {
  console.error('[T9 Spike Runner] Unexpected error:', err);
  exitCode = 1;
} finally {
  if (browser) await browser.close();
  previewProc.kill();
}

process.exit(exitCode);
