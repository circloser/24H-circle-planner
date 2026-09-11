# Template content review — 2026-09-11

## Scope

Revised all 10 templates in Korean, English, German and Japanese (40 text variants), generated as 30 detail pages and three indexes. The sources remain `scripts/templates/build.mjs` and its two locale modules.

## Changes

- Replaced claims about concentration, sleep quality, sustainable study hours, decision fatigue and guaranteed routine success with concrete editing steps.
- Clearly identified schedules as hypothetical examples. Study blocks reserve time; they do not claim eight 50-minute lessons. The 5 AM example explicitly describes its seven-hour sleep interval without prescribing it. Toddler and shift examples do not prescribe health or sleep treatment.
- Added tailored checks for travel, care handovers, response obligations, breaks, assignments and rescheduling.
- Disclosed that chart/import labels remain Korean on English, German and Japanese pages.
- Corrected related-template links formerly pointing to nonexistent guide routes.
- Converted KO/EN controls to keyboard-accessible buttons with document language and pressed state updates.
- Added `--skip-screenshots` for text-only regeneration; it fails if an existing required image is absent. Normal generation still captures images.

## Verification

`node scripts/templates/build.mjs --skip-screenshots` generated 33 HTML pages. `.omc/verify-templates.mjs` compared every import and read-only preview URL against HEAD across all 33 files: no payload changes. It also parsed all JSON-LD and checked corrected related routes and review dates. Existing image assets were not modified.

Independent review and full-site publishing checks are handled in the parent task. This report does not claim AdSense approval.
