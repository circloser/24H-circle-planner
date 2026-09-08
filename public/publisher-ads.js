/* Only the explicitly reviewed editorial pages can request Google ads.
 * Site connection uses the google-adsense-account meta tag, independently.
 * This allowlist is an editorial decision, not a claim of Google approval.
 */
(function () {
  if (window.__publisherAdsLoaded || location.protocol !== 'https:' ||
      !/^(www\.)?24houring\.com$/.test(location.hostname)) return;

  const pages = new Set([
    '/guides/time-blocking',
    '/guides/time-audit',
    '/guides/morning-evening-routine',
  ]);
  const normalize = (path) => path.replace(/\/$/, '').replace(/\.html$/, '');
  const path = normalize(location.pathname);
  if (!pages.has(path) || !document.querySelector('main[data-publisher-content]')) return;
  const canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) return;
  let url;
  try { url = new URL(canonical.href); } catch { return; }
  if (url.origin !== 'https://24houring.com' || normalize(url.pathname) !== path) return;
  if (document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')) return;

  window.__publisherAdsLoaded = true;
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6947130056543786';
  document.head.appendChild(script);
})();
