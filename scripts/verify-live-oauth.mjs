/**
 * LIVE A/B: navigate to /api/auth/google/start (what the login button does)
 *  (A) with NO service worker, (B) with the SW active+controlling.
 * If A→Google but B→stays-on-app, the SW is intercepting navigations.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const goog = (u) => /accounts\.google\.com|\/o\/oauth2/.test(u);

async function trial(label, swMode) {
  const ctx = await browser.newContext({ serviceWorkers: swMode });
  const page = await ctx.newPage();
  if (swMode === 'allow') {
    await page.goto('https://24houring.com/', { waitUntil: 'load', timeout: 40000 });
    await page.waitForTimeout(3500);
    await page.reload({ waitUntil: 'load', timeout: 40000 });
    await page.waitForTimeout(1200);
    const ctrl = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || 'none');
    console.log(`[${label}] controller=${ctrl}`);
  }
  let note = '';
  try {
    await page.goto('https://24houring.com/api/auth/google/start', { waitUntil: 'commit', timeout: 40000 });
  } catch (e) { note = e.message.split('\n')[0]; }
  await page.waitForTimeout(800);
  const url = page.url();
  console.log(`[${label}] final=${url} ${note ? '(' + note + ')' : ''}`);
  await ctx.close();
  return url;
}

const noSw = await trial('NO-SW', 'block');
const withSw = await trial('WITH-SW', 'allow');
await browser.close();
console.log('\nNO-SW   →', goog(noSw) ? 'Google ✓' : 'stayed on app ✗');
console.log('WITH-SW →', goog(withSw) ? 'Google ✓' : 'stayed on app ✗');
