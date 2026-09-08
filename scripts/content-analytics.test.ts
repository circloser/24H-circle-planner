import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source = readFileSync('public/content-analytics.js', 'utf8');
function harness(host = '24houring.com') {
  const appendChild = vi.fn();
  const listeners: Record<string, (event: unknown) => void> = {};
  class FakeElement {
    href = `https://${host}/#p=private-schedule`;
    closest() { return this; }
  }
  const window: { dataLayer?: unknown[]; gtag?: unknown } = {};
  const context = {
    window, URL, Element: FakeElement,
    location: new URL(`https://${host}/templates/exam-student?private=query#private-fragment`),
    document: {
      querySelector: () => ({ href: 'https://24houring.com/templates/exam-student' }),
      documentElement: { lang: 'ko' },
      createElement: () => ({}), head: { appendChild },
      addEventListener: (name: string, listener: (event: unknown) => void) => { listeners[name] = listener; },
    },
  };
  return { context, appendChild, window, listeners, FakeElement };
}
describe('static content analytics', () => {
  it('loads only in production and guards duplicate loading', () => {
    const local = harness('localhost');
    runInNewContext(source, local.context);
    expect(local.appendChild).not.toHaveBeenCalled();
    const live = harness();
    runInNewContext(source, live.context);
    runInNewContext(source, live.context);
    expect(live.appendChild).toHaveBeenCalledTimes(1);
  });
  it('records fixed content IDs and template clicks without raw query or import data', () => {
    const live = harness();
    runInNewContext(source, live.context);
    live.listeners.click({ target: new live.FakeElement() });
    const output = JSON.stringify(live.window.dataLayer);
    expect(output).toContain('content_view');
    expect(output).toContain('template_cta_click');
    expect(output).toContain('exam-student');
    expect(output).not.toContain('private');
    expect(output).not.toContain('#p=');
  });
  it('forwards only allowlisted campaign values and preserves the template and locale', () => {
    const live = harness();
    live.context.location = new URL('https://24houring.com/templates/exam-student?utm_source=pinterest&utm_medium=social&utm_campaign=templates&note=private');
    runInNewContext(source, live.context);
    const link = new live.FakeElement();
    link.href = 'https://24houring.com/ja/#p=private-schedule';
    live.listeners.click({ target: link });
    expect(link.href).toBe('https://24houring.com/ja/?utm_source=pinterest&utm_medium=social&utm_campaign=templates#p=private-schedule');
    const output = JSON.stringify(live.window.dataLayer);
    expect(output).toContain('utm_source=pinterest');
    expect(output).not.toContain('private');
  });
  it('rejects arbitrary campaign values instead of forwarding user data', () => {
    const live = harness();
    live.context.location = new URL('https://24houring.com/templates/exam-student?utm_source=private-source&utm_medium=private-medium&utm_campaign=private-campaign');
    runInNewContext(source, live.context);
    const link = new live.FakeElement();
    live.listeners.click({ target: link });
    expect(new URL(link.href).search).toBe('');
    expect(JSON.stringify(live.window.dataLayer)).not.toContain('private');
  });
});
