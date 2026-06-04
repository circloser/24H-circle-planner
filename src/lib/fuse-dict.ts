import Fuse from 'fuse.js';
import { ICON_DICTIONARY, CATEGORIES } from '@/data/icon-dictionary';
import type { IconEntry } from '@/data/icon-dictionary';

// ─── Singleton Fuse instance ──────────────────────────────────────────────────

const fuse = new Fuse(ICON_DICTIONARY, {
  keys: ['keyword', 'aliases'],
  threshold: 0.35,
  distance: 100,
  minMatchCharLength: 2,
  includeScore: true,
});

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns top-N icon suggestions for a query.
 * Returns empty array if query length < 2 or all matches are above threshold.
 */
export function suggestIcons(query: string, n = 3): IconEntry[] {
  if (!query || query.length < 2) return [];
  const results = fuse.search(query, { limit: n });
  // fuse threshold is already applied — just map to entries
  return results.map((r) => r.item);
}

/**
 * Returns up to N results for manual icon picker dialog.
 * Uses a slightly more permissive threshold than suggestIcons.
 */
export function searchIcons(query: string, n = 50): IconEntry[] {
  if (!query || query.length < 1) {
    return ICON_DICTIONARY.slice(0, n);
  }
  const results = fuse.search(query, { limit: n });
  return results.map((r) => r.item);
}

/**
 * Returns a fallback icon entry.
 * If query matches a category label or id, returns the first entry of that category.
 * Otherwise returns the generic ⭐ misc entry.
 */
export function fallbackIcon(query: string): IconEntry {
  const q = query.toLowerCase().trim();
  if (q) {
    // Check if query matches a category
    const cat = CATEGORIES.find(
      (c) => c.label.toLowerCase() === q || c.id === q,
    );
    if (cat) {
      const catEntry = ICON_DICTIONARY.find((e) => e.category === cat.id);
      if (catEntry) return catEntry;
    }
  }

  // Return generic misc entry
  const generic = ICON_DICTIONARY.find((e) => e.id === 'misc-generic');
  if (generic) return generic;
  return {
    id: 'misc-fallback',
    category: 'misc',
    keyword: '기타',
    aliases: ['other', 'misc'],
    emoji: '⭐',
  };
}
