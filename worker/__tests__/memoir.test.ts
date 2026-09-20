import { describe, expect, it } from 'vitest';
import {
  MEMOIR_MAX_MOMENTS, cleanMemoirInput, deltaText, memoirEnabled, memoirStream, memoirSystem, memoirUser,
} from '../memoir';

const moment = (n: number) => ({ date: `20${String(10 + n).padStart(2, '0')}`, title: `moment ${n}` });
const three = [moment(1), moment(2), moment(3)];

describe('what a memoir may be made of', () => {
  it('takes a whole record', () => {
    const input = cleanMemoirInput({
      lang: 'ko',
      name: '김하늘',
      birthDate: '1990-05-15',
      moments: [{ date: '2010-03', endDate: '2014-02', title: '대학', description: '서울', category: 'education', age: 19 }, moment(2), moment(3)],
      endingNote: '고마웠어요',
      wish: '아이들이 읽을 수 있게',
    });
    expect(input).toEqual({
      lang: 'ko',
      name: '김하늘',
      birthDate: '1990-05-15',
      moments: [
        { date: '2010-03', endDate: '2014-02', title: '대학', description: '서울', category: 'education', age: 19 },
        moment(2), moment(3),
      ],
      endingNote: '고마웠어요',
      wish: '아이들이 읽을 수 있게',
    });
  });

  it('refuses a life too short to write about', () => {
    expect(cleanMemoirInput({ lang: 'ko', moments: [moment(1), moment(2)] })).toBeNull();
    expect(cleanMemoirInput({ lang: 'ko', moments: [] })).toBeNull();
    expect(cleanMemoirInput(null)).toBeNull();
    expect(cleanMemoirInput('a whole life')).toBeNull();
  });

  it('drops entries that are not dated moments', () => {
    const input = cleanMemoirInput({
      moments: [{ date: 'yesterday', title: 'x' }, { date: '2010' }, { title: 'no date' }, null, ...three],
    });
    expect(input?.moments).toEqual(three);
  });

  it('falls back to English for a language it does not have', () => {
    expect(cleanMemoirInput({ lang: 'kl', moments: three })?.lang).toBe('en');
    expect(cleanMemoirInput({ moments: three })?.lang).toBe('en');
  });

  it('will not be handed a life of ten thousand moments', () => {
    const many = Array.from({ length: MEMOIR_MAX_MOMENTS + 50 }, (_, i) => moment(i % 80));
    expect(cleanMemoirInput({ moments: many })?.moments).toHaveLength(MEMOIR_MAX_MOMENTS);
  });

  it('cuts a description down rather than refusing it', () => {
    const long = cleanMemoirInput({ moments: [{ date: '2010', title: 'x', description: 'y'.repeat(5000) }, moment(2), moment(3)] });
    expect(long?.moments[0].description?.length).toBe(1200);
  });
});

describe('what the writer is told', () => {
  it('names the language it must write in', () => {
    expect(memoirSystem('ko')).toContain('한국어');
    expect(memoirSystem('ja')).toContain('日本語');
    expect(memoirSystem('kl')).toContain('English');
  });

  it('forbids inventing anything', () => {
    expect(memoirSystem('en')).toContain('Invent nothing');
  });

  it('lays the chronology out in order, with what is known and no more', () => {
    const text = memoirUser({
      lang: 'ko',
      name: '하늘',
      birthDate: '1990-05-15',
      moments: [
        { date: '1997-03-02', title: '초등학교 입학', age: 6 },
        { date: '2010-03', endDate: '2014-02', title: '대학', description: '서울', category: 'education' },
      ],
      endingNote: '고마웠어요',
    });
    expect(text).toContain('Born: 1990.05.15');
    expect(text).toContain('- 1997.03.02 (age 6) 초등학교 입학');
    expect(text).toContain('- 2010.03–2014.02 [education] 대학 — 서울');
    expect(text).toContain('고마웠어요');
    // The moments keep the order they were given in.
    expect(text.indexOf('초등학교')).toBeLessThan(text.indexOf('대학'));
  });

  it('says nothing about a name, a birth date or a wish it was not given', () => {
    const text = memoirUser({ lang: 'en', moments: three });
    expect(text).not.toContain('Name:');
    expect(text).not.toContain('Born:');
    expect(text).not.toContain('asked of you');
  });
});

describe('the feature is off until it is set up', () => {
  it('needs a key and a product', () => {
    expect(memoirEnabled({})).toBe(false);
    expect(memoirEnabled({ ANTHROPIC_API_KEY: 'k' })).toBe(false);
    expect(memoirEnabled({ POLAR_MEMOIR_PRODUCT_ID: 'p' })).toBe(false);
    expect(memoirEnabled({ ANTHROPIC_API_KEY: 'k', POLAR_MEMOIR_PRODUCT_ID: 'p' })).toBe(true);
  });
});

describe('the stream back to the browser', () => {
  it('reads the text out of one event, and ignores the rest', () => {
    expect(deltaText('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"안녕"}}')).toBe('안녕');
    expect(deltaText('event: content_block_delta')).toBeNull();
    expect(deltaText('data: {"type":"message_start"}')).toBeNull();
    expect(deltaText('data: [DONE]')).toBeNull();
    expect(deltaText('data: {not json')).toBeNull();
    expect(deltaText('')).toBeNull();
  });

  const sse = (...texts: string[]) =>
    texts.map((t) => `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: t } })}\n\n`).join('');

  /** Feed the bytes in arbitrary chunks, as a network would. */
  const source = (raw: string, cut: number) => new ReadableStream<Uint8Array>({
    start(controller) {
      const bytes = new TextEncoder().encode(raw);
      for (let i = 0; i < bytes.length; i += cut) controller.enqueue(bytes.slice(i, i + cut));
      controller.close();
    },
  });

  const read = async (s: ReadableStream<Uint8Array>) => {
    const reader = s.getReader();
    const decoder = new TextDecoder();
    let out = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
    }
    return out;
  };

  it('turns the events into the memoir itself, however the bytes arrive', async () => {
    for (const cut of [1, 7, 64, 4096]) {
      const { body, written } = memoirStream(source(sse('## 첫 장\n', '나는 ', '1990년에 태어났다.'), cut));
      const text = await read(body);
      expect(text).toBe('## 첫 장\n나는 1990년에 태어났다.');
      expect(await written).toBe(text.length);
    }
  });

  it('reports nothing written when the model said nothing — that is what a refund hangs on', async () => {
    const { body, written } = memoirStream(source('event: message_start\ndata: {"type":"message_start"}\n\n', 16));
    expect(await read(body)).toBe('');
    expect(await written).toBe(0);
  });

  it('ends the memoir where a broken stream stopped, without throwing', async () => {
    // One good chunk, then the connection goes. (An error raised in the same
    // turn as the enqueue would throw the chunk away with it — a stream drops
    // whatever it has queued when it errors.)
    let step = 0;
    const broken = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (step++ === 0) controller.enqueue(new TextEncoder().encode(sse('절반까지')));
        else controller.error(new Error('connection lost'));
      },
    });
    const { body, written } = memoirStream(broken);
    expect(await read(body)).toBe('절반까지');
    expect(await written).toBe(4);
  });
});
