/**
 * GET /api/geo → { consentRequired }
 *
 * Whether this visitor's region needs consent before analytics may run (the
 * EEA, the UK and Switzerland), from the country Cloudflare attaches to the
 * request. Only the yes/no answer leaves the Worker; nothing is stored. An
 * unknown country answers yes.
 */
export const CONSENT_COUNTRIES = new Set([
  // EU
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT',
  'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // EEA outside the EU, the UK, Switzerland
  'IS', 'LI', 'NO', 'GB', 'CH',
]);

export function needsConsent(country: unknown): boolean {
  if (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country) || country === 'XX' || country === 'T1') return true;
  return CONSENT_COUNTRIES.has(country);
}

export function handleGeo(request: Request): Response {
  const country = (request as Request & { cf?: { country?: unknown } }).cf?.country;
  return new Response(JSON.stringify({ consentRequired: needsConsent(country) }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Per visitor: never shared across users by a cache.
      'cache-control': 'private, no-store',
      vary: 'cf-ipcountry',
    },
  });
}
