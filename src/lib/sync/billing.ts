/**
 * Pro billing (Polar · Merchant of Record). Thin client over the Worker's
 * billing endpoints — the Worker holds the Polar access token and talks to
 * Polar's API; the browser only ever gets a redirect URL.
 *
 *  - startCheckout()      → POST /api/checkout        → Polar hosted checkout
 *  - openBillingPortal()  → POST /api/billing/portal  → Polar customer portal
 *
 * Both require a signed-in session (the sid cookie). On success we navigate the
 * top-level window to the returned URL; failures throw so the caller can toast.
 */
async function postForUrl(path: string, body?: unknown): Promise<string> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    let code = `http_${res.status}`;
    try { code = ((await res.json()) as { error?: string }).error ?? code; } catch { /* not JSON */ }
    throw new Error(code);
  }
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error(`${path} missing url`);
  return data.url;
}

export type BillingInterval = 'month' | 'year';

/** Start a Pro checkout: redirects the browser to Polar's hosted checkout page. */
export async function startCheckout(interval: BillingInterval = 'month'): Promise<void> {
  window.location.href = await postForUrl('/api/checkout', { interval });
}

/** Open the Polar customer portal (manage / cancel the subscription). */
export async function openBillingPortal(): Promise<void> {
  window.location.href = await postForUrl('/api/billing/portal');
}
