/**
 * Batch 51 (offline, dist-single): edit-mode date title, dark muted contrast,
 * logo "ring" red, and custom gradient background.
 */
import { chromium } from 'playwright';

const FILE = 'file:///C:/vibecoding/24h/dist-single/index.html';
const results = [];
const pass = (n, ok, extra = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1100, height: 1000 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(FILE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(300);

// Seed a default-named schedule + a custom gradient + Korean UI, then reload.
await page.evaluate(() => {
  const slices = [
    { id: 'a', label: '수면', startTime: '00:00', endTime: '08:00', color: '#a78bfa', icon: '', textPosition: 'inside' },
    { id: 'b', label: '일', startTime: '08:00', endTime: '24:00', color: '#f472b6', icon: '', textPosition: 'inside' },
  ];
  const day = { id: 'd1', schedule: { id: 's', version: 1, name: '내 시간표', presetSource: null, updatedAt: '2026-07-01T00:00:00.000Z', slices } };
  localStorage.setItem('24h-circle-planner.days', JSON.stringify({ version: 1, activeId: 'd1', days: [day] }));
  localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs: {
    language: 'ko', bgType: 'gradient', gradient: { from: '#ff0000', via: '#00ff00', to: '#0000ff', angle: 135 },
  } }));
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
await page.keyboard.press('Escape').catch(() => {});
await wait(400);

// ── Task 1: edit-mode hub title = today's date "M.D.(요일)" ──
const dateCheck = await page.evaluate(() => {
  const now = new Date();
  const dow = now.toLocaleDateString('ko', { weekday: 'short' });
  const expected = `${now.getMonth() + 1}.${now.getDate()}.(${dow})`;
  const texts = [...document.querySelectorAll('svg[role="img"] text')].map((t) => (t.textContent || '').replace(/\s+/g, ''));
  return { expected: expected.replace(/\s+/g, ''), found: texts.some((t) => t.includes(expected.replace(/\s+/g, ''))) };
});
pass('edit-mode hub title shows today\'s date', dateCheck.found, `expected=${dateCheck.expected}`);

// ── Task 3: header logo — only "ring" is red ──
const logo = await page.evaluate(() => {
  const btn = document.querySelector('h1 button');
  if (!btn) return null;
  const span = btn.querySelector('span');
  return {
    full: (btn.textContent || '').trim(),
    ring: span ? (span.textContent || '') : '',
    color: span ? getComputedStyle(span).color : '',
  };
});
pass('logo reads 24Houring with red "ring"', logo && logo.full === '24Houring' && logo.ring === 'ring' && logo.color === 'rgb(255, 77, 77)', JSON.stringify(logo));

// ── Task 4: custom gradient applied to the background ──
const grad = await page.evaluate(() => ({
  dataBg: document.documentElement.getAttribute('data-bg'),
  bgImage: getComputedStyle(document.body).backgroundImage,
}));
pass('gradient background applied (data-bg + linear-gradient)',
  grad.dataBg === 'gradient-fill' && /linear-gradient/.test(grad.bgImage) && grad.bgImage.includes('255, 0, 0'),
  `dataBg=${grad.dataBg} bg=${grad.bgImage.slice(0, 60)}`);

// ── Task 2: dark-mode muted text is brighter (contrast fix) ──
const mutedDark = await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark');
  return getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();
});
pass('dark --text-muted brightened to ~70% lightness', mutedDark === '220 14% 70%', `--text-muted=${mutedDark}`);

pass('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allOk ? 0 : 1);
