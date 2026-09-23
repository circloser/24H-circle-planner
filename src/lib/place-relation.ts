/**
 * The bridge from the relation map to the place map: who was there.
 *
 * A pin keeps the ids of the people it was shared with; the names are looked
 * up when the card is drawn (lib/relation-people, which the life line reads
 * the same way).
 */
export { readRelationPeople, namesOf, type Someone } from './relation-people';
