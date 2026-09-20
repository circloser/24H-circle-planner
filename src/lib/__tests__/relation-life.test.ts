import { describe, expect, it } from 'vitest';
import { emptyLife, type FamilyMember, type LifeData } from '../life';
import { emptyRelation, type Person, type RelationData } from '../relation';
import { familyToImport, personFromFamily, samepeople, syncFromLife } from '../relation-life';
import { relationBirthdays } from '../relation-calendar';

const mother: FamilyMember = { id: 'f1', relation: 'mother', name: '이정숙', birthDate: '1958-03-02' };
const father: FamilyMember = { id: 'f2', relation: 'father', name: '김영수' };
const life = (family: FamilyMember[]): LifeData => ({ ...emptyLife(), family });
const p = (id: string, over: Partial<Person> = {}): Person =>
  ({ id, name: id, group: 'friend', closeness: 2, createdAt: '', ...over });
const data = (people: Person[] = []): RelationData => ({ ...emptyRelation(), people });

const label = (rel: FamilyMember['relation']) => (rel === 'mother' ? '어머니' : rel === 'father' ? '아버지' : rel);

describe('bringing the life line\'s family over', () => {
  it('offers only the ones who are not here yet', () => {
    expect(familyToImport(life([mother, father]), data()).map((f) => f.id)).toEqual(['f1', 'f2']);
    expect(familyToImport(life([mother, father]), data([p('a', { lifeFamilyId: 'f1' })])).map((f) => f.id)).toEqual(['f2']);
    expect(familyToImport(null, data())).toEqual([]);
  });

  it('brings a parent in as family, on the nearest ring, with the tie recorded', () => {
    expect(personFromFamily(mother, label)).toEqual({
      name: '이정숙',
      group: 'family',
      relation: '어머니',
      closeness: 5,
      birthday: '1958-03-02',
      lifeFamilyId: 'f1',
    });
  });

  it('falls back to what they are called when they have no name, and skips a half date', () => {
    expect(personFromFamily({ id: 'f3', relation: 'father', name: ' ', birthDate: '1955' }, label))
      .toEqual({ name: '아버지', group: 'family', relation: '아버지', closeness: 5, lifeFamilyId: 'f3' });
  });
});

describe('what the life line keeps saying', () => {
  it('updates a name and a birthday, and nothing else', () => {
    const people = [p('a', { lifeFamilyId: 'f1', name: '엄마', note: '내가 쓴 메모', closeness: 1 })];
    const [out] = syncFromLife(life([mother]), people);
    expect(out.name).toBe('이정숙');
    expect(out.birthday).toBe('1958-03-02');
    // What the map knows and the line does not is left alone.
    expect(out.note).toBe('내가 쓴 메모');
    expect(out.closeness).toBe(1);
  });

  it('leaves alone anyone the line has never heard of', () => {
    const people = [p('a'), p('b', { lifeFamilyId: 'gone' })];
    expect(syncFromLife(life([mother]), people)).toEqual(people);
    expect(samepeople(syncFromLife(life([mother]), people), people)).toBe(true);
  });

  it('writes nothing when there is nothing new to say', () => {
    const people = [p('a', { lifeFamilyId: 'f1', name: '이정숙', birthday: '1958-03-02' })];
    expect(samepeople(syncFromLife(life([mother]), people), people)).toBe(true);
    expect(samepeople(syncFromLife(null, people), people)).toBe(true);
  });
});

describe('birthdays in the calendar', () => {
  const colour = () => '#b4544a';

  it('puts one chip on each birthday in the window, read-only', () => {
    const out = relationBirthdays(
      data([p('a', { name: '배준호', birthday: '1970-10-01' })]),
      '2026-09-01', '2026-11-30',
      (who, age) => `${who} ${age ?? ''}`.trim(), colour,
    );
    expect(Object.keys(out)).toEqual(['2026-10-01']);
    expect(out['2026-10-01'][0]).toMatchObject({ text: '배준호 56', src: 'life', length: 1 });
  });

  it('shows a birthday with no year, without claiming an age', () => {
    const out = relationBirthdays(
      data([p('a', { name: '조은비', birthday: '10-05' })]),
      '2026-01-01', '2026-12-31',
      (who, age) => `${who}${age === null ? '' : ` ${age}`}`, colour,
    );
    expect(out['2026-10-05'][0].text).toBe('조은비');
  });

  it('brings 29 February round on the 28th in a year that has none', () => {
    const out = relationBirthdays(
      data([p('a', { birthday: '02-29' })]),
      '2026-01-01', '2026-12-31', (who) => who, colour,
    );
    expect(Object.keys(out)).toEqual(['2026-02-28']);
  });

  it('says nothing for someone with no birthday, or outside the window', () => {
    expect(relationBirthdays(data([p('a')]), '2026-01-01', '2026-12-31', (w) => w, colour)).toEqual({});
    expect(relationBirthdays(data([p('a', { birthday: '10-05' })]), '2026-01-01', '2026-06-30', (w) => w, colour)).toEqual({});
  });
});
