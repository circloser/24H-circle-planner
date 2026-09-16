import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EventsProvider, eventsCodec, useEvents } from '../useEvents';

const KEY = '24h-circle-planner.events';
const DAY = '2026-09-16';
const NEXT = '2026-09-23';

function Probe() {
  const { events, addEvent, updateEvent, moveEvent, skipOccurrence, endSeriesBefore, removeEvent } = useEvents();
  const first = (events[DAY] ?? [])[0];
  return (
    <>
      <output data-testid="all">{JSON.stringify(events)}</output>
      <button onClick={() => addEvent(DAY, { text: '  치과 예약  ' })}>add all-day</button>
      <button onClick={() => addEvent(DAY, { text: '팀 회의', time: '09:30', color: '#ef4444' })}>add timed</button>
      <button onClick={() => addEvent(DAY, { text: '스터디', repeat: 'weekly' })}>add weekly</button>
      <button onClick={() => addEvent(DAY, { text: '출장', days: 3 })}>add trip</button>
      <button onClick={() => addEvent(DAY, { text: '잘못된 시간', time: '9:3' })}>add bad time</button>
      <button onClick={() => addEvent(DAY, { text: '   ' })}>add blank</button>
      <button onClick={() => addEvent('nope', { text: 'bad key' })}>add bad day</button>
      <button onClick={() => first && updateEvent(DAY, first.id, { text: '치과 예약 (변경)', time: '11:00' })}>edit first</button>
      <button onClick={() => first && moveEvent(DAY, first.id, NEXT)}>move first</button>
      <button onClick={() => first && skipOccurrence(DAY, first.id, NEXT)}>skip next</button>
      <button onClick={() => first && endSeriesBefore(DAY, first.id, NEXT)}>end before next</button>
      <button onClick={() => first && removeEvent(DAY, first.id)}>remove first</button>
    </>
  );
}
const all = () => JSON.parse(screen.getByTestId('all').textContent ?? '{}') as Record<string, Array<Record<string, unknown>>>;
const day = () => all()[DAY] ?? [];
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null');
const mount = () => render(<EventsProvider><Probe /></EventsProvider>);
const click = (label: string) => fireEvent.click(screen.getByText(label));

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('calendar events', () => {
  it('adds a trimmed all-day entry and persists it', () => {
    mount();
    click('add all-day');
    expect(day()).toEqual([{ id: expect.any(String), text: '치과 예약', color: '#3b82f6' }]);
    expect(stored().events[DAY][0].text).toBe('치과 예약');
  });

  it('keeps a time, a colour, a repeat rule and a multi-day span', () => {
    mount();
    click('add timed');
    click('add weekly');
    click('add trip');
    const [timed, weekly, trip] = day();
    expect(timed).toMatchObject({ text: '팀 회의', time: '09:30', color: '#ef4444' });
    expect(weekly).toMatchObject({ text: '스터디', repeat: 'weekly' });
    expect(trip).toMatchObject({ text: '출장', days: 3 });
    expect(weekly.time).toBeUndefined(); // no time = all day
  });

  it('drops a time that is not HH:MM, blank text and a key that is not a date', () => {
    mount();
    click('add bad time');
    click('add blank');
    click('add bad day');
    expect(day()).toHaveLength(1);
    expect(day()[0].time).toBeUndefined();
    expect(Object.keys(all())).toEqual([DAY]);
  });

  it('edits an entry in place', () => {
    mount();
    click('add all-day');
    click('edit first');
    expect(day()[0]).toMatchObject({ text: '치과 예약 (변경)', time: '11:00' });
  });

  it('moves an entry to another day, emptying the one it left', () => {
    mount();
    click('add all-day');
    click('move first');
    expect(all()[DAY]).toBeUndefined();
    expect(all()[NEXT][0].text).toBe('치과 예약');
  });

  it('skips one occurrence of a repeat and leaves the series standing', () => {
    mount();
    click('add weekly');
    click('skip next');
    expect(day()[0]).toMatchObject({ repeat: 'weekly', skip: [NEXT] });
  });

  it('ends a series before a day, and deletes it outright when nothing is left', () => {
    mount();
    click('add weekly');
    click('end before next');
    expect(day()[0].until).toBe('2026-09-22');
    click('remove first');
    expect(all()[DAY]).toBeUndefined();
  });

  it('keeps a hand-placed order, and reads one back', () => {
    expect(eventsCodec.decode({ version: 1, events: { [DAY]: [{ id: 'a', text: 'ok', order: 2 }] } }))
      .toEqual({ [DAY]: [{ id: 'a', text: 'ok', order: 2 }] });
    // A nonsense order is dropped rather than trusted.
    expect(eventsCodec.decode({ version: 1, events: { [DAY]: [{ id: 'a', text: 'ok', order: -1 }] } }))
      .toEqual({ [DAY]: [{ id: 'a', text: 'ok' }] });
  });

  it('reads entries from the first version (id + text) as all-day one-offs', () => {
    expect(eventsCodec.decode({ version: 1, events: { [DAY]: [{ id: 'a', text: 'ok' }] } }))
      .toEqual({ [DAY]: [{ id: 'a', text: 'ok' }] });
  });

  it('drops corrupt, foreign or unknown values but keeps spans, skips and end dates', () => {
    expect(eventsCodec.decode({
      version: 1,
      events: {
        [DAY]: [
          { id: 'a', text: 'ok', repeat: 'hourly', time: 'noon', days: 4, skip: ['2026-09-23', 'nope'], until: '2026-10-01' },
          { id: 1 }, 'x',
        ],
        'not-a-day': [{ id: 'b', text: 'no' }],
      },
    })).toEqual({ [DAY]: [{ id: 'a', text: 'ok', days: 4, skip: ['2026-09-23'], until: '2026-10-01' }] });
    expect(eventsCodec.decode({ version: 2, events: {} })).toBeNull();
    expect(eventsCodec.fallback()).toEqual({});
  });
});
