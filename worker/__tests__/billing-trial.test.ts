import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../index';
import type { Env } from '../index';

function fakeDb() {
  return {
    prepare() {
      const statement = {
        bind() { return statement; },
        async first() { return null; },
        async run() { return { results: [], success: true, meta: {} }; },
        async all() { return { results: [], success: true, meta: {} }; },
      };
      return statement;
    },
    async exec() { return { count: 0, duration: 0 }; },
    async batch() { return []; },
  };
}

async function signedWebhook(secret: string): Promise<Request> {
  const body = JSON.stringify({
    type: 'subscription.updated',
    data: {
      id: 'sub_trial',
      status: 'trialing',
      cancel_at_period_end: false,
      current_period_end: '2026-10-11T00:00:00.000Z',
      metadata: { user_id: 'user_1' },
    },
  });
  const id = 'evt_trial';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`)));
  let binary = '';
  for (const byte of mac) binary += String.fromCharCode(byte);
  return new Request('https://24houring.com/api/webhooks/polar', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': timestamp,
      'webhook-signature': `v1,${btoa(binary)}`,
    },
    body,
  });
}

function env(secret: string): Env {
  return {
    ASSETS: { fetch: async () => new Response('asset') },
    DB: fakeDb(),
    POLAR_ACCESS_TOKEN: 'test-token',
    POLAR_WEBHOOK_SECRET: secret,
    POLAR_SERVER: 'production',
  };
}

afterEach(() => vi.restoreAllMocks());

describe('Polar trial cancellation scheduling', () => {
  it('acknowledges a trial webhook only after Polar confirms cancel-at-period-end', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ cancel_at_period_end: true })));
    const response = await worker.fetch(await signedWebhook('test-secret'), env('test-secret'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });

  it('returns a retryable error when Polar does not schedule the cancellation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream error', { status: 500 })));
    const response = await worker.fetch(await signedWebhook('test-secret'), env('test-secret'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'trial_cancellation_not_scheduled' });
  });

  it('returns a retryable error when Polar responds without confirmation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ cancel_at_period_end: false })));
    const response = await worker.fetch(await signedWebhook('test-secret'), env('test-secret'));
    expect(response.status).toBe(503);
  });
});
