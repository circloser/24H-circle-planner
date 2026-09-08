import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync('public/publisher-ads.js', 'utf8');
function harness(href = 'https://24houring.com/guides/time-blocking', content = true, canonical = 'https://24houring.com/guides/time-blocking') {
  const appendChild = vi.fn();
  const context = {
    window: {}, URL, location: new URL(href),
    document: {
      querySelector: (selector: string) => selector === 'main[data-publisher-content]' ? (content ? {} : null)
        : selector === 'link[rel="canonical"]' ? (canonical ? { href: canonical } : null) : null,
      createElement: () => ({}), head: { appendChild },
    },
  };
  return { context, appendChild };
}

describe('publisher ad boundaries', () => {
  it.each(['/', '/ko/', '/s/shared', '/widget/test', '/guides/', '/guides/unreviewed', '/templates/exam-student', '/about'])('does not load ads on %s even with an article canonical', (path) => {
    const h = harness(`https://24houring.com${path}`);
    runInNewContext(source, h.context);
    expect(h.appendChild).not.toHaveBeenCalled();
  });
  it.each(['http://24houring.com', 'https://localhost', 'https://preview.workers.dev', 'https://24houring.com.example.org'])('does not load ads on %s', (origin) => {
    const h = harness(`${origin}/guides/time-blocking`);
    runInNewContext(source, h.context);
    expect(h.appendChild).not.toHaveBeenCalled();
  });
  it('requires editorial content and matching canonical, including on SPA fallbacks', () => {
    for (const h of [harness(undefined, false), harness(undefined, true, ''), harness(undefined, true, 'invalid'), harness(undefined, true, 'https://24houring.com/'), harness(undefined, true, 'https://example.com/guides/time-blocking')]) {
      runInNewContext(source, h.context);
      expect(h.appendChild).not.toHaveBeenCalled();
    }
  });
  it.each(['time-blocking', 'time-audit', 'morning-evening-routine'])('loads once on reviewed %s article, including clean URL variants', (slug) => {
    for (const suffix of ['', '/', '.html']) {
      const h = harness(`https://www.24houring.com/guides/${slug}${suffix}`, true, `https://24houring.com/guides/${slug}`);
      runInNewContext(source, h.context);
      runInNewContext(source, h.context);
      expect(h.appendChild).toHaveBeenCalledTimes(1);
      expect(h.appendChild.mock.calls[0][0]).toMatchObject({ async: true, crossOrigin: 'anonymous', src: expect.stringContaining('ca-pub-6947130056543786') });
    }
  });
});
