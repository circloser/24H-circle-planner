/**
 * R7 Property test: schedule reducer preserves isContiguous24h across any action sequence.
 *
 * Reproduction recipe:
 *   pnpm test --run src/lib/__tests__/schedule.property.test.ts
 * To reproduce a specific shrunk counterexample from fast-check output:
 *   fc.assert(..., { seed: 0xC1RC1E24, path: '<path from failure output>' })
 *
 * Seed: 203169316 (mnemonic: 0xC1C1E24, "CIRCLE24" with R omitted for valid hex)
 * Runs: 200
 * Actions: SPLIT | MERGE | RESIZE_BOUNDARY | RESIZE_BOUNDARY_FAR (seq len 1–50)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { splitSliceAt, mergeSlices, resizeBoundary, ContiguityError } from '../schedule';
import { createInitialSchedule } from '../initial-schedule';
import { isContiguous24h } from '../time-utils';

// ─── Action arbitraries ───────────────────────────────────────────────────────

const splitAction = fc.record({
  type: fc.constant('SPLIT' as const),
  hhmm: fc.constantFrom('06:00', '12:00', '18:00', '03:30', '21:50'),
});

const mergeAction = fc.record({
  type: fc.constant('MERGE' as const),
});

const resizeAction = fc.record({
  type: fc.constant('RESIZE_BOUNDARY' as const),
  boundaryIndex: fc.nat(20),
  newHHmm: fc.constantFrom('06:10', '12:30', '18:50', '00:30'),
});

const resizeFarAction = fc.record({
  type: fc.constant('RESIZE_BOUNDARY_FAR' as const),
  boundaryIndex: fc.nat(20),
  newHHmm: fc.constantFrom('20:00', '02:00'), // intentional past-multiple-boundaries
});

const actionArb = fc.oneof(splitAction, mergeAction, resizeAction, resizeFarAction);

// ─── Test ─────────────────────────────────────────────────────────────────────

describe('R7 schedule property tests', () => {
  it('reducer preserves isContiguous24h across any action sequence (seed 0xC1RC1E24)', () => {
    fc.assert(
      fc.property(fc.array(actionArb, { minLength: 1, maxLength: 50 }), (actions) => {
        let schedule = createInitialSchedule();
        // Bootstrap with a split so MERGE and RESIZE have at least 2 slices to target
        try {
          schedule = splitSliceAt(schedule, '12:00');
        } catch {
          // If initial split fails for any reason, start from the single-slice state
        }

        for (const action of actions) {
          try {
            switch (action.type) {
              case 'SPLIT':
                schedule = splitSliceAt(schedule, action.hhmm);
                break;

              case 'MERGE': {
                // Always merge slice[0] into slice[1] if we have ≥2 slices
                if (schedule.slices.length >= 2) {
                  schedule = mergeSlices(
                    schedule,
                    schedule.slices[1].id, // idCw
                    schedule.slices[0].id, // idCcw
                  );
                }
                break;
              }

              case 'RESIZE_BOUNDARY':
              case 'RESIZE_BOUNDARY_FAR': {
                const idx = action.boundaryIndex % schedule.slices.length;
                schedule = resizeBoundary(schedule, idx, action.newHHmm);
                break;
              }
            }
          } catch (e) {
            // ContiguityError is expected for survivor-collapse and impossible moves; treat as no-op
            if (!(e instanceof ContiguityError)) throw e;
            // Continue with unchanged schedule
          }

          // Assert after every step — fast-check will shrink to minimal failing sequence
          expect(isContiguous24h(schedule.slices)).toBe(true);
        }
      }),
      { numRuns: 200, seed: 0xc1c1e24 }, // 203169316 — mnemonic "CIRCLE24"
    );
  });
});
