/**
 * Permanent offline e2e suite runner.
 *
 *   npm run e2e            — run every suite
 *   node scripts/e2e/run.mjs diary share   — run selected suites
 *
 * Prereq: `npm run build && npm run build:single` (checked below).
 * Promoted from the historical one-off scripts/archive/verify-batch*.mjs.
 */
import { existsSync } from 'fs';
import { join } from 'path';
import { ROOT, DIST } from './_helpers.mjs';

const SUITES = ['smoke', 'diary', 'goals', 'memo', 'export', 'settings', 'share', 'weather'];

const distSingle = join(ROOT, 'dist-single', 'index.html');
if (!existsSync(join(DIST, 'index.html')) || !existsSync(distSingle)) {
  console.error('Missing build output. Run: npm run build && npm run build:single');
  process.exit(2);
}

const picked = process.argv.slice(2).filter((s) => SUITES.includes(s));
const toRun = picked.length ? picked : SUITES;

const results = [];
for (const name of toRun) {
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 40 - name.length))}`);
  try {
    const { run } = await import(`./${name}.mjs`);
    results.push({ name, ok: await run() });
  } catch (err) {
    console.error(`ERROR [${name}]`, err instanceof Error ? err.message : err);
    results.push({ name, ok: false });
  }
}

console.log('\n══ Summary ═══════════════════════════════');
for (const r of results) console.log(`${r.ok ? '✓' : '✗'}  ${r.name}`);
const allOk = results.every((r) => r.ok);
console.log(allOk ? '\nALL SUITES PASS' : '\nSOME SUITES FAILED');
process.exit(allOk ? 0 : 1);
