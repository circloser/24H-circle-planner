import { describe, expect, it } from 'vitest';
import {
  BIRTHDAY_SOON_DAYS, FADED_MIN, FREE_RELATION_LINKS, FREE_RELATION_PEOPLE, RELATION_KEY,
  birthdayParts, canAddLink, canAddPerson, contactFade, currentFact, daysSinceContact, daysToBirthday,
  decodeRelation, emptyRelation, encodeRelation, factHistory, factKinds, findPeople, hasBirthdaySoon,
  isBirthdayThisMonth, isNewerRelation, isOutOfTouch, lastContactOf, meetHistory, readRelationFile,
  relationFile, relationPhotoIds, relationSummary, subgroupsOf, turningAge, MAX_SUB,
  type Person, type RelationData,
} from '../relation';

const TODAY = '2026-09-20';
const p = (id: string, over: Partial<Person> = {}): Person =>
  ({ id, name: id, group: 'friend', closeness: 2, createdAt: '', ...over });
const data = (over: Partial<RelationData> = {}): RelationData => ({ ...emptyRelation(), ...over });

describe('birthdays', () => {
  it('takes a whole date, or a month and a day when the year is not known', () => {
    expect(birthdayParts('1990-05-15')).toEqual({ y: 1990, m: 5, d: 15 });
    expect(birthdayParts('05-15')).toEqual({ y: null, m: 5, d: 15 });
    expect(birthdayParts('02-29')).toEqual({ y: null, m: 2, d: 29 });
    expect(birthdayParts('1990-02-30')).toBeNull();
    expect(birthdayParts('13-01')).toBeNull();
    expect(birthdayParts('yesterday')).toBeNull();
    expect(birthdayParts(undefined)).toBeNull();
  });

  it('counts the days to the next one, this year or the next', () => {
    expect(daysToBirthday({ birthday: '1990-09-20' }, TODAY)).toBe(0);
    expect(daysToBirthday({ birthday: '09-25' }, TODAY)).toBe(5);
    // Already past this year → it comes round next year.
    expect(daysToBirthday({ birthday: '01-01' }, TODAY)).toBe(103);
    expect(daysToBirthday({}, TODAY)).toBeNull();
  });

  it('marks one close enough to be worth a ring', () => {
    expect(hasBirthdaySoon({ birthday: '10-10' }, TODAY)).toBe(true);
    expect(hasBirthdaySoon({ birthday: '11-30' }, TODAY)).toBe(false);
    expect(BIRTHDAY_SOON_DAYS).toBe(30);
  });

  it('knows whose birthday falls in this month', () => {
    // Even one already gone by: the month is the month.
    expect(isBirthdayThisMonth({ birthday: '09-02' }, TODAY)).toBe(true);
    expect(isBirthdayThisMonth({ birthday: '10-02' }, TODAY)).toBe(false);
  });

  it('says the age being turned, when the year is known', () => {
    expect(turningAge({ birthday: '1990-09-25' }, TODAY)).toBe(36);
    expect(turningAge({ birthday: '09-25' }, TODAY)).toBeNull();
  });
});

describe('how long it has been', () => {
  it('counts the days, and nothing at all without a date', () => {
    expect(daysSinceContact({ lastContact: '2026-09-20' }, TODAY)).toBe(0);
    expect(daysSinceContact({ lastContact: '2026-06-22' }, TODAY)).toBe(90);
    expect(daysSinceContact({}, TODAY)).toBeNull();
  });

  it('fades someone out after three months, and no further than the floor', () => {
    expect(contactFade({ lastContact: '2026-09-01' }, TODAY)).toBe(1);
    expect(contactFade({}, TODAY)).toBe(1);
    const half = contactFade({ lastContact: '2026-03-08' }, TODAY);
    expect(half).toBeGreaterThan(FADED_MIN);
    expect(half).toBeLessThan(1);
    expect(contactFade({ lastContact: '2020-01-01' }, TODAY)).toBe(FADED_MIN);
  });

  it('calls ninety days out of touch', () => {
    expect(isOutOfTouch({ lastContact: '2026-06-22' }, TODAY)).toBe(true);
    expect(isOutOfTouch({ lastContact: '2026-06-23' }, TODAY)).toBe(false);
    // Never recorded is not the same as out of touch.
    expect(isOutOfTouch({}, TODAY)).toBe(false);
  });
});

