/**
 * The 사주 reading against the real writer.
 *
 * Skipped unless ANTHROPIC_API_KEY is set, because it costs a request and a
 * minute: run it by hand after changing the instructions in worker/readings.ts,
 *
 *   ANTHROPIC_API_KEY=sk-ant-… npx vitest run worker/__tests__/saju-live.test.ts
 *
 * Each reading is also written to the system temp folder (the path is printed)
 * so it can be read in full. The checks are the promises the instructions
 * make: the shape the page and the share card read, the length, and the
 * things a reading must never say.
 */
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { callModel, memoirStream } from '../memoir';
import { SAJU_MAX_TOKENS, cleanSajuInput, sajuSystem, sajuUser } from '../readings';
import { buildSajuRequest, sajuParts } from '../../src/lib/saju-reading';
import type { RecordsDigest } from '../../src/lib/ai-records';

const key = process.env.ANTHROPIC_API_KEY;

const PERSONA: RecordsDigest = {
  name: '김하루',
  birthDate: '1990-05-15',
  moments: [
    { date: '2009-03', title: '대학 입학', category: 'school', where: '서울' },
    { date: '2013-07', title: '첫 해외 봉사', category: 'travel', where: '하노이' },
    { date: '2015-01', title: '첫 직장', category: 'career', with: ['윤도현'] },
    { date: '2019-09', title: '독립, 첫 자취', category: 'home' },
    { date: '2022-04', title: '이직, 디자인 팀', category: 'career' },
    { date: '2024-11', title: '마라톤 완주', category: 'other' },
  ],
  me: { mbti: ['INFJ (2024-01-01)'], moods: [{ month: '2026-08', avg: 3.6, days: 20 }] },
  people: [
    { name: '윤도현', group: 'friend', sub: '대학 동기', closeness: 4, met: 12, lastMet: '2026-08-30' },
    { name: '정하윤', group: 'family', relation: '어머니', closeness: 5 },
  ],
  places: { been: ['JP (2012)', 'VN (2013)', 'FR (2018)'], wish: ['IS'], cities: ['Seoul (lived)', 'Hanoi 2013'], pins: [] },
  diary: [{ date: '2026-08-02', note: '오랜만에 혼자 긴 산책. 생각이 정리되는 느낌.' }],
};

/** Things the instructions forbid, in the language this persona is read in. */
const NEVER = [/사망|죽음|수명/, /질병|암 |병에 걸/, /이혼|파산|소송/, /조심하세요|피하세요|해야 합니다|하셔야/, /AI|인공지능/];

describe.skipIf(!key)('the 사주 reading, written for real', () => {
  it('opens with a shareable line and three words, then reads the chart beside the life', async () => {
    const body = buildSajuRequest('ko', '1990-05-15', { version: 1, time: '08:30', gender: 'female', readings: [] }, PERSONA, new Date(2026, 8, 24));
    const input = cleanSajuInput(JSON.parse(JSON.stringify(body)));
    expect(input).not.toBeNull();
    const res = await callModel({ ANTHROPIC_API_KEY: key }, sajuSystem('ko'), sajuUser(input!), SAJU_MAX_TOKENS);
    expect(res.ok).toBe(true);
    const text = await new Response(memoirStream(res.body!).body).text();
    const file = join(tmpdir(), `saju-live-${Date.now()}.md`);
    writeFileSync(file, text, 'utf8');
    console.log(`reading written to ${file}`);

    const parts = sajuParts(text);
    // The card's line and words are there, short, and name nobody and nowhere.
    expect(parts.headline.length).toBeGreaterThan(5);
    expect(parts.headline.length).toBeLessThanOrEqual(70);
    expect(parts.keywords).toHaveLength(3);
    for (const privateWord of ['윤도현', '정하윤', '하노이', '서울', '김하루']) {
      expect(parts.headline + parts.keywords.join()).not.toContain(privateWord);
    }
    // Five to seven sections after them, of a readable length.
    const sections = parts.body.split(/^## /m).filter(Boolean).length;
    expect(sections).toBeGreaterThanOrEqual(5);
    expect(sections).toBeLessThanOrEqual(8);
    expect(parts.body.length).toBeGreaterThan(1500);
    // Read beside the record: at least one real moment is named.
    expect(/첫 직장|이직|마라톤|자취|봉사/.test(parts.body)).toBe(true);
    for (const rule of NEVER) expect(text).not.toMatch(rule);
  }, 180_000);
});
