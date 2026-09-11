# Blog content revision — 2026-09-11

## Scope and source of truth

All 20 posts in `scripts/blog/posts/` were rewritten in Korean and English. Existing slugs and original July publication dates remain; `updated: 2026-09-11` records this substantive revision. `node scripts/blog/build.mjs` generated 20 articles, the blog index, and RSS.

## Editorial changes

- Replaced invented personal experience, universal behaviour claims, unsupported productivity ratios, guaranteed recovery timelines, and rigid daily routines with bounded exercises.
- Every numerical schedule is explicitly an illustrative calculation, not a survey finding or prescribed duration. Examples account for travel, preparation, concurrent activity, care, and missing observations.
- The Kant article explicitly corrects its earlier unsupported reconstruction. It now explains how to assess celebrity routine claims without repeating an unverified biography. Misleading card/hero images are no longer referenced by these articles.
- Circadian content is a comparison of recorded task conditions, not a chronotype diagnosis. Sleep and shift articles explain scheduling boundaries and avoid treatment protocols or universal sleep durations.
- Clarified product limitations where relevant: entries are manual; the planner does not observe behaviour, import phone use, block applications, notify clients, or receive roster changes automatically.
- Child planning gives a hypothetical conversation and care/privacy constraints, replacing unsupported choice percentages and compliance statistics.

## Distinct reader tasks

| Posts | Practical task |
|---|---|
| chronotype-day-design | Compare similar tasks while marking confounding conditions |
| circle-3things-cards, circle-vs-square-planner | Check omissions and select a suitable view/tool |
| college-gap-time | Subtract movement and setup from a class gap |
| exam-d30-three-periods, summer-break-reset | Match remaining scope to actual available days |
| freelancer-boundaries | Agree on response windows, handoffs, and exceptions |
| goals-vs-systems, habit-stacking-circle | Separate outcomes from execution and budget setup |
| hidden-two-hours, record-one-week, phone-time-audit | Handle missing records and avoid double-counting |
| kant-daily-routine-circle | Evaluate sources and distinguish anecdotes from exact routines |
| kids-plan-together | Confirm care conditions and agree on one selectable interval |
| shift-worker-circle, sleep-anchor-day | Check date boundaries and preparation/sleep opportunity |
| smallest-restart-unit | Choose a feasible next action with a stop condition |
| three-hours-after-work | Calculate an evening under explicitly stated constraints |
| tomorrow-in-ten-minutes | Check commitments, a first action, and conflict alternatives |
| weekend-disappears | Budget an outing's full duration and preserve chosen rest |

## Primary source verification

Opened the exact [NIH/NIGMS Circadian Rhythms page](https://www.nigms.nih.gov/education/fact-sheets/Pages/circadian-rhythms) on 2026-09-11. Its definition and sleep/environment sections support the narrowly paraphrased statement in both language versions. The article does not derive individual diagnostic or study-hour recommendations from that source. Other health-related posts link to the separately sourced site guides and do not introduce treatment statistics.

## Rendering changes

Blog generator now emits keyboard-operable language buttons, updates `html.lang` and `aria-pressed`, and includes the editorial-policy footer link. Author attribution names the site organization rather than implying a named individual's personal experience. Article JSON-LD uses the retained publication date and actual modification date. The generator prints sitemap lastmod from modification date when available.

## Validation

- Blog generator completed for all 20 posts, hub, and RSS.
- Independent reviewer separately read all 20 Korean/English bodies, checked worked arithmetic, and independently opened the NIH source; no blocking content issue reported. Generator/output verification is recorded separately by the reviewer.
- Full application build, link validation, browser checks, and deployment status belong to the parent task's final verification record. This document does not assert AdSense approval or publication of the changes.
