import { describe, expect, it, vi } from 'vitest';
import { streamError, writerFailure } from '../memoir';

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