describe('what is known about somebody', () => {
  const worked = p('a', {
    facts: [
      { k: 'work', v: '첫 직장', at: '2012' },
      { k: 'home', v: '부산' },
      { k: 'work', v: '지금 직장', at: '2019-04' },
      { k: 'home', v: '서울', at: '2020-08-01' },
    ],
  });

  it('answers with what is true now, and keeps what used to be', () => {
    expect(currentFact(worked, 'work')?.v).toBe('지금 직장');
    expect(factHistory(worked, 'work').map((x) => x.v)).toEqual(['지금 직장', '첫 직장']);
    // A fact with no date at all is the oldest there is: it was true before
    // anything that says when it began.
    expect(currentFact(worked, 'home')?.v).toBe('서울');
    expect(factHistory(worked, 'home').map((x) => x.v)).toEqual(['서울', '부산']);
    expect(currentFact(worked, 'title')).toBeNull();
  });

  it('names the kinds anything is written under, in their own order', () => {
    expect(factKinds(worked)).toEqual(['home', 'work']);
    expect(factKinds(p('b'))).toEqual([]);
  });

  it('is searched by what is written in it, not only by the name', () => {
    expect(findPeople(data({ people: [worked] }), '지금 직장').map((x) => x.id)).toEqual(['a']);
  });
});

describe('every time there was contact', () => {
  const met = p('a', {
    lastContact: '2026-01-02',
    log: [
      { at: '2026-03-01', k: 'meet', v: '점심' },
      { at: '2026-09-18', k: 'event', v: '결혼식' },
      { at: '2026-05-05', k: 'talk' },
    ],
  });

  it('reads back newest first, however the lines were written', () => {
    expect(meetHistory(met).map((m) => m.at)).toEqual(['2026-09-18', '2026-05-05', '2026-03-01']);
  });

  it('takes the last contact from the log, and from the old field when there is none', () => {
    expect(lastContactOf(met)).toBe('2026-09-18');
    expect(daysSinceContact(met, TODAY)).toBe(2);
    // A record written before there was a log at all.
    expect(lastContactOf({ lastContact: '2026-09-01' })).toBe('2026-09-01');
    expect(lastContactOf({})).toBeUndefined();
    // And one where the old field is the later of the two: neither is lost.
    expect(lastContactOf({ lastContact: '2026-09-19', log: [{ at: '2026-01-01', k: 'talk' }] })).toBe('2026-09-19');
  });

  it('brings somebody back out of the fade', () => {
    const quiet = p('b', { lastContact: '2020-01-01' });
    expect(isOutOfTouch(quiet, TODAY)).toBe(true);
    expect(isOutOfTouch({ ...quiet, log: [{ at: TODAY, k: 'meet' }] }, TODAY)).toBe(false);
    expect(contactFade({ ...quiet, log: [{ at: TODAY, k: 'meet' }] }, TODAY)).toBe(1);
  });
});

