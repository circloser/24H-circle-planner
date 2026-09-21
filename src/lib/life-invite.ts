/**
 * Somebody else's shared line, taken onto this device as a line of one's own.
 *
 * A share link already shows a life to whoever opens it. This is the other
 * half: the reader can keep it — not as a copy of their record, but as one
 * more line beside theirs, the way a parent or a child is. Their own line is
 * untouched; what arrives is a name, a birthday and the moments the sharer
 * chose to publish.
 *
 * Nothing is sent anywhere by any of this. The shared code was already in the
 * reader's browser (that is how the page drew it), and what this does is write
 * it into the record on this device, which is theirs.
 */
import { v4 as uuid } from 'uuid';
import {
  FREE_LIFE_LINES, LIFE_KEY, MAX_LIFE_LINES, decodeLife, emptyLife, encodeLife, isFullDate,
  type LifeData, type LifeLine,
} from './life';
import { persistLocal } from './persistence';

/**
 * The shared life, read as a line to stand beside one's own.
 *
 * A line is always called something: the record's own decoder drops a nameless
 * one, and a sharer may well have left their name out. Failing everything
 * else it is called by the year they were born, which is true and is what the
 * reader saw on the page.
 */
export function lineFromShared(shared: LifeData, name: string): LifeLine {
  const called = (shared.profile.name || name || '').trim().slice(0, 40)
    || shared.profile.birthDate.slice(0, 4);
  return {
    id: uuid(),
    name: called,
    birthDate: shared.profile.birthDate,
    milestones: shared.milestones.map((m) => ({ ...m, id: uuid() })),
  };
}

export type InviteResult = 'added' | 'full' | 'already' | 'blank';

/** The record on this device, or an empty one when there is none yet. */
export function readLife(): LifeData {
  try {
    const raw = localStorage.getItem(LIFE_KEY);
    return (raw ? decodeLife(JSON.parse(raw)) : null) ?? emptyLife();
  } catch {
    return emptyLife();
  }
}

/**
 * Put a shared life beside one's own.
 *
 * The free plan draws two lines and Pro draws ten, so a third arriving on a
 * free plan is refused here rather than half-added. A line whose birthday is
 * already on the record is left alone — a link read twice should not make two
 * of somebody.
 */
export function addSharedLine(
  shared: LifeData | null,
  opts: { pro?: boolean; name?: string } = {},
): InviteResult {
  if (!shared || !isFullDate(shared.profile.birthDate)) return 'blank';
  const life = readLife();
  const others = life.others ?? [];
  const line = lineFromShared(shared, opts.name ?? '');
  if (others.some((o) => o.birthDate === line.birthDate && o.name === line.name)) return 'already';
  const lines = 1 + others.length;
  if (lines >= MAX_LIFE_LINES) return 'full';
  if (!opts.pro && lines >= FREE_LIFE_LINES) return 'full';
  const next: LifeData = {
    ...life,
    others: [...others, line],
    updatedAt: new Date().toISOString(),
  };
  persistLocal(LIFE_KEY, encodeLife(next));
  return 'added';
}
