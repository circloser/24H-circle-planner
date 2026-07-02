/**
 * Visual regression gate (local-only; baselines are gitignored).
 *
 *   node scripts/e2e/visual.mjs --baseline   — capture baselines from the build
 *   node scripts/e2e/visual.mjs              — capture again and diff vs baseline
 *
 * Five deterministic states (seeded data, animations/now-line disabled):
 * main light/dark, export dialog, settings→background, table view.
 * Used as the safety gate for style-system refactors (Tailwind @theme etc.).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { launchPage, gotoApp, seedBasicData, wait } from './_helpers.mjs';

const VISUAL_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '__visual__');
const BASELINE = join(VISUAL_DIR, 'baseline');
const CURRENT = join(VISUAL_DIR, 'current');
const DIFF = join(VISUAL_DIR, 'diff');
const isBaseline = process.argv.includes('--baseline');
/** Diffs at or below this many pixels are noise (AA jitter), not regressions. */
const MAX_DIFF_PIXELS = 60;

/** Kill animations + hide the live now-line so captures are deterministic. */
async function stabilise(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after { animation: none !important; transition: none !important; }
      .now-indicator { visibility: hidden !important; }
      [data-clock-widget] { visibility: hidden !important; } /* ticking analog/digital clock */
      [data-save-indicator] { visibility: hidden !important; } /* transient saving/saved chip */
      .table-time-mark { visibility: hidden !important; } /* table view's per-minute time lines */
    `,
  });
  await page.evaluate(() => document.fonts.ready);
  await wait(250);
}

const STATES = [
  {
    name: 'main-light',
    async setup(page) {
      await gotoApp(page);
      await seedBasicData(page);
    },
  },
  {
    name: 'main-dark',
    async setup(page) {
      await gotoApp(page);
      await page.evaluate(() => localStorage.setItem('24h-circle-planner.theme', 'dark'));
      await seedBasicData(page);
    },
  },
  {
    name: 'export-dialog',
    async setup(page) {
      await gotoApp(page);
      await seedBasicData(page);
      await page.locator('button[aria-label="내보내기"]').first().click();
      await wait(500);
    },
  },
  {
    name: 'settings-bg',
    async setup(page) {
      await gotoApp(page);
      await seedBasicData(page);
      await page.locator('button[aria-label="디자인"]').first().click();
      await wait(200);
      await page.locator('[role="menuitem"]:has-text("배경")').first().click();
      await wait(500);
    },
  },
  {
    name: 'table',
    async setup(page) {
      await gotoApp(page);
      await seedBasicData(page);
      await page.evaluate(() => {
        const raw = JSON.parse(localStorage.getItem('24h-circle-planner.prefs'));
        raw.prefs.chartView = 'table';
        localStorage.setItem('24h-circle-planner.prefs', JSON.stringify(raw));
      });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.keyboard.press('Escape').catch(() => {});
      await wait(500);
    },
  },
  {
    name: 'settings-menu',
    async setup(page) {
      await gotoApp(page);
      await seedBasicData(page);
      await page.locator('button[aria-label="설정"]').first().click();
      await wait(400);
    },
  },
  {
    name: 'diary-dialog',
    async setup(page) {
      await gotoApp(page);
      await seedBasicData(page);
      await page.locator('button[aria-label="내 시간표"]').first().click();
      await wait(200);
      await page.locator('[role="menuitem"]:has-text("일기")').first().click();
      await wait(500);
    },
  },
  {
    name: 'preset-gallery',
    async setup(page) {
      await gotoApp(page);
      await seedBasicData(page);
      await page.locator('button[aria-label="디자인"]').first().click();
      await wait(200);
      await page.locator('[role="menuitem"]:has-text("프리셋")').first().click();
      await wait(500);
    },
  },
  {
    name: 'goals-card',
    async setup(page) {
      await gotoApp(page);
      await seedBasicData(page);
      await page.evaluate(() => {
        localStorage.setItem('24h-circle-planner.goals', JSON.stringify({ version: 1, goals: [{ id: 'g1', label: '수면', targetMinutes: 60, period: 'day' }] }));
      });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.keyboard.press('Escape').catch(() => {});
      await wait(400);
      await page.locator('button[aria-label="목표"]').first().click();
      await wait(400);
    },
  },
  {
    name: 'about-dialog',
    async setup(page) {
      await gotoApp(page);
      await seedBasicData(page);
      await page.locator('header h1 button').first().click();
      await wait(500);
    },
  },
  {
    name: 'analytics-dialog',
    async setup(page) {
      await gotoApp(page);
      await seedBasicData(page);
      await page.locator('button[aria-label="내 시간표"]').first().click();
      await wait(200);
      await page.locator('[role="menuitem"]:has-text("시간 분석")').first().click();
      await wait(500);
    },
  },
  {
    name: 'goals-dialog',
    async setup(page) {
      await gotoApp(page);
      await seedBasicData(page);
      await page.locator('button[aria-label="내 시간표"]').first().click();
      await wait(200);
      await page.locator('[role="menuitem"]:has-text("목표")').first().click();
      await wait(500);
    },
  },
  {
    name: 'timeblock-dialog',
    async setup(page) {
      await gotoApp(page);
      await seedBasicData(page);
      await page.evaluate(() => {
        const raw = JSON.parse(localStorage.getItem('24h-circle-planner.prefs'));
        raw.prefs.chartView = 'table';
        localStorage.setItem('24h-circle-planner.prefs', JSON.stringify(raw));
      });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.keyboard.press('Escape').catch(() => {});
      await wait(400);
      await page.locator('button:has-text("일정 추가")').first().click();
      await wait(500);
    },
  },
  {
    name: 'transfer-dialog',
    async setup(page) {
      await gotoApp(page);
      await seedBasicData(page);
      await page.locator('button[aria-label="설정"]').first().click();
      await wait(200);
      await page.locator('[role="menuitem"]:has-text("다른 기기로")').first().click();
      await wait(500);
    },
  },
  {
    name: 'welcome-overlay',
    async setup(page) {
      await gotoApp(page);
      // Seed data but REMOVE the onboarded flag so the first-visit welcome shows.
      await seedBasicData(page);
      await page.evaluate(() => localStorage.removeItem('24h-circle-planner.onboarded'));
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('svg[role="img"]', { timeout: 15000 });
      await wait(600); // welcome overlay entrance
    },
  },
  {
    name: 'memo-note',
    async setup(page) {
      await gotoApp(page);
      await seedBasicData(page);
      await page.evaluate(() => {
        const memo = { id: 'm1', text: '픽셀 테스트', x: 1000, y: 120, color: '#fef08a', fontFamily: 'Pretendard', align: 'center', createdAt: 1, onScreen: true };
        localStorage.setItem('24h-circle-planner.memos', JSON.stringify({ version: 1, memos: [memo], visible: true }));
      });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.keyboard.press('Escape').catch(() => {});
      await wait(400);
    },
  },
  {
    name: 'mobile-main',
    viewport: { width: 375, height: 812 },
    async setup(page) {
      await gotoApp(page);
      await seedBasicData(page);
    },
  },
];

mkdirSync(isBaseline ? BASELINE : CURRENT, { recursive: true });
if (!isBaseline) mkdirSync(DIFF, { recursive: true });

const results = [];
for (const state of STATES) {
  const { browser, page } = await launchPage(state.viewport ? { viewport: state.viewport } : {});
  try {
    await state.setup(page);
    await stabilise(page);
    const outDir = isBaseline ? BASELINE : CURRENT;
    const file = join(outDir, `${state.name}.png`);
    await page.screenshot({ path: file });

    if (isBaseline) {
      console.log(`BASELINE  ${state.name}`);
      results.push({ name: state.name, ok: true });
    } else {
      const basePath = join(BASELINE, `${state.name}.png`);
      if (!existsSync(basePath)) {
        console.log(`MISSING BASELINE  ${state.name} — run with --baseline first`);
        results.push({ name: state.name, ok: false });
        continue;
      }
      const a = PNG.sync.read(readFileSync(basePath));
      const b = PNG.sync.read(readFileSync(file));
      if (a.width !== b.width || a.height !== b.height) {
        console.log(`FAIL  ${state.name}  size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}`);
        results.push({ name: state.name, ok: false });
        continue;
      }
      const diff = new PNG({ width: a.width, height: a.height });
      const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
      const ok = n <= MAX_DIFF_PIXELS;
      if (!ok) writeFileSync(join(DIFF, `${state.name}.png`), PNG.sync.write(diff));
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${state.name}  diff=${n}px${ok ? '' : `  → __visual__/diff/${state.name}.png`}`);
      results.push({ name: state.name, ok });
    }
  } finally {
    await browser.close();
  }
}

const allOk = results.every((r) => r.ok);
console.log(allOk ? (isBaseline ? '\nBASELINES CAPTURED' : '\nVISUAL PARITY') : '\nVISUAL DIFFS FOUND');
process.exit(allOk ? 0 : 1);
