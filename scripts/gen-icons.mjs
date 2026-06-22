/**
 * One-off: rasterize public/favicon.svg into PWA PNG icons (solid app-bg) so the
 * "add to home screen" / install icon looks right. Re-run if the favicon changes.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const svg = fs.readFileSync('public/favicon.svg', 'utf8');
const browser = await chromium.launch({ headless: true });

async function gen(size, out) {
  const pad = Math.round(size * 0.12);
  const inner = size - pad * 2;
  const html =
    '<!doctype html><html><head><style>' +
    'html,body{margin:0;padding:0}' +
    `.wrap{width:${size}px;height:${size}px;background:#f4f5f7;display:flex;align-items:center;justify-content:center}` +
    `.wrap svg{width:${inner}px;height:${inner}px}` +
    '</style></head><body><div class="wrap">' +
    svg +
    '</div></body></html>';
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.locator('.wrap').screenshot({ path: out });
  await page.close();
  console.log('wrote', out, size);
}

await gen(192, 'public/icon-192.png');
await gen(512, 'public/icon-512.png');
await browser.close();
