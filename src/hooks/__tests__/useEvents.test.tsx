import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EventsProvider, eventsCodec, useEvents } from '../useEvents';

const KEY = '24h-circle-planner.events';
const DAY = '2026-09-16';

function Probe() {
  const { events, addEvent, removeEvent } = useEvents();
  const day = events[DAY] ?? [];
  return (
    <>
      <output data-testid="day">{JSON.stringify(day.map((e) => e.text))}</output>
      <button onClick={() => addEvent(DAY, '  치과 예약  ')}>add</button>
      <button onClick={() => addEvent(DAY, '   ')}>add blank</button>
      <button onClick={() => addEvent('nope', 'bad key')}>add bad day</button>
      <button onClick={() => day[0] && removeEvent(DAY, day[0].id)}>remove first</button>
    </>
  );
}
const shown = () => JSON.parse(screen.getByTestId('day').textContent ?? '[]') as string[];
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null');

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('calendar events', () => {
  it('adds a trimmed entry to a day and persists it', () => {
    render(<EventsProvider><Probe /></EventsProvider>);
    fireEvent.click(screen.getByText('add'));
    expect(shown()).toEqual(['치과 예약']);
    expect(stored()).toEqual({ version: 1, events: { [DAY]: [{ id: expect.any(String), text: '치과 예약' }] } });
  });

  it('ignores blank text and a key that is not a date', () => {
    render(<EventsProvider><Probe /></EventsProvider>);
    fireEvent.click(screen.getByText('add blank'));
    fireEvent.click(screen.getByText('add bad day'));
    expect(shown()).toEqual([]);
    expect(stored().events).toEqual({});
  });

  it('drops the day entirely once its last entry is removed', () => {
    render(<EventsProvider><Probe /></EventsProvider>);
    fireEvent.click(screen.getByText('add'));
    fireEvent.click(screen.getByText('remove first'));
    expect(shown()).toEqual([]);
    expect(stored().events).toEqual({});
  });

  it('restores what was saved, dropping corrupt or foreign entries', () => {
    expect(eventsCodec.decode({ version: 1, events: { [DAY]: [{ id: 'a', text: 'ok' }, { id: 1 }, 'x'], 'not-a-day': [{ id: 'b', text: 'no' }] } }))
      .toEqual({ [DAY]: [{ id: 'a', text: 'ok' }] });
    expect(eventsCodec.decode({ version: 2, events: {} })).toBeNull();
    expect(eventsCodec.fallback()).toEqual({});
  });
});
