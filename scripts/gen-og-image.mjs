/**
 * One-off: render the social share / Open Graph card (1200x630) to
 * public/og-image.png. Re-run if the branding or favicon changes.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const clock = fs.readFileSync('public/favicon.svg', 'utf8');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0}
  .card{
    width:1200px;height:630px;box-sizing:border-box;
    display:flex;align-items:center;gap:64px;padding:0 96px;
    background:
      radial-gradient(1200px 600px at 80% -10%, #eef1ff 0%, rgba(238,241,255,0) 55%),
      radial-gradient(1000px 600px at -10% 110%, #ffeef0 0%, rgba(255,238,240,0) 55%),
      #f4f5f7;
    font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#1f2430;
  }
  .clock{width:300px;height:300px;flex:0 0 auto;filter:drop-shadow(0 12px 30px rgba(31,36,48,.16))}
  .clock svg{width:300px;height:300px}
  .copy{display:flex;flex-direction:column;gap:14px}
  .brand{font-size:84px;font-weight:800;letter-spacing:-2px;line-height:1}
  .brand .ing{color:#FF4D4D}
  .ko{font-size:38px;font-weight:700;color:#2b3140}
  .en{font-size:26px;font-weight:500;color:#5b6475}
  .url{margin-top:10px;font-size:24px;font-weight:600;color:#7e8aa0;letter-spacing:.5px}
</style></head><body>
  <div class="card">
    <div class="clock">${clock}</div>
    <div class="copy">
      <div class="brand">24Hour<span class="ing">ing</span></div>
      <div class="ko">하루를 한눈에, 24시간 원형 시간표</div>
      <div class="en">Plan, edit &amp; share your day on a 24-hour clock</div>
      <div class="url">24houring.com</div>
    </div>
  </div>
</body></html>`;

await page.setContent(html, { waitUntil: 'networkidle' });
await page.locator('.card').screenshot({ path: 'public/og-image.png' });
await browser.close();
console.log('wrote public/og-image.png 1200x630');
