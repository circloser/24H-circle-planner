import { describe, it, expect } from 'vitest';
import { suggestIcons, searchIcons, fallbackIcon } from '@/lib/fuse-dict';

describe('suggestIcons', () => {
  it('returns 💤 as top result for 수면', () => {
    const results = suggestIcons('수면', 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].emoji).toBe('💤');
  });

  it('includes 📚 for 독서', () => {
    const results = suggestIcons('독서', 3);
    expect(results.some((r) => r.emoji === '📚')).toBe(true);
  });

  it('returns at least one of 🍳 or 🍚 for 식사', () => {
    const results = suggestIcons('식사', 3);
    const mealEmojis = ['🍳', '🍚', '🍱', '🍽️'];
    expect(results.some((r) => mealEmojis.includes(r.emoji))).toBe(true);
  });

  it('returns empty array for completely unrelated short query', () => {
    const results = suggestIcons('asdfghjkl', 3);
    expect(results).toEqual([]);
  });

  it('returns 📚 in top-3 for fuzzy query 독서하기', () => {
    const results = suggestIcons('독서하기', 3);
    expect(results.some((r) => r.emoji === '📚')).toBe(true);
  });

  it('returns empty array for query shorter than 2 chars', () => {
    expect(suggestIcons('', 3)).toEqual([]);
    expect(suggestIcons('가', 3)).toEqual([]);
  });

  it('returns results for 출근', () => {
    const results = suggestIcons('출근', 3);
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns transit emoji for 등교', () => {
    const results = suggestIcons('등교', 3);
    expect(results.length).toBeGreaterThan(0);
    expect(['🚌', '🚇', '🚶'].some((e) => results.some((r) => r.emoji === e))).toBe(true);
  });
});

describe('searchIcons', () => {
  it('returns up to 50 results', () => {
    const results = searchIcons('업무', 50);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(50);
  });

  it('returns all entries when query is empty', () => {
    const results = searchIcons('', 50);
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('fallbackIcon', () => {
  it('returns ⭐ for unknown query', () => {
    const result = fallbackIcon('완전히알수없는쿼리');
    expect(result.emoji).toBe('⭐');
  });

  it('returns sleep category entry for 수면 category label', () => {
    const result = fallbackIcon('수면');
    expect(result.category).toBe('sleep');
  });

  it('returns misc entry for empty query', () => {
    const result = fallbackIcon('');
    expect(result.emoji).toBe('⭐');
  });
});
