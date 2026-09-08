/* Static content funnel: never send import fragments or arbitrary query values. */
(function () {
  if (window.__contentAnalytics || !/^https?:$/.test(location.protocol) ||
      !/^(www\.)?24houring\.com$/.test(location.hostname)) return;
  const canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) return;
  const path = new URL(canonical.href).pathname.replace(/\.html$/, '').replace(/\/$/, '');
  const match = path.match(/^\/(?:(ko|en|de|ja|zh|fr|es|ru)\/)?(templates|guides|stories|health)(?:\/([a-z0-9-]+))?$/);
  if (!match) return;
  window.__contentAnalytics = true;
  const params = { content_type: match[2], content_id: match[3] || 'index', language: match[1] || document.documentElement.lang || 'en' };
  const safeUrl = new URL('https://24houring.com' + path);
  const allowedCampaign = {
    utm_source: ['pinterest', 'instagram', 'reddit', 'youtube', 'x', 'playstore', 'naver', 'everytime'],
    utm_medium: ['social', 'referral', 'cpc', 'qr', 'bio'],
    utm_campaign: ['cards', 'studygram', 'templates', 'launch', 'sunset', 'community', 'demo'],
  };
  const incoming = new URL(location.href);
  for (const [key, allowed] of Object.entries(allowedCampaign)) {
    const value = incoming.searchParams.get(key);
    if (allowed.includes(value)) safeUrl.searchParams.set(key, value);
  }
  const safeLocation = safeUrl.href;
  if (typeof window.gtag !== 'function') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', 'G-2YQFP0PTLZ', { page_location: safeLocation, page_referrer: '', send_page_view: false });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-2YQFP0PTLZ';
    document.head.appendChild(script);
  }
  function emit(name) {
    try { window.gtag('event', name, { ...params, page_location: safeLocation, page_referrer: '' }); } catch { /* analytics must never block navigation */ }
  }
  emit('content_view');
  document.addEventListener('click', function (event) {
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!anchor) return;
    const destination = new URL(anchor.href, location.href);
    if (destination.origin !== location.origin || !/^\/(?:(?:ko|en|de|ja|zh|fr|es|ru)\/)?$/.test(destination.pathname)) return;
    if (destination.hash.startsWith('#p=')) {
      // Preserve template payload and locale while forwarding only known campaigns.
      destination.search = safeUrl.search;
      anchor.href = destination.href;
      emit('template_cta_click');
    }
  });
})();
