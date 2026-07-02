/**
 * Verifies, on the offline single-file build:
 *  #1 Inside slice labels auto-pick black/white text from the slice luminance.
 *  #2 The now-line angle matches the browser's LOCAL time.
 *  #5 The export dialog shows a preview (with NO now-line) plus a reserved ad slot.
 *  #6 New post-it quotes render in the selected language (ja / zh / fr / ru).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const DIR = path.resolve('.omc/verification');
const errors = [];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', (e) => { if (!e.message.includes('favicon')) errors.push('PAGE ERROR: ' + e.message); });

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
fs.mkdirSync(DIR, { recursive: true });

// Load a preset from the first-launch gallery. Preset names are translated, so
// match a card by structure (it carries an <h3> title) rather than by name.
const card = page.locator('button:has(h3)').first();
if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
  await card.click();
  await page.getByRole('button', { name: 'Apply to current' }).first().click().catch(() => {});
}
await page.waitForTimeout(600);

// ── #1 Auto-contrast: every inside label's fill must match idealTextColor ──────
const contrast = await page.evaluate(() => {
  function lum(hex) {
    const h = hex.replace('#', '');
    const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const ch = [0, 2, 4].map((i) => {
      const v = parseInt(n.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }
  const ideal = (hex) => (lum(hex) > 0.45 ? '#1f2937' : '#ffffff');
  const slices = [...document.querySelectorAll('path[data-slice-id]')];
  const colorById = new Map(slices.map((p) => [p.getAttribute('data-slice-id'), p.getAttribute('fill')]));
  const labels = [...document.querySelectorAll('g[data-label-kind="inside"][data-label-id]')];
  let checked = 0;
  let mismatches = 0;
  for (const g of labels) {
    const txt = g.querySelector('text[fill]');
    if (!txt) continue;
    const bg = colorById.get(g.getAttribute('data-label-id'));
    if (!bg || !bg.startsWith('#')) continue;
    checked++;
    if (txt.getAttribute('fill') !== ideal(bg)) mismatches++;
  }
  return { checked, mismatches };
});

// ── #2 now-line angle matches local time ──────────────────────────────────────
const tz = await page.evaluate(() => {
  const line = document.querySelector('.now-indicator line, line.now-indicator, [class*="now-indicator"] line');
  // Fall back: any element under .now-indicator with x2/y2
  const ni = document.querySelector('.now-indicator');
  const el = line || (ni && ni.querySelector('line'));
  if (!el) return { found: false };
  const x2 = parseFloat(el.getAttribute('x2'));
  const y2 = parseFloat(el.getAttribute('y2'));
  // Angle from centre (500,500); chart 0:00 at top (-90°).
  const ang = (Math.atan2(y2 - 500, x2 - 500) * 180) / Math.PI; // -180..180, 0=east
  let deg = (ang + 90 + 360) % 360; // 0 at top, clockwise
  const now = new Date();
  const expected = ((now.getHours() * 60 + now.getMinutes()) / 1440) * 360;
  let diff = Math.abs(deg - expected);
  if (diff > 180) diff = 360 - diff;
  return { found: true, deg: Math.round(deg), expected: Math.round(expected), diff: Math.round(diff) };
});

// ── #5 Export dialog: preview present (no now-line) + ad slot ──────────────────
await page.getByRole('button', { name: 'Export' }).first().click();
await page.waitForTimeout(700);
const previewImg = page.locator('img[alt="Preview"]').first();
await previewImg.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
const exportChecks = await page.evaluate(() => {
  const img = document.querySelector('img[alt="Preview"]');
  const ad = document.querySelector('[data-ad-slot="export"]');
  let previewHasNowLine = null;
  let previewHasSlices = null;
  if (img && img.src.startsWith('data:image/svg+xml')) {
    const svg = decodeURIComponent(img.src.split(',').slice(1).join(','));
    previewHasNowLine = /now-indicator/.test(svg);
    previewHasSlices = /data-slice-id/.test(svg);
  }
  return {
    hasImg: !!img,
    imgIsData: !!img && img.src.startsWith('data:image/svg+xml'),
    hasAd: !!ad,
    previewHasNowLine,
    previewHasSlices,
  };
});
await page.screenshot({ path: path.join(DIR, 'export-preview-ad.png') });
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(200);

// ── #6 Quotes per language ────────────────────────────────────────────────────
const SCRIPTS = {
  ja: /[ぁ-んァ-ン一-龯]/,
  zh: /[一-龥]/,
  fr: /[A-Za-zÀ-ÿ]/,
  ru: /[А-Яа-яЁё]/,
};
const HANGUL = /[가-힣]/;
const addBtn = page.locator('button:has(svg.lucide-sticky-note)').first();
const quoteResults = {};
for (const lang of Object.keys(SCRIPTS)) {
  // Seed the language preference and reload (merges over defaults).
  await page.evaluate((l) => {
    localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs: { language: l } }));
  }, lang);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
  await page.keyboard.press('Escape').catch(() => {});
  await addBtn.click();
  await page.waitForTimeout(250);
  const txt = await page.locator('.memo-note').last().locator('.memo-text').innerText();
  quoteResults[lang] = {
    ok: SCRIPTS[lang].test(txt) && !HANGUL.test(txt),
    sample: txt.replace(/\n+/g, ' ').slice(0, 60),
  };
}

await browser.close();

// ── Report ────────────────────────────────────────────────────────────────────
console.log('#1 contrast:', JSON.stringify(contrast));
console.log('#2 now-line:', JSON.stringify(tz));
console.log('#5 export:', JSON.stringify(exportChecks));
console.log('#6 quotes:');
for (const [l, r] of Object.entries(quoteResults)) console.log(`   ${l}: ${r.ok}  «${r.sample}»`);
console.log('console errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

const c1 = contrast.checked > 0 && contrast.mismatches === 0;
const c2 = tz.found && tz.diff <= 2;
const c5 = exportChecks.hasImg && exportChecks.imgIsData && exportChecks.hasAd &&
  exportChecks.previewHasNowLine === false && exportChecks.previewHasSlices === true;
const c6 = Object.values(quoteResults).every((r) => r.ok);
console.log(`c1:${c1} c2:${c2} c5:${c5} c6:${c6}`);
const ok = c1 && c2 && c5 && c6 && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
