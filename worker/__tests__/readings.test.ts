import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../index';
import type { Env } from '../index';
import { cleanRecords, cleanSajuInput, recordsText, sajuSystem, sajuUser } from '../readings';
import { cleanMemoirInput, memoirUser } from '../memoir';

/**
 * The two readings are tried out by the admins first: an admin sees them and
 * runs them free; anybody else is told they are not there.
 */
function envFor(email: string, extra: Partial<Env> = {}) {
  const db = {
    prepare(sql: string) {
      const statement = {
        bind() { return statement; },
        async first() {
          if (sql.includes('FROM sessions')) return { id: 'u1', email, provider: 'google' };
          if (sql.includes('FROM ai_credits')) return { credits: 0 };
          return null;
        },
        async run() { return { results: [], success: true, meta: { changes: 0 } }; },
        async all() { return { results: [], success: true, meta: {} }; },
      };
      return statement;
    },
    async exec() { return { count: 0, duration: 0 }; },
    async batch() { return []; },
  };
  return {
    DB: db, ADMIN_EMAILS: 'boss@example.com', ANTHROPIC_API_KEY: 'k', ASSETS: { fetch: async () => new Response('app') },
    ...extra,
  } as unknown as Env;
}

const req = (path: string, body?: unknown) => new Request(`https://24houring.com${path}`, {
  method: body ? 'POST' : 'GET',
  headers: { cookie: 'sid=abc', 'content-type': 'application/json' },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

/** A model that answers with one short stream. */
function fakeModel() {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const stream = 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"## 한눈에\\n글"}}\n\n';
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(stream, { status: 200 });
  });
  return calls;
}

const chart = {
  lang: 'ko', birthDate: '1990-05-15', birthTime: '08:30',
  chart: {
    pillars: ['시주 병진(丙辰)', '일주 을유(乙酉)', '월주 신사(辛巳)', '연주 경오(庚午)'],
    dayMaster: '을목(乙木) · 음',
    elements: '목 1, 화 2, 토 1, 금 3, 수 1',
    tenGods: [], daeun: ['3세 임오(壬午)'], notes: [],
  },
  records: { moments: [{ date: '2012-03', title: '첫 직장' }], people: [{ name: '윤도현', group: 'friend', closeness: 5 }] },
};

afterEach(() => vi.unstubAllGlobals());

describe('the readings are for the admins while they are tried out', () => {
  it('shows an admin the 사주 reading, and nobody else', async () => {
    expect(await (await worker.fetch(req('/api/life/saju'), envFor('boss@example.com'))).json()).toEqual({ enabled: true, admin: true });
    expect(await (await worker.fetch(req('/api/life/saju'), envFor('someone@example.com'))).json()).toEqual({ enabled: false });
  });

  it('tells an admin plainly when the writer is not set up', async () => {
    const res = await worker.fetch(req('/api/life/saju'), envFor('boss@example.com', { ANTHROPIC_API_KEY: undefined }));
    expect(await res.json()).toEqual({ enabled: false, admin: true, missing: 'ANTHROPIC_API_KEY' });
  });

  it('writes a 사주 reading for an admin, from the chart and the records', async () => {
    const calls = fakeModel();
    const res = await worker.fetch(req('/api/life/saju', chart), envFor('boss@example.com'));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('한눈에');
    const sent = calls[0].body as { system: string; messages: { content: string }[] };
    expect(sent.system).toContain('Never predict events');
    expect(sent.messages[0].content).toContain('을목(乙木)');
    expect(sent.messages[0].content).toContain('첫 직장');
    expect(sent.messages[0].content).toContain('윤도현');
  });

  it('refuses anybody else, before any model is asked', async () => {
    const calls = fakeModel();
    expect((await worker.fetch(req('/api/life/saju', chart), envFor('someone@example.com'))).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it('lets an admin write a memoir without a credit, and keeps it closed to others', async () => {
    fakeModel();
    const memoir = { lang: 'ko', moments: [{ date: '2000', title: 'a' }, { date: '2001', title: 'b' }, { date: '2002', title: 'c' }] };
    const state = await (await worker.fetch(req('/api/life/memoir'), envFor('boss@example.com'))).json();
    expect(state).toMatchObject({ enabled: true, admin: true });
    expect((await worker.fetch(req('/api/life/memoir', memoir), envFor('boss@example.com'))).status).toBe(200);
    expect(await (await worker.fetch(req('/api/life/memoir'), envFor('someone@example.com', { POLAR_MEMOIR_PRODUCT_ID: 'p' }))).json())
      .toEqual({ enabled: false });
    expect((await worker.fetch(req('/api/life/memoir', memoir), envFor('someone@example.com', { POLAR_MEMOIR_PRODUCT_ID: 'p' }))).status).toBe(403);
  });
});

describe('what the model is given', () => {
  it('cuts the records to size and keeps only their shape', () => {
    const rec = cleanRecords({
      moments: [{ date: 'yesterday', title: 'x' }, { date: '2010', title: 'y'.repeat(500), with: ['a', 7] }],
      people: [{ name: '' }, { name: '정하윤', group: 'family', sub: '외가', closeness: 9, met: 3, lastMet: '2026-01-01' }],
      diary: [{ date: '2026-01-02', note: 'z'.repeat(900) }],
      me: { mbti: ['INFP (2020-01-01)'], moods: [{ month: '2026-01', avg: 9 }] },
    });
    expect(rec.moments).toHaveLength(1);
    expect(rec.moments[0].title).toHaveLength(120);
    expect(rec.moments[0].with).toEqual(['a']);
    expect(rec.people).toEqual([{ name: '정하윤', line: 'family, 외가, closeness 5/5, met 3 times, last 2026-01-01' }]);
    expect(rec.diary[0].note).toHaveLength(400);
    expect(rec.me.moods).toEqual([{ month: '2026-01', avg: 5 }]);
    expect(recordsText(rec)).toContain('INFP');
  });

  it('refuses a chart with no pillars in it', () => {
    expect(cleanSajuInput({ birthDate: '1990-05-15', chart: { pillars: [] } })).toBeNull();
    expect(cleanSajuInput({ birthDate: 'never', chart: chart.chart })).toBeNull();
    expect(cleanSajuInput(chart)?.birthTime).toBe('08:30');
  });

  it('writes the reading in the reader language, and says the rules', () => {
    expect(sajuSystem('ko')).toContain('Korean');
    expect(sajuSystem('ko')).toMatch(/health, illness/);
    expect(sajuUser(cleanSajuInput(chart)!)).toContain('1990-05-15 08:30');
  });

  it('gives the memoir the rest of the record as well as the line', () => {
    const input = cleanMemoirInput({
      lang: 'ko',
      moments: [{ date: '2000', title: 'a' }, { date: '2001', title: 'b' }, { date: '2002', title: 'c' }],
      records: { people: [{ name: '윤도현', group: 'friend' }], diary: [{ date: '2026-01-01', note: '맑은 날' }] },
    })!;
    const text = memoirUser(input);
    expect(text).toContain('윤도현');
    expect(text).toContain('맑은 날');
  });
});
