import { describe, expect, it } from 'vitest';
import { lifeNudge } from '../life-nudge';
import { emptyLife, type LifeData, type Milestone } from '../life';

const ms = (id: string, date: string, extra: Partial<Milestone> = {}): Milestone =>
  ({ id, date, title: id, category: 'other', ...extra });
const life = (over: Partial<LifeData> = {}): LifeData =>
  ({ ...emptyLife(), profile: { birthDate: '1985-05-15' }, ...over });

describe('what brings someone back to the line', () => {
  it('says nothing without a birthday, or with nothing coming', () => {
    expect(lifeNudge(emptyLife(), { today: '2026-09-20' })).toBeNull();
    expect(lifeNudge(life({ milestones: [ms('a', '2030')] }), { today: '2026-09-20' })).toBeNull();
  });

  it('mentions the nearest plan inside the window', () => {
    const got = lifeNudge(life({ milestones: [ms('far', '2026-11-10'), ms('near', '2026-10-02')] }), { today: '2026-09-20' });
    expect(got).toMatchObject({ kind: 'plan' });
    expect(got?.kind === 'plan' && got.moment.id).toBe('near');
  });

  it('never mentions something already past, or one that was closed', () => {
    const l = life({ milestones: [ms('gone', '2026-09-19'), ms('near', '2026-10-02')] });
    expect(lifeNudge(l, { today: '2026-09-20' })?.kind).toBe('plan');
    const key = 'plan:near:2026';
    expect(lifeNudge(l, { today: '2026-09-20', seen: new Set([key]) })).toBeNull();
  });

  it('asks for the year in December, when the year holds nothing', () => {
    const empty = life({ milestones: [ms('old', '2024-03-01')] });
    expect(lifeNudge(empty, { today: '2026-12-08' })).toMatchObject({ kind: 'review', year: 2026 });
    // …and stays quiet once this year has something in it.
    const written = life({ milestones: [ms('this', '2026-05-01')] });
    expect(lifeNudge(written, { today: '2026-12-08' })).toBeNull();
    // A plan for this year is not a record of it.
    const planned = life({ milestones: [ms('later', '2026-12-30')] });
    expect(lifeNudge(planned, { today: '2026-12-08' })?.kind).toBe('plan');
  });

  it('is quiet in other months', () => {
    expect(lifeNudge(life({ milestones: [ms('old', '2024-03-01')] }), { today: '2026-07-08' })).toBeNull();
  });
});
