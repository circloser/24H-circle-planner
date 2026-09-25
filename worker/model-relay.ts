/**
 * The call to Anthropic, always made from the United States.
 *
 * A Worker runs in whichever Cloudflare data centre the visitor reached, and
 * visitors in Korea are often served from Hong Kong — where Anthropic does not
 * serve, and answers `403 forbidden: Request not allowed`. The same reading
 * would work one minute and fail the next depending on the route taken. So
 * the request is handed to this Durable Object, created once with a location
 * hint for western North America; it forwards the request from there and
 * streams the answer straight back.
 *
 * It holds no state and has no public address: only the Worker can reach it
 * through its binding (env.MODEL_RELAY), and the API key never leaves the
 * Worker's own environment.
 */

interface RelayEnv {
  ANTHROPIC_API_KEY?: string;
}

/** Where the relay lives: western North America. */
export const RELAY_LOCATION = 'wnam';
/** One relay is plenty; it only forwards. */
export const RELAY_NAME = 'anthropic-us';

export class ModelRelay {
  private readonly env: RelayEnv;

  constructor(_state: unknown, env: RelayEnv) {
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
        // Betas the Worker asked for (the server-side fallback) pass through.
        ...(request.headers.get('anthropic-beta') ? { 'anthropic-beta': request.headers.get('anthropic-beta')! } : {}),
      },
      body: await request.text(),
    });
  }
}

/** The binding, as much of it as the Worker uses. */
export interface ModelRelayNamespace {
  idFromName(name: string): unknown;
  get(id: unknown, options?: { locationHint?: string }): { fetch(input: string, init?: RequestInit): Promise<Response> };
}
