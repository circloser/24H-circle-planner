import { describe, expect, it } from 'vitest';
import { icalDays, occurrenceStarts, parseIcs, parseRrule, type IcalEvent } from '../ical';

/** A feed shaped the way Google writes one, folded lines and all. */
const FEED = [
  'BEGIN:VCALENDAR',
  'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260918',
  'DTEND;VALUE=DATE:20260922',
  'UID:trip@google.com',
  'SUMMARY:제주 출장',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;TZID=Asia/Seoul:20260916T093000',
  'DTEND;TZID=Asia/Seoul:20260916T100000',
  'RRULE:FREQ=WEEKLY;BYDAY=WE;UNTIL=20261231T145959Z',
  'EXDATE;TZID=Asia/Seoul:20260930T093000',
  'UID:standup@google.com',
  'SUMMARY:주간 회의\\, 팀 전체',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;TZID=Asia/Seoul:20260923T110000',
  'RECURRENCE-ID;TZID=Asia/Seoul:20260923T093000',
  'UID:standup@google.com',
  'SUMMARY:주간 회의 (시간 변경)',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260919',
  'UID:gone@google.com',
  'SUMMARY:취소된 일정',
  'STATUS:CANCELLED',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260917',
  'UID:long@google.com',
  'SUMMARY:아주 긴 제목이라 구글이 한 줄을 접어',
  ' 서 내보낸 경우',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('parsing a Google feed', () => {
  const events = parseIcs(FEED);

  it('reads every VEVENT, and nothing else', () => {
    expect(events.map((e) => e.uid)).toEqual([
      'trip@google.com', 'standup@google.com', 'standup@google.com', 'gone@google.com', 'long@google.com',
    ]);
  });

  it('treats an all-day DTEND as exclusive, so a span covers the right days', () => {
    const trip = events[0];
    expect(trip).toMatchObject({ start: '2026-09-18', time: null, days: 4 });
  });

  it('keeps the wall-clock time of a zoned event and unescapes the summary', () => {
    expect(events[1]).toMatchObject({ start: '2026-09-16', time: '09:30', text: '주간 회의, 팀 전체' });
  });

  it('joins a folded line back together (the fold space is not part of the text)', () => {
    expect(events[4].text).toBe('아주 긴 제목이라 구글이 한 줄을 접어서 내보낸 경우');
  });

  it('carries the rule, its exceptions, overrides and cancellations', () => {
    expect(events[1].rrule).toContain('FREQ=WEEKLY');
    expect(events[1].exdates).toEqual(['2026-09-30']);
    expect(events[2].recurrenceId).toBe('2026-09-23');
    expect(events[3].cancelled).toBe(true);
  });

  it('converts a UTC stamp to the device clock', () => {
    // 2026-09-16T00:30Z is the 16th, 09:30 in Seoul (the test box runs KST).
    const [utc] = parseIcs(['BEGIN:VEVENT', 'DTSTART:20260916T003000Z', 'UID:z', 'SUMMARY:z', 'END:VEVENT'].join('\r\n'));
    const at = new Date(Date.UTC(2026, 8, 16, 0, 30));
    expect(utc.start).toBe(`${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`);
    expect(utc.time).toBe(`${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`);
  });
});

describe('repeat rules', () => {
  const at = (over: Partial<IcalEvent> = {}): IcalEvent => ({
    uid: 'u', text: 'x', start: '2026-09-16', time: null, days: 1,
    rrule: null, exdates: [], recurrenceId: null, cancelled: false, ...over,
  });

  it('reads the parts it supports', () => {
    expect(parseRrule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE')).toMatchObject({
      freq: 'WEEKLY', interval: 2, byday: [{ day: 1, nth: null }, { day: 3, nth: null }],
    });
    expect(parseRrule('FREQ=HOURLY')).toBeNull();
  });

  it('expands a weekly rule on the days it names', () => {
    // 2026-09-16 is a Wednesday.
    const starts = occurrenceStarts(at({ rrule: 'FREQ=WEEKLY;BYDAY=WE,FR' }), '2026-09-16', '2026-09-30');
    expect(starts).toEqual(['2026-09-16', '2026-09-18', '2026-09-23', '2026-09-25', '2026-09-30']);
  });

  it('honours INTERVAL, COUNT and UNTIL', () => {
    expect(occurrenceStarts(at({ rrule: 'FREQ=DAILY;INTERVAL=3' }), '2026-09-16', '2026-09-26'))
      .toEqual(['2026-09-16', '2026-09-19', '2026-09-22', '2026-09-25']);
    expect(occurrenceStarts(at({ rrule: 'FREQ=WEEKLY;COUNT=2' }), '2026-09-16', '2026-12-31'))
      .toEqual(['2026-09-16', '2026-09-23']);
    expect(occurrenceStarts(at({ rrule: 'FREQ=WEEKLY;UNTIL=20260924T000000Z' }), '2026-09-16', '2026-12-31'))
      .toEqual(['2026-09-16', '2026-09-23']);
  });

  it('skips a month that has no such day, and finds the nth weekday', () => {
    expect(occurrenceStarts(at({ start: '2026-01-31', rrule: 'FREQ=MONTHLY' }), '2026-01-01', '2026-04-30'))
      .toEqual(['2026-01-31', '2026-03-31']);
    // The second Tuesday of each month.
    expect(occurrenceStarts(at({ start: '2026-09-08', rrule: 'FREQ=MONTHLY;BYDAY=2TU' }), '2026-09-01', '2026-11-30'))
      .toEqual(['2026-09-08', '2026-10-13', '2026-11-10']);
  });

  it('drops the dates the feed excludes', () => {
    expect(occurrenceStarts(at({ rrule: 'FREQ=WEEKLY', exdates: ['2026-09-23'] }), '2026-09-16', '2026-09-30'))
      .toEqual(['2026-09-16', '2026-09-30']);
  });

  it('never runs away on a rule with no end', () => {
    expect(occurrenceStarts(at({ rrule: 'FREQ=DAILY' }), '2026-09-16', '2026-09-20')).toHaveLength(5);
  });
});

describe('a feed laid onto days', () => {
  const days = icalDays(parseIcs(FEED), '2026-09-01', '2026-10-31');

  it('marks every imported entry read-only and covers a span day by day', () => {
    expect(days['2026-09-18'].map((e) => [e.text, e.index, e.src]))
      .toEqual([['제주 출장', 0, 'ical']]);
    expect(days['2026-09-21'][0]).toMatchObject({ text: '제주 출장', index: 3, length: 4 });
    expect(days['2026-09-22']).toBeUndefined(); // DTEND is exclusive
  });

  it('leaves out cancelled events and excluded dates', () => {
    expect(days['2026-09-19']?.some((e) => e.text === '취소된 일정')).toBeFalsy();
    expect(days['2026-09-30']?.some((e) => e.text.startsWith('주간 회의'))).toBeFalsy();
  });

  it('lets an override replace just its own occurrence', () => {
    expect(days['2026-09-23'].map((e) => [e.text, e.time])).toEqual([['주간 회의 (시간 변경)', '11:00']]);
    expect(days['2026-09-16'].map((e) => e.time)).toEqual(['09:30']);
  });

  it('gives an imported occurrence a stable id per date', () => {
    expect(days['2026-09-16'][0].id).toBe('standup@google.com@2026-09-16');
  });
});
