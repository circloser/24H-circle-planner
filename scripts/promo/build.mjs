/**
 * 24Houring marketing assets — Play Store screenshots, feature graphic, tablet
 * shots, Instagram feed/story images and short screen recordings, for every
 * tab, in Korean and English, from the REAL app filled with sample data
 * (scripts/promo/data.mjs). Fully offline: see lib.mjs.
 *
 *   npm run build                       # once (or PROMO_DIST=<a built dist>)
 *   node scripts/promo/build.mjs        # everything
 *   node scripts/promo/build.mjs --phase=shots,compose --lang=en
 *
 * Phases: shots (raw app captures) · compose (play/sns/feature composites)
 *         tablet · video (screen recordings → webm + mp4 + reel).
 * Output: PROMO_OUT or ~/Desktop/24houring_playstore/promo-2026-09
 */
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { serve, launch, openApp, gotoApp, tidy, wait } from './lib.mjs';
import { seedFor } from './data.mjs';
import { COPY } from './copy.mjs';
import { composeAll } from './compose.mjs';
import { recordAll, findFfmpeg } from './video.mjs';
import { writeReadme } from './readme.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const DIST = process.env.PROMO_DIST || join(ROOT, 'dist');
const OUT = process.env.PROMO_OUT || join(homedir(), 'Desktop', '24houring_playstore', 'promo-2026-09');
const RAW = join(OUT, 'raw');

const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1].split(',') : dflt;
};
const PHASES = arg('phase', ['shots', 'tablet', 'compose', 'video']);
const LANGS = arg('lang', ['ko', 'en']);
const ONLY = arg('only', null);

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`No build at ${DIST}. Run \`npm run build\` first (or set PROMO_DIST).`);
  process.exit(1);
}
for (const d of ['raw', 'play', 'sns/feed', 'sns/story', 'video']) mkdirSync(join(OUT, d), { recursive: true });

// ── What each capture does before the shutter ────────────────────────────────
const settleRelation = async (page) => {
  for (let i = 0; i < 50; i++) {
    const heat = Number(await page.locator('[data-relation-surface]').getAttribute('data-relation-alpha').catch(() => '1'));
    if (heat <= 0.021) break;
    await wait(200);
  }
};

/** Scroll the life line so the decade `year` sits `top` px below the page top
 *  — under the sticky name tags, so they never cover a moment's title. */
export async function lifeTo(page, year, top) {
  for (let i = 0; i < 6; i++) {
    const box = await page.locator(`[data-life-column="me"] li[data-life-decade][data-year="${year}"]`).first().boundingBox()
      .catch(() => null);
    if (!box) break;
    const dy = box.y - top;
    if (Math.abs(dy) < 4) break;
    await page.mouse.move(page.viewportSize().width / 2, page.viewportSize().height / 2);
    await page.mouse.wheel(0, dy);
    await wait(500);
  }
  await wait(500);
}

// The globe rests on home (Korea) instead of turning.
const SPIN_OFF = { '24h-place-spin': 'off' };

export const PHONE_SHOTS = {
  timetable: { view: 'full' },
  editor: {
    view: 'full',
    prep: async (page) => {
      const box = await page.locator('[data-label-id="gym"]').first().boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await wait(700);
    },
    keepDialogs: true,
  },
  table: { view: 'table' },
  calendar: { view: 'calendar' },
  life: { view: 'life', prep: (page) => lifeTo(page, 2010, 98) },
  relation: {
    view: 'relation',
    prep: async (page) => {
      await settleRelation(page);
      await page.locator('[data-relation-zoom-in]').click();
      await wait(800);
      await settleRelation(page);
    },
  },
  place: { view: 'place', seed: SPIN_OFF },
  pins: {
    view: 'place',
    seed: SPIN_OFF,
    prep: async (page) => {
      for (let i = 0; i < 16 && (await page.locator('[data-place-pins]').count()) === 0; i++) {
        await page.locator('[data-place-zoom-in]').click();
        await wait(350);
      }
      await wait(1200);
      // The tiles here are a locally drawn stand-in, not OpenStreetMap's, so
      // their credit line would be untrue in the picture.
      if (process.env.PROMO_REAL_TILES !== '1') await page.addStyleTag({ content: '[data-place-attribution]{visibility:hidden!important}' });
      await wait(2500);
    },
  },
};

/** One capture, tried twice: a busy machine can miss the first page load. */
async function capture(...args) {
  try {
    await captureOnce(...args);
  } catch (e) {
    console.warn(`  ! retrying ${args[2]}/${args[3]}: ${String(e.message).split('\n')[0]}`);
    await captureOnce(...args);
  }
}

async function captureOnce(browser, base, lang, id, spec, { viewport, dsf, mobile, file }) {
  const { ctx, page, errors } = await openApp(browser, base, {
    lang, seed: { ...seedFor(lang, { chartView: spec.view, chartLayout: spec.layout ?? 'center' }), ...(spec.seed ?? {}) }, viewport, dsf, mobile,
  });
  try {
    await gotoApp(page, base);
    await wait(1800);
    if (!spec.keepDialogs) await tidy(page);
    else await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' });
    if (spec.prep) await spec.prep(page, lang);
    await page.mouse.move(-10, -10).catch(() => {});
    await wait(400);
    await page.screenshot({ path: file });
    if (errors.length) console.warn(`  ! ${lang}/${id} page errors:`, errors.slice(0, 2));
    console.log(`  shot ${file.slice(OUT.length + 1)}`);
  } finally {
    await ctx.close();
  }
}

// Desktop layout for the tablet slots.
export const DESK_SHOTS = {
  timetable: { view: 'full' },
  life: {
    view: 'life',
    prep: async (page) => {
      await page.locator('[data-life-board-out]').click().catch(() => {});
      await wait(500);
      await lifeTo(page, 2010, 70);
    },
  },
  place: { view: 'place', seed: SPIN_OFF },
};

const { base, close } = await serve(DIST);
const browser = await launch();
try {
  if (PHASES.includes('shots')) {
    console.log('phase: shots');
    for (const lang of LANGS) {
      for (const [id, spec] of Object.entries(PHONE_SHOTS)) {
        if (ONLY && !ONLY.includes(id)) continue;
        await capture(browser, base, lang, id, spec, {
          viewport: { width: 390, height: 844 }, dsf: 3, mobile: true, file: join(RAW, `phone-${lang}-${id}.png`),
        });
      }
    }
  }
  if (PHASES.includes('tablet')) {
    console.log('phase: tablet (desktop layout)');
    for (const lang of LANGS) {
      for (const [id, spec] of Object.entries(DESK_SHOTS)) {
        if (ONLY && !ONLY.includes(id)) continue;
        await capture(browser, base, lang, id, spec, {
          viewport: { width: 1600, height: 1000 }, dsf: 1.5, mobile: false, file: join(RAW, `desk-${lang}-${id}.png`),
        });
      }
    }
  }
  if (PHASES.includes('compose')) {
    console.log('phase: compose');
    await composeAll(browser, base, { OUT, RAW, LANGS, COPY });
  }
  if (PHASES.includes('video')) {
    console.log('phase: video');
    await recordAll(browser, base, { OUT, LANGS, ONLY });
  }
} finally {
  await browser.close();
  close();
}
const ff = findFfmpeg();
console.log(`README.md: ${writeReadme(OUT, ff.h264 ?? ff.vp8)} files listed`);
console.log('DONE →', OUT);
