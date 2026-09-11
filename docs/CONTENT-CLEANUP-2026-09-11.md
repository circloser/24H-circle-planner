# Content cleanup — 2026-09-11

This batch addresses weak or unsupported editorial claims; it cannot establish or guarantee AdSense eligibility.

## Changes

- Reworked the 19 remaining bilingual guides; the three previously improved guides retain their URLs and guarded advertising configuration. The directory now follows article titles and summaries.
- Reworked five health and five historical-account articles around narrowly scoped primary sources, explicit planning exercises and corrections to unsupported routine claims. Retained all 40 legacy redirect destinations.
- Reworked five situation pages and corrected gallery health-effect wording. Examples are identified as fictional.
- Reworked ten template descriptions and tips in Korean, English, German and Japanese. Preserved all chart data, images, import URLs and preview URLs. Corrected related-template routes.
- Reworked all 20 bilingual blog posts, preserved publication dates, added accurate modification dates and editorial references, and removed obsolete claim-bearing image references. Generated 21 HTML pages and RSS.

## Evidence available before final integration

- Lint passed; Vitest: 78 files, 690 tests passed.
- Existing smoke and mobile E2E suites passed.
- Static publishing checks cover all 110 HTML files, persistent locale content, JSON-LD, local resources and guarded ad pages.
- Independent review: CONTENT-INDEPENDENT-REVIEW-2026-09-11.md. This covers guides, pillars, situation pages, gallery, templates and integration scripts; blog is reviewed separately.

## Scope limits

AdSense account review, payment policy enforcement and approval decisions are external. The user's screenshot says another review can be requested from September 15, 2026. An existing trial-cancellation/terms consistency question remains outside this content change; this batch does not change contractual rights or billing behavior.

## Final integration verification

Production build passed; publishing validator passed 110 HTML pages, 8 app locales, 2692 local resources, and 3 guarded editorial pages. Browser verification covered 95 routes at 390px width, 190 language-view checks: no horizontal overflow, missing visible main heading, broken image, or page script error. Lazy images were explicitly decoded before checking. Blog independent review passed (BLOG-INDEPENDENT-REVIEW-2026-09-11.md). Sitemap modification dates updated only for changed HTML routes. Deployment status is reported separately after Git publication.

## Publication blocked

Git staging (`git add` for the reviewed content changes) was rejected by automatic approval review: "Your workspace is out of credits. Ask your workspace owner to refill in order to continue." No workaround was attempted. No commit, push or deployment was performed by this content-cleanup task. All changes remain in the working tree. The last read-only GitHub check showed existing HEAD 6abacac619a181f794306d2b69e2cd4bf21d2e5b successfully deployed, which is NOT this uncommitted cleanup.

Last cosmetic correction: template generator strips whitespace-only output lines; regenerated and git diff --check passed. Resume with staging the scoped reviewed changes, inspect staged diff, commit, push and verify the new commit's Cloudflare check and live content. No further editorial authoring is pending.
