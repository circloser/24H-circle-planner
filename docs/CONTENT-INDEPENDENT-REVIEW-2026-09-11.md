# Independent editorial review — September 11, 2026

Reviewer lane: content_review, separate from the authors. No AdSense approval prediction is made.

## Scope and outcome

Approved within the reviewed scope after the corrections below: 19 rewritten bilingual guides, five health and five historical-account source JSON files and generated article structure, five situation pages, gallery wording, and the ten templates in Korean/English/German/Japanese. The three previously revised guides were also read for consistency. Blog authoring and its separate review are outside this record.

All revised guide English prose was read, Korean worked values and corresponding text were compared, and the pillar source content was read. The examples distinguish assumptions from measurements, health advice, historical accounts, and actual testimonials. The concrete arithmetic examined includes overnight sleep, commute/preparation, a 90-minute timer window, handovers, weekly study capacity, and work overruns.

## Findings resolved by the root author

- Exam guide: the original weekly calculation allocated the entire non-reserve budget to study but the daily example also needed breaks and wrap-up. The corrected 690 minutes comprise 90 reserve, 140 breaks/preparation/wrap-up, and 460 study. Subject allocations total 460; Monday uses 70 study plus 20 non-study minutes. Verified both languages.
- Nutrition English: clarified round-trip travel versus packing up so the 45-minute lunch example does not appear to count the return journey twice. JSON correction verified; generated output checked by the integration build.
- Stories CTA: replaced copying a person's day with applying the editorial exercise, consistent with the articles' limited historical scope. Generator correction verified.
- Toddler template German and Japanese titles: removed baby/infant wording to match the narrower toddler example and explicit limits in the description. Both source titles verified after correction.

## Source verification

Directly opened the official sources and checked the narrow claims retained: CDC About Sleep (18–60 years: at least seven hours; recurring sleep concerns), NHLBI Healthy Sleep Habits (caffeine and shift-work concerns), NHS Stress (preparation and seeking help), NHS Eatwell Guide (balance over a day or week), WHO Physical Activity (transport and domestic activity). These sources do not establish an app treatment effect or validate the example durations.

Directly checked Stanford's Jobs address (morning reflection), Franklin's autobiography on Project Gutenberg (daily scheme and difficulty observing Order), UNESCO's Nanjung Ilgi entry (dates, seven volumes, subjects), the Paris Review Hemingway interview (stopping with continuation in mind and rereading), and the official TED Huffington introduction (challenging pride in sleep deficits). The limited paraphrases are supported; no reconstructed complete routine or causal success claim is retained.

## Code and regression evidence

- App full-circle orientation agrees with `src/lib/chart-view.ts`; free slot/history limits agree with `src/lib/pro.ts`. Diary selection and protected editing are implemented in the diary dialog and app shell.
- Reviewed `scripts/gen-pillars.mjs`, `scripts/sync-guide-index.mjs`, and the expansion in `scripts/verify-publishing.mjs`. Guide synchronization updates existing card titles/summaries and fails on incomplete matching content. The publisher validator now includes article/template routes, citation anchors through local fragment checks, structured-data parsing, and gallery links. The `/s` exception represents the existing SPA share viewer.
- All 41 inspected guide/pillar/hub/situation/gallery HTML documents had valid JSON-LD and resolvable source fragment targets. The guide hub's single heading contains language spans rather than separate language-div headings; manually verified.
- All ten template slice arrays are semantically identical to HEAD. All 30 template HTML routes retain identical import (`#p`) and read-only preview (`#d`) link arrays compared with HEAD. Existing chart images therefore still represent the unchanged schedule data.
- Ran the current publishing validator successfully: 110 HTML pages, eight persistent app locales, 2,775 local resources, three guarded editorial pages.

No remaining blocking finding was identified in this scope. Browser checks, full build/test completion, deployment, account settings, and contractual/billing behavior are integration responsibilities and are not independently certified by this editorial review.
