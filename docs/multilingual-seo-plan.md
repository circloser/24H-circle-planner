# 24Houring — Multilingual SEO Plan (localized routes + hreflang)

> Status: **design only, not implemented.** Written 2026-08-25.
> Prereq context: SPA (React+Vite) served by the `24houringp` Cloudflare Worker
> with `not_found_handling: single-page-application`; one static `index.html`
> whose `#root` block is pre-mount SEO copy (now **English-first, Korean-second**
> — see [[production-domain]]). Runtime i18n auto-detects the browser language.

## 0) Why (and why not the cheap version)
Today the homepage is **one URL** indexed as **one primary language** (English).
Dumping all 8 languages into that page does NOT create new-language landing
pages — it dilutes relevance and reads as low quality. To actually rank in other
languages you need **separate, indexable URLs per language + hreflang** so Google
serves the right version to each market and treats them as translations (not
duplicates). That is this plan.

## 1) URL strategy — subdirectory (recommended)
```
https://24houring.com/         → English   (x-default)
https://24houring.com/ko/      → 한국어
https://24houring.com/de/      → Deutsch
https://24houring.com/ja/ …    → (add as translations complete)
```
- **Subdirectory** (not subdomain / ccTLD): keeps all authority on one domain,
  simplest on the existing Worker, one Search Console domain property already
  covers it.
- `/` stays English and is the **x-default**. English is already the default
  (commit 415a5c4), so no regression.
- App routes (`/s`, `/widget`, `/about`, `/templates/`, …) stay language-neutral
  for now (phase 2 localizes them).

## 2) Which languages ship
Only **fully-translated** locales get an indexed page — a half-translated page is
bad SEO and worse UX.
- **Now: `en` (/), `ko` (/ko/), `de` (/de/)** — all three dicts are complete
  (553 keys each in `src/i18n/dict/{en,ko,de}.ts`).
- **Later: ja, zh, fr, es, ru** — currently `Partial<Dict>`
  (`src/i18n/translations.ts`). Finish the dict AND the long-form landing copy
  before adding `/{lang}/`. Never publish a localized route for an incomplete
  language.

## 3) Architecture — pre-rendered localized index.html per locale
The pre-mount `#root` block + `<head>` meta are the SEO payload, so each locale
needs its **own static HTML** (same JS bundle). Client-side language switching is
invisible to crawlers, so it can't replace real per-locale HTML.

Build step (new `scripts/i18n-html/build.mjs`):
1. Read the canonical `index.html` as a template.
2. For each shipped locale, emit `dist/{lang}/index.html` (and keep `/` = en) with:
   - translated `<title>`, `meta[name=description]`, `og:*`, `twitter:*`,
     `og:locale`, `<html lang>`,
   - translated `#root` static block (hero / features / how-to / FAQ / …),
   - translated JSON-LD (WebApplication description, FAQPage, HowTo),
   - the **hreflang cluster** (§4),
   - `<link rel="canonical">` = the page's own localized URL,
   - the SAME `<script type="module" src="/assets/…">` bundle reference.
3. Source the copy from a per-locale content file
   (`scripts/i18n-html/content/{lang}.json`) — human/native-quality strings,
   NOT machine translation of the long-form block.

Serving: because these are **real asset files** (`/{lang}/index.html`), the
Worker serves them directly; the SPA `not_found_handling` fallback still covers
in-app deep links. Verify `/ko/` resolves to `/ko/index.html` (may need an
`assets` route or a tiny Worker rule for the trailing-slash → index.html).

## 4) hreflang + canonical (every localized page)
```html
<link rel="canonical" href="https://24houring.com/ko/" />
<link rel="alternate" hreflang="en" href="https://24houring.com/" />
<link rel="alternate" hreflang="ko" href="https://24houring.com/ko/" />
<link rel="alternate" hreflang="de" href="https://24houring.com/de/" />
<link rel="alternate" hreflang="x-default" href="https://24houring.com/" />
```
Rules: reciprocal (every page lists every version **including itself**),
absolute URLs, `x-default` → English. Add a row per language as it ships.

## 5) App integration (small)
- **Initial locale from path**: on boot, if `location.pathname` starts with a
  known `/{lang}/`, use that language instead of the browser-detect default
  (`detectInitialLanguage()` in `src/hooks/usePreferences.tsx`). Path wins over
  navigator; an explicit saved pref still wins over both (or decide precedence).
- **Language switch updates the URL**: changing language in-app should
  `history.pushState` to `/{lang}/` (or `/` for en) so the address matches the
  content and is shareable/indexable. Keep the current in-app state.
- `main.tsx` path routing (`/s`, `/widget`) must ignore the `/{lang}` prefix, or
  those pages stay language-neutral (recommended for phase 1).

## 6) Sitemap
Emit one entry per localized URL, each carrying `xhtml:link` alternates, or list
all locales with alternates on each `<url>`. Update `public/sitemap.xml`
generation + `scripts/verify-seo.mjs` (`SITE`) accordingly. Keep everything on
`https://24houring.com` (the Search Console domain property).

## 7) Content localization scope
- **Phase 1 (this plan):** homepage `/{lang}/` for en/ko/de.
- **Phase 2 (bigger):** localize the generated content hubs —
  `/templates/`, `/guides/`, `/blog/`, and the pillar pages
  (`scripts/templates`, `scripts/gen-pillars.mjs`, `scripts/blog`) — into
  `/{lang}/templates/…` etc. This multiplies indexable pages per market but is
  substantial (regenerate every static page × locales + translate the bodies).
  Do it market-by-market after phase 1 shows traction.

## 8) Rollout
1. Build script + content files for **de** (or ko) as the pilot; ship `/de/`.
2. Submit updated sitemap; request indexing in Search Console.
3. Watch impressions/clicks per country+language for 2–4 weeks.
4. If the pilot gains impressions, add the next locale; then consider phase 2.

## 9) Risks / gotchas
- **Translation quality**: the long-form landing copy must be native-quality;
  machine output ranks poorly and reads as spam. This is the real cost.
- **Incomplete locales**: never route to a language whose dict/copy is partial.
- **Duplicate content**: mitigated by correct reciprocal hreflang + self-canonical.
- **Trailing slash / serving**: confirm `/{lang}/` serves its `index.html`
  (asset routing), and that the SPA fallback doesn't shadow it.
- **PWA/service worker** (`public/sw.js`): make sure it caches the right
  per-locale index and doesn't serve `/`'s HTML for `/ko/` (scope by path;
  bump CACHE version on rollout — see [[pwa-service-worker]]).
- **Play/TWA**: unaffected (loads the app URL); no change needed.

## 10) Effort estimate
- Phase 1 (homepage en/ko/de): build script + hreflang + app locale-from-path +
  sitemap ≈ **1–2 days eng**, plus **native copywriting per language** (the
  gating cost).
- Phase 2 (templates/guides/blog per locale): **weeks**, mostly translation.

## Appendix — current facts to build on
- i18n: full dicts = ko/en/de (553 keys); partial = ja/zh/fr/es/ru
  (`src/i18n/translations.ts`, `TRANSLATIONS: Record<Lang, Partial<Dict>>`).
- Language default: `detectInitialLanguage()` → ko/de by browser tag else en;
  runtime applies `<html lang>` from the pref.
- Routing: `src/main.tsx` branches on `pathname` (`/s`, `/widget`, else app).
- Worker: `wrangler.jsonc` `not_found_handling: single-page-application`,
  `run_worker_first: ["/api/*"]`.
- Landing copy is English-first as of commit 415a5c4.
