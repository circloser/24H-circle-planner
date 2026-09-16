import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EventsProvider, eventsCodec, useEvents, type EventDraft } from '../useEvents';

const KEY = '24h-circle-planner.events';
const DAY = '2026-09-16';

const drafts: Record<string, [string, EventDraft]> = {
  'add all-day': [DAY, { text: '  치과 예약  ' }],
  'add timed': [DAY, { text: '팀 회의', time: '09:30', color: '#ef4444' }],
  'add weekly': [DAY, { text: '스터디', repeat: 'weekly' }],
  'add bad time': [DAY, { text: '잘못된 시간', time: '9:3' }],
  'add blank': [DAY, { text: '   ' }],
  'add bad day': ['nope', { text: 'bad key' }],
};

function Probe() {
  const { events, addEvent, removeEvent } = useEvents();
  const day = events[DAY] ?? [];
  return (
    <>
      <output data-testid="day">{JSON.stringify(day)}</output>
      {Object.entries(drafts).map(([label, [key, draft]]) => (
        <button key={label} onClick={() => addEvent(key, draft)}>{label}</button>
      ))}
      <button onClick={() => day[0] && removeEvent(DAY, day[0].id)}>remove first</button>
    </>
  );
}
const shown = () => JSON.parse(screen.getByTestId('day').textContent ?? '[]') as Array<Record<string, unknown>>;
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null');
const mount = () => render(<EventsProvider><Probe /></EventsProvider>);

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('calendar events', () => {
  it('adds a trimmed all-day entry and persists it', () => {
    mount();
    fireEvent.click(screen.getByText('add all-day'));
    expect(shown()).toEqual([{ id: expect.any(String), text: '치과 예약', color: '#3b82f6' }]);
    expect(stored().events[DAY][0].text).toBe('치과 예약');
  });

  it('keeps a time, a colour and a repeat rule', () => {
    mount();
    fireEvent.click(screen.getByText('add timed'));
    fireEvent.click(screen.getByText('add weekly'));
    const [timed, weekly] = shown();
    expect(timed).toMatchObject({ text: '팀 회의', time: '09:30', color: '#ef4444' });
    expect(weekly).toMatchObject({ text: '스터디', repeat: 'weekly' });
    expect(weekly.time).toBeUndefined(); // no time = all day
  });

  it('drops a time that is not HH:MM instead of storing it', () => {
    mount();
    fireEvent.click(screen.getByText('add bad time'));
    expect(shown()[0].time).toBeUndefined();
  });

  it('ignores blank text and a key that is not a date', () => {
    mount();
    fireEvent.click(screen.getByText('add blank'));
    fireEvent.click(screen.getByText('add bad day'));
    expect(shown()).toEqual([]);
    expect(stored().events).toEqual({});
  });

  it('drops the day entirely once its last entry is removed', () => {
    mount();
    fireEvent.click(screen.getByText('add all-day'));
    fireEvent.click(screen.getByText('remove first'));
    expect(shown()).toEqual([]);
    expect(stored().events).toEqual({});
  });

  it('reads entries from the first version (id + text) as all-day one-offs', () => {
    expect(eventsCodec.decode({ version: 1, events: { [DAY]: [{ id: 'a', text: 'ok' }] } }))
      .toEqual({ [DAY]: [{ id: 'a', text: 'ok' }] });
  });

  it('drops corrupt, foreign or unknown values', () => {
    expect(eventsCodec.decode({
      version: 1,
      events: { [DAY]: [{ id: 'a', text: 'ok', repeat: 'hourly', time: 'noon' }, { id: 1 }, 'x'], 'not-a-day': [{ id: 'b', text: 'no' }] },
    })).toEqual({ [DAY]: [{ id: 'a', text: 'ok' }] });
    expect(eventsCodec.decode({ version: 2, events: {} })).toBeNull();
    expect(eventsCodec.fallback()).toEqual({});
  });
});