describe('the stored envelope', () => {
  it('keeps what it understands and drops the rest', () => {
    const out = decodeRelation({
      version: 1,
      me: { name: '나', photo: 'ph000001', colour: 'red' },
      people: [
        { id: 'a', name: '어머니', group: 'family', closeness: 3, birthday: '1960-02-11', lastContact: '2026-09-01', relation: '어머니', pinned: true, createdAt: 'x' },
        { id: 'b', name: '', group: 'friend', closeness: 2 },
        { id: 'a', name: '중복', group: 'friend', closeness: 1 },
        { id: 'c', name: '동료', group: 'nonsense', closeness: 9 },
        null,
      ],
      links: [{ source: 'a', target: 'c' }, { source: 'c', target: 'a' }, { source: 'a', target: 'a' }, { source: 'a', target: 'ghost' }],
      updatedAt: 'then',
    });
    // A version 1 record: its three rungs of closeness move to the middle
    // three of the five, and nonsense lands on the middle rung.
    expect(out?.people.map((x) => [x.id, x.group, x.closeness])).toEqual([['a', 'family', 4], ['c', 'other', 3]]);
    expect(out?.links).toEqual([{ source: 'a', target: 'c' }]);
    expect(out?.me).toEqual({ name: '나', photo: 'ph000001' });
  });

  it('remembers who is known only through somebody else, and nothing else by that name', () => {
    const out = decodeRelation({
      version: 3, me: {}, links: [], updatedAt: '',
      people: [
        { id: 'a', name: '친구', group: 'friend', closeness: 3, createdAt: '' },
        { id: 'b', name: '친구의 짝', group: 'friend', closeness: 3, apart: true, createdAt: '' },
        { id: 'c', name: '누구', group: 'friend', closeness: 3, apart: 'yes', createdAt: '' },
      ],
    });
    expect(out?.people.map((p) => p.apart ?? false)).toEqual([false, true, false]);
    expect(JSON.stringify(decodeRelation(JSON.parse(JSON.stringify(out))))).toBe(JSON.stringify(out));
  });

  it('refuses anything that is not a record of ours', () => {
    expect(decodeRelation(null)).toBeNull();
    expect(decodeRelation({ version: 4 })).toBeNull();
    expect(decodeRelation('people')).toBeNull();
  });

  it('notices a record from a newer version of the app', () => {
    expect(isNewerRelation({ version: 4 })).toBe(true);
    expect(isNewerRelation({ version: 3 })).toBe(false);
    expect(isNewerRelation({ version: 2 })).toBe(false);
    expect(isNewerRelation({ version: 1 })).toBe(false);
    expect(isNewerRelation(null)).toBe(false);
  });

  it('carries an old record over without moving anyone on the map', () => {
    // 1 → 2, 2 → 3, 3 → 4: the same words, with a rung added at each end.
    const out = decodeRelation({
      version: 1,
      people: [
        { id: 'a', name: 'a', group: 'friend', closeness: 1 },
        { id: 'b', name: 'b', group: 'friend', closeness: 2 },
        { id: 'c', name: 'c', group: 'friend', closeness: 3 },
      ],
    });
    // Straight to the current version: 1 → 2 moves the rungs, 2 → 3 moves
    // nothing (it only marks a record an older app must not save over).
    expect(out?.version).toBe(3);
    expect(out?.people.map((x) => x.closeness)).toEqual([2, 3, 4]);
    // And a record already at version 2 keeps the five rungs as they are.
    const kept = decodeRelation({
      version: 2,
      people: [{ id: 'a', name: 'a', group: 'friend', closeness: 5 }],
    });
    expect(kept?.people[0].closeness).toBe(5);
  });

  it('stores one canonical shape, so load → save never changes a byte', () => {
    const once = encodeRelation(data({
      people: [p('a', { relation: '친구', at: { a: 0.333333333, r: 0.5 }, note: 'x' })],
      links: [],
    }));
    expect(Object.keys(once.people[0])).toEqual(['id', 'name', 'group', 'relation', 'closeness', 'note', 'at', 'createdAt']);
    expect(JSON.stringify(encodeRelation(once))).toBe(JSON.stringify(once));
  });

  it('keeps the two histories, and drops what it cannot read', () => {
    const out = decodeRelation({
      version: 2,
      people: [{
        id: 'a', name: 'a', group: 'friend', closeness: 3,
        facts: [
          { k: 'work', v: '회사', at: '2019-04' },
          { k: 'nonsense', v: 'x' },
          { k: 'home', v: '   ' },
          { k: 'home', v: '서울', at: 'last year' },
        ],
        log: [
          { at: '2026-03-01', k: 'meet', v: '점심' },
          { at: '2026-03-02', k: 'shouted' },
          { at: 'someday', k: 'talk' },
          { at: '2026-04-01', k: 'event' },
        ],
      }],
    });
    expect(out?.people[0].facts).toEqual([
      { k: 'work', v: '회사', at: '2019-04' },
      // A date nobody can read is dropped; what it says is not.
      { k: 'home', v: '서울' },
    ]);
    expect(out?.people[0].log).toEqual([
      { at: '2026-03-01', k: 'meet', v: '점심' },
      { at: '2026-04-01', k: 'event' },
    ]);
    // And a record with neither writes neither.
    const bare = decodeRelation({ version: 2, people: [{ id: 'b', name: 'b', group: 'friend', closeness: 3, facts: [], log: 'no' }] });
    expect(Object.keys(bare?.people[0] ?? {})).toEqual(['id', 'name', 'group', 'closeness', 'createdAt']);
  });

  it('will not be handed a place outside the map', () => {
    const out = decodeRelation({ version: 1, people: [{ id: 'a', name: 'a', group: 'friend', closeness: 2, at: { a: 9, r: 0.5 } }] });
    expect(out?.people[0].at).toBeUndefined();
  });
});

