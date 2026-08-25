/*
 * Post-build: generate localized landing pages from dist/index.html.
 *
 * The pre-mount #root block + <head> meta are the SEO payload, so each language
 * needs its OWN static HTML (crawlers can't see client-side language switching).
 * We clone the built dist/index.html (which already has the hashed bundle refs +
 * all head scripts), swap the localized head meta / #root / JSON-LD, add the
 * hreflang cluster, and write dist/{lang}/index.html. Root (/) stays English and
 * is the x-default; every page cross-links to all of them.
 *
 * Ships only FULLY-prepared locales — see docs/multilingual-seo-plan.md.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', '..', 'dist');
const indexPath = join(dist, 'index.html');

const ORIGIN = 'https://24houring.com';
// Locales that get an indexed page. `en` is the root (/). Add a code here only
// once its landing content module + (ideally) app dict are complete.
const LOCALES = ['en', 'ko', 'de', 'ja', 'zh', 'fr', 'es', 'ru'];
const localeHref = (l) => (l === 'en' ? `${ORIGIN}/` : `${ORIGIN}/${l}/`);

const hreflangBlock = [
  ...LOCALES.map((l) => `    <link rel="alternate" hreflang="${l}" href="${localeHref(l)}" />`),
  `    <link rel="alternate" hreflang="x-default" href="${ORIGIN}/" />`,
].join('\n');

/** Inject the reciprocal hreflang cluster once, just before </head>. */
function withHreflang(html) {
  if (html.includes('rel="alternate" hreflang=')) return html;
  return html.replace('</head>', `${hreflangBlock}\n  </head>`);
}

/** Replace the value of `<meta {attr}="{key}" content="…">`. */
function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`);
  return html.replace(re, `$1${escapeAttr(value)}$2`);
}
const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** Localize the three JSON-LD blocks (WebApplication, FAQPage, HowTo) in order. */
function localizeJsonLd(html, L) {
  let i = -1;
  return html.replace(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    (whole, body) => {
      i += 1;
      let obj;
      try {
        obj = JSON.parse(body);
      } catch {
        return whole; // leave malformed block untouched
      }
      if (obj['@type'] === 'WebApplication') {
        obj.alternateName = L.alternateName;
        obj.description = L.webAppDescription;
        obj.url = localeHref(L.lang);
      } else if (obj['@type'] === 'FAQPage') {
        obj.mainEntity = L.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        }));
      } else if (obj['@type'] === 'HowTo') {
        obj.name = L.howtoName;
        obj.description = L.howtoDescription;
        obj.step = L.howto.map((s, n) => ({
          '@type': 'HowToStep',
          position: n + 1,
          name: s.name,
          text: s.text,
        }));
      }
      return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n    </script>`;
    },
  );
}

function buildLocale(base, L) {
  let html = base;
  html = html.replace(/<html lang="[^"]*"/, `<html lang="${L.lang}"`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${L.title}</title>`);
  html = setMeta(html, 'name', 'description', L.description);
  html = setMeta(html, 'property', 'og:title', L.ogTitle);
  html = setMeta(html, 'property', 'og:description', L.ogDescription);
  html = setMeta(html, 'name', 'twitter:title', L.twTitle);
  html = setMeta(html, 'name', 'twitter:description', L.twDescription);
  html = setMeta(html, 'property', 'og:image:alt', L.ogImageAlt);
  html = html.replace(/(<meta property="og:locale" content=")[^"]*(")/, `$1${L.ogLocale}$2`);
  html = html.replace(/(<meta property="og:locale:alternate" content=")[^"]*(")/, `$1en_US$2`);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${localeHref(L.lang)}$2`);
  // Vite moves the module script into <head>, so #root is the last body element:
  // match up to the </div> that closes #root (the first one before </body>).
  html = html.replace(
    /(<div id="root">)[\s\S]*?(<\/div>)(\s*<\/body>)/,
    `$1\n${L.mainHtml}\n    </div>$3`,
  );
  html = localizeJsonLd(html, L);
  html = withHreflang(html);
  return html;
}

// ── Run ───────────────────────────────────────────────────────────────────────
const base = readFileSync(indexPath, 'utf8');

// Root (/) — English, just add the hreflang cluster.
writeFileSync(indexPath, withHreflang(base), 'utf8');
console.log('i18n-html: wrote / (en) + hreflang');

for (const lang of LOCALES.filter((l) => l !== 'en')) {
  const L = (await import(`./content/${lang}.mjs`)).default;
  const outDir = join(dist, lang);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), buildLocale(base, L), 'utf8');
  console.log(`i18n-html: wrote /${lang}/`);
}
