import { describe, expect, it, vi } from 'vitest';
import { callModel, streamError, writerFailure } from '../memoir';
import { RELAY_LOCATION, RELAY_NAME, type ModelRelayNamespace } from '../model-relay';

describe('the call to the writer', () => {
  it('goes through the US relay when the Worker has one, never straight out', async () => {
    const seen: { name?: string; hint?: string; body?: string } = {};
    const relay: ModelRelayNamespace = {
      idFromName: (name) => { seen.name = name; return name; },
      get: (_id, opts) => {
        seen.hint = opts?.locationHint;
        return { fetch: async (_url, init) => { seen.body = String(init?.body); return new Response('ok'); } };
      },
    };
    const direct = vi.fn();
    vi.stubGlobal('fetch', direct);
    const res = await callModel({ ANTHROPIC_API_KEY: 'k', MODEL_RELAY: relay }, 'system', 'hello', 100);
    vi.unstubAllGlobals();
    expect(await res.text()).toBe('ok');
    expect(direct).not.toHaveBeenCalled();
    expect(seen).toMatchObject({ name: RELAY_NAME, hint: RELAY_LOCATION });
    // The key stays in the Worker: the relay adds it from its own env.
    expect(JSON.parse(seen.body!)).toMatchObject({ system: 'system', max_tokens: 100, stream: true });
    expect(seen.body).not.toContain('"k"');
  });
});

describe('why the writer said no', () => {
  it('reads Anthropic\'s own reason out of an error answer', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low.' } }), { status: 400 });
    expect(await writerFailure('saju', res)).toBe('400 invalid_request_error: Your credit balance is too low.');
    expect(await writerFailure('saju', new Response('bad gateway', { status: 502 }))).toBe('502: bad gateway');
    expect(await writerFailure('saju', new Response(null, { status: 529 }))).toBe('HTTP 529');
    quiet.mockRestore();
  });

  it('spots an error carried in the stream itself, and nothing else', () => {
    expect(streamError('data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}'))
      .toBe('overloaded_error: Overloaded');
    expect(streamError('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"error"}}')).toBeNull();
    expect(streamError('event: error')).toBeNull();
  });
});