describe('the line under the map', () => {
  it('counts the groups, the silences and the birthdays of the month', () => {
    const s = relationSummary(data({
      people: [
        p('a', { group: 'family', birthday: '09-30' }),
        p('b', { group: 'friend', lastContact: '2025-01-01' }),
        p('c', { group: 'work' }),
        p('d', { group: 'work', lastContact: '2026-09-19' }),
      ],
    }), TODAY);
    expect(s).toEqual({
      people: 4,
      byGroup: { family: 1, friend: 1, work: 2, other: 0 },
      outOfTouch: 1,
      birthdaysThisMonth: 1,
    });
  });

  it('searches names, relations and notes alike', () => {
    const d = data({ people: [p('a', { name: '김하루' }), p('b', { relation: '대학 동기' }), p('c', { note: '제주도에서 만남' })] });
    expect(findPeople(d, '하루').map((x) => x.id)).toEqual(['a']);
    expect(findPeople(d, '동기').map((x) => x.id)).toEqual(['b']);
    expect(findPeople(d, '제주').map((x) => x.id)).toEqual(['c']);
    expect(findPeople(d, '   ')).toEqual([]);
  });
});

describe('the free plan', () => {
  it('stops adding, and never hides what is already there', () => {
    const full = data({ people: Array.from({ length: FREE_RELATION_PEOPLE }, (_, i) => p(`p${i}`)) });
    expect(canAddPerson(full, false)).toBe(false);
    expect(canAddPerson(full, true)).toBe(true);
    expect(full.people).toHaveLength(FREE_RELATION_PEOPLE);
    const linked = data({ links: Array.from({ length: FREE_RELATION_LINKS }, (_, i) => ({ source: `a${i}`, target: `b${i}` })) });
    expect(canAddLink(linked, false)).toBe(false);
    expect(canAddLink(linked, true)).toBe(true);
  });
});

describe('the backup file', () => {
  const d = data({ me: { photo: 'me000001' }, people: [p('a', { photo: 'ph000001' })] });

  it('names every picture it refers to', () => {
    expect(relationPhotoIds(d)).toEqual(['me000001', 'ph000001']);
  });

  it('goes out and comes back whole', () => {
    const file = relationFile(d, { ph000001: 'data:image/png;base64,AA' }, new Date(0));
    const back = readRelationFile(JSON.stringify(file));
    expect(back.relation.people.map((x) => x.id)).toEqual(['a']);
    expect(back.photos).toEqual({ ph000001: 'data:image/png;base64,AA' });
  });

  it('is also read out of a whole-app backup', () => {
    const back = readRelationFile(JSON.stringify({
      app: '24h-circle-planner',
      data: { [RELATION_KEY]: JSON.stringify(d) },
    }));
    expect(back.relation.people).toHaveLength(1);
  });

  it('refuses a file that is not ours', () => {
    expect(() => readRelationFile('{"app":"something-else"}')).toThrow();
    expect(() => readRelationFile(JSON.stringify({ app: '24h-circle-planner', kind: 'relation', relation: null }))).toThrow();
  });
});

describe('groups inside the groups', () => {
  const people = [
    p('a', { group: 'friend', sub: '대학 동기' }),
    p('b', { group: 'friend', sub: '대학 동기' }),
    p('c', { group: 'friend', sub: '동호회' }),
    p('d', { group: 'work', sub: '대학 동기' }),
    p('e', { group: 'family' }),
  ];

  it('lists each subgroup once per group, biggest first, with how many are in it', () => {
    expect(subgroupsOf({ people })).toEqual([
      { group: 'friend', sub: '대학 동기', n: 2 },
      { group: 'friend', sub: '동호회', n: 1 },
      // The same name in another group is another subgroup.
      { group: 'work', sub: '대학 동기', n: 1 },
    ]);
  });

  it('keeps the name, trimmed and short, and writes nothing when there is none', () => {
    const out = decodeRelation({ version: 2, people: [
      { id: 'a', name: 'a', group: 'friend', closeness: 3, sub: '  대학 동기  ' },
      { id: 'b', name: 'b', group: 'friend', closeness: 3, sub: '   ' },
      { id: 'c', name: 'c', group: 'friend', closeness: 3, sub: 'x'.repeat(50) },
    ] });
    expect(out?.people[0].sub).toBe('대학 동기');
    expect(out?.people[1]).not.toHaveProperty('sub');
    expect(out?.people[2].sub).toHaveLength(MAX_SUB);
  });

  it('is found by the search box', () => {
    expect(findPeople(data({ people }), '동호회').map((x) => x.id)).toEqual(['c']);
  });
});
