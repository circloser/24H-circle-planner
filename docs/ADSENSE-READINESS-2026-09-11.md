# AdSense readiness hardening — 2026-09-11

## Outcome

This pass removes premature advertising and analytics requests, makes unknown URLs return a genuine 404, and aligns public billing statements with the implemented trial behavior. These changes reduce policy and crawler-quality risks while preserving AdSense ownership verification.

Approval remains Google's decision. The next review request cannot be submitted before the date shown in the AdSense account, and ads should remain disabled until a Google-certified consent management platform (CMP) is configured for the EEA, UK, and Switzerland.

## Changes shipped in this pass

- Retained the `google-adsense-account` ownership meta tag and the exact publisher record in `/ads.txt`.
- Removed the Google Analytics bootstrap from the application shell.
- Removed the site-wide editorial analytics loader and its build-time injection.
- Removed the guide-page advertising loader and all current ad requests.
- Updated the privacy policy to describe the site's current behavior and the consent step required before future advertising.
- Added a noindex 404 page and configured Cloudflare static assets to return it with a real 404 for unknown paths.
- Generated noindex application entry files for `/s` and `/widget`, preserving those client routes after removing the SPA catch-all.
- Added publishing checks for third-party loaders, AdSense ownership metadata, `ads.txt`, sitemap membership, 404 metadata, local links, and utility application entries.
- Made trial cancellation scheduling fail closed: the Polar webhook is acknowledged only when Polar confirms `cancel_at_period_end: true`; temporary failures return 503 for retry.
- Updated the terms and refund policy so they accurately describe Polar's default conversion behavior, 24Houring's cancellation scheduling, the portal check, and a full refund for a scheduling error.

## Verification

- Production build and publishing validation: pass.
- ESLint: pass.
- Vitest: 80 files and 695 tests passed.
- Targeted trial-cancellation tests: 3 passed.
- Build output: 113 HTML pages, 8 localized app roots, and 2,620 local resources checked.

## Account-side steps before enabling ads

1. In AdSense **Privacy & messaging**, create or select a Google-certified CMP message for the EEA, UK, and Switzerland.
2. Keep ad code disabled while the site is under review; the ownership meta tag is sufficient for the site connection method currently used.
3. On or after the account's next eligible review date, request another site review.
4. After approval and CMP verification, reintroduce the AdSense script behind the consent flow and update the privacy policy with the live advertising behavior.

## Primary references

- Google AdSense eligibility: https://support.google.com/adsense/answer/7299563
- Site rejection and content/navigation guidance: https://support.google.com/adsense/answer/81904
- Publisher policies: https://support.google.com/publisherpolicies/answer/10502938
- Site connection methods: https://support.google.com/adsense/answer/7584263
- Google-certified CMP requirement: https://support.google.com/adsense/answer/13554116
- Privacy disclosure requirement: https://support.google.com/adsense/answer/1348695
- ads.txt guide: https://support.google.com/adsense/answer/12171612
- Cloudflare static asset 404 handling: https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/
- Polar webhook retries: https://polar.sh/docs/integrate/webhooks/delivery
- Polar subscription cancellation: https://polar.sh/docs/features/subscriptions/manage

## Update — 2026-09-17: Google Analytics is back in the app, region-gated

- The app loads GA4 from `src/lib/ga.ts` (no static loader in any HTML, so the publishing check still holds).
- `/api/geo` answers whether the visitor's country (Cloudflare `cf.country`) is in the EEA, the UK or Switzerland; there, GA stays off until the visitor turns on ⚙ → “사용 통계 보내기”. Unknown countries count as requiring consent.
- Consent Mode defaults deny all advertising storage and signals everywhere; Google signals and ad personalization are off; page locations drop fragments and non-campaign query values.
- Reading pages (guides, blog, templates) still load no Google scripts, and no ad code runs anywhere.
- When AdSense is enabled with a certified CMP, route the GA decision in the EEA/UK/CH through that CMP instead of the ⚙ toggle.
